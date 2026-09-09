/**
 * VM provisioning helpers — "create VM like Hostinger".
 *
 * Operates over the same SSH runner used by scanVms. For Proxmox:
 *   - detect templates from `qm list` (VMID 9000-9999 are templates by
 *     convention; `template: 1` in config is authoritative)
 *   - pick a free VMID automatically (100-9999, skipping used/templates)
 *   - build the clone command chain: qm clone -> qm set -> qm resize -> qm start
 *
 * For KVM/libvirt the same shape is used with virt-clone (best-effort —
 * requires a template VM and virt-clone installed). ESXi provisioning is
 * intentionally NOT supported (vim-cmd cannot clone).
 */

export interface VmTemplate {
	id: string; // VMID (proxmox) or name (kvm)
	name: string;
	os: string;
	diskGB: number;
	ramMB: number;
	vcpu: number;
}

export interface ProvisionVmSpec {
	name: string;
	templateId: string; // VMID / template name on the hypervisor
	vcpu: number;
	ramMB: number;
	diskGB: number; // final disk size (>= template size)
	storage?: string; // proxmox storage for clone target, e.g. "local-lvm" (optional)
	bridge?: string; // network bridge, e.g. "vmbr0" (optional)
	vlanTag?: number; // optional VLAN tag
	ipAddress?: string; // optional static IP (needs cloud-init template)
	gateway?: string; // optional gateway for static IP
	startVm: boolean; // start after create
}

export const PROXMOX_TEMPLATE_POOL_MIN = 9000;
export const PROXMOX_TEMPLATE_POOL_MAX = 9999;

/** Detect whether a Proxmox config snippet declares a template (`template: 1`). */
export const isProxmoxTemplate = (configOutput: string): boolean => /^\s*template:\s*1\s*$/m.test(configOutput);

/**
 * Parse `qm list` output into VM entries (id + name + status + mem + vcpu),
 * shared with provisioning.
 */
export interface ProxmoxVmListEntry {
	id: number;
	name: string;
	status: string;
	ramMB: number;
	vcpu: number;
}

/** Parse qm list output into structured entries (numbers only). */
export const parseProxmoxVmListEntries = (output: string): ProxmoxVmListEntry[] => {
	const entries: ProxmoxVmListEntry[] = [];
	const lines = output.trim().split("\n");
	// Skip header row: VMID NAME STATUS MEM VCPU
	for (let i = 1; i < lines.length; i++) {
		const line = (lines[i] ?? "").trim();
		if (!line) continue;
		const parts = line.split(/\s+/);
		if (parts.length < 5) continue;
		const id = parseInt(parts[0] ?? "", 10);
		if (!Number.isFinite(id)) continue;
		entries.push({
			id,
			name: parts[1] ?? "unknown",
			status: parts[2] ?? "stopped",
			ramMB: parseInt(parts[3] ?? "0", 10) || 0,
			vcpu: parseInt(parts[4] ?? "0", 10) || 0,
		});
	}
	return entries;
};

/**
 * Choose the next free VMID in [100, 8999] (template pool 9000-9999 is
 * reserved). Skips existing IDs and template IDs.
 */
export const pickFreeVmid = (existingIds: number[], templateIds: number[] = []): number => {
	const used = new Set<number>([...existingIds, ...templateIds]);
	for (let id = 100; id < PROXMOX_TEMPLATE_POOL_MIN; id++) {
		if (!used.has(id)) return id;
	}
	throw new Error("No free VMID available (100-8999 all used)");
};

/**
 * Filter `qm list` + config outputs down to template entries.
 * Requires listOutput (qm list) and a map vmId -> qm config output.
 */
export const detectProxmoxTemplates = (listOutput: string, configOutputs: Map<string, string>): VmTemplate[] => {
	const entries = parseProxmoxVmListEntries(listOutput);
	const templates: VmTemplate[] = [];
	for (const entry of entries) {
		const cfg = configOutputs.get(String(entry.id));
		if (!cfg) continue;
		if (!isProxmoxTemplate(cfg)) continue;
		// name from config (qm list may show "template" as name for templates)
		const nameMatch = cfg.match(/^\s*name:\s*(.+)$/m);
		const name = nameMatch && nameMatch[1] ? nameMatch[1].trim() : entry.name;
		// memory / cores from config
		const memMatch = cfg.match(/^\s*memory:\s*(\d+)\s*$/m);
		const coreMatch = cfg.match(/^\s*cores:\s*(\d+)\s*$/m);
		// disk: sum of all scsi*/virtio*/ide* sizes
		let diskGB = 0;
		const diskRe = /^\s*(?:scsi|virtio|sata|ide)\d+:\s*[^,]+,\s*size=(\d+)([GMT]?)/gm;
		let dm;
		while ((dm = diskRe.exec(cfg)) !== null) {
			const n = parseInt(dm[1] ?? "0", 10) || 0;
			const unit = (dm[2] ?? "G").toUpperCase();
			diskGB += unit === "T" ? n * 1024 : unit === "M" ? Math.round(n / 1024) : n;
		}
		templates.push({
			id: String(entry.id),
			name,
			os: "linux", // Proxmox templates are linux by convention (ostype would need guest tools)
			diskGB,
			ramMB: (memMatch && memMatch[1] ? parseInt(memMatch[1], 10) : entry.ramMB) || 0,
			vcpu: (coreMatch && coreMatch[1] ? parseInt(coreMatch[1], 10) : entry.vcpu) || 0,
		});
	}
	return templates;
};

/** Parse `virsh list --all --name` into template candidates (kvm). */
export const detectKvmTemplates = (output: string): VmTemplate[] => {
	// Every KVM VM could be a clone source; mark all as templates (virt-clone).
	const templates: VmTemplate[] = [];
	const lines = output.trim().split("\n");
	for (const line of lines) {
		const name = line.trim();
		if (name) {
			templates.push({ id: name, name, os: "linux", diskGB: 0, ramMB: 0, vcpu: 0 });
		}
	}
	return templates;
};

/** Quote a shell argument for remote exec (avoid injection). */
export const shellQuote = (value: string): string => "'" + value.replace(/'/g, "'\\''") + "'";

/**
 * Build the shell command chain for Proxmox provisioning.
 * Returns a single string safe for exec via SSH. Steps:
 *   qm clone <template> <vmid> --name <name> [--storage <storage>]
 *   qm set <vmid> --memory <mb> --cores <n> [--net0 ...] [--ipconfig0 ...]
 *   qm resize <vmid> <disk> <size>   (only if requested > template; disk name default scsi0)
 *   qm start <vmid>                  (if startVm)
 */
export const buildProxmoxProvisionCommand = (spec: ProvisionVmSpec, template: VmTemplate, vmid: number): string => {
	const steps: string[] = [];
	const safeName = shellQuote(spec.name);

	let cloneCmd = "qm clone " + template.id + " " + vmid + " --name " + safeName;
	if (spec.storage) cloneCmd += " --storage " + shellQuote(spec.storage);
	steps.push(cloneCmd);

	const setParts = ["qm set " + vmid, "--memory " + spec.ramMB, "--cores " + spec.vcpu];
	if (spec.bridge) {
		let net0 = "model=virtio,bridge=" + spec.bridge;
		if (spec.vlanTag) net0 += ",tag=" + spec.vlanTag;
		setParts.push("--net0 " + shellQuote(net0));
	}
	if (spec.ipAddress) {
		let ipcfg = "ip=" + spec.ipAddress;
		if (spec.gateway) ipcfg += ",gw=" + spec.gateway;
		setParts.push("--ipconfig0 " + shellQuote(ipcfg));
	}
	steps.push(setParts.join(" "));

	if (spec.diskGB > template.diskGB && template.diskGB > 0) {
		steps.push("qm resize " + vmid + " scsi0 " + spec.diskGB + "G");
	}

	if (spec.startVm) {
		steps.push("qm start " + vmid);
	}

	return steps.join(" && ");
};

/** Build KVM clone command (best-effort). */
export const buildKvmProvisionCommand = (spec: ProvisionVmSpec, vmid: string): string => {
	const steps: string[] = [];
	steps.push("virt-clone --original " + shellQuote(spec.templateId) + " --name " + shellQuote(spec.name) + " --auto-clone");
	if (spec.startVm) steps.push("virsh start " + shellQuote(spec.name));
	return steps.join(" && ");
};
