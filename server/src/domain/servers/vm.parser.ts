/**
 * VM auto-discovery parser -- multi-hypervisor.
 *
 * SSH ke baremetal hypervisor, run command, parse output
 * untuk dapatkan: VM list with full specs (vCPU, RAM, disk, OS, IP, MAC, VLAN, status).
 *
 * Supported hypervisors:
 * - Proxmox VE  (qm list + qm config <vmid> + qm guest cmd)
 * - KVM/libvirt  (virsh list --all + virsh dumpxml + dommemstat)
 * - ESXi/vSphere (vim-cmd vmsvc/getallvms + vim-cmd vmsvc/get.summary)
 */

export type VmStatus = "running" | "stopped" | "paused";

export interface VirtualMachine {
	id: string;
	name: string;
	vcpu: number;
	ramMB: number;
	diskGB: number;
	os: string;
	ipAddress: string;
	macAddress: string;
	vlanId: number | null;
	status: VmStatus;
	hypervisor: "proxmox" | "kvm" | "esxi";
}

/** Detect hypervisor type from OS string or server role. */
export const detectHypervisor = (os?: string, role?: string): "proxmox" | "kvm" | "esxi" | null => {
	const osLower = (os ?? "").toLowerCase();
	const roleLower = (role ?? "").toLowerCase();
	if (osLower.includes("proxmox") || osLower.includes("pve")) return "proxmox";
	if (osLower.includes("esxi") || osLower.includes("vsphere") || osLower.includes("vmware")) return "esxi";
	if (osLower.includes("kvm") || osLower.includes("libvirt") || osLower.includes("virsh")) return "kvm";
	if (roleLower === "hypervisor") {
		// Default to Proxmox for Linux hypervisors
		if (osLower.includes("debian") || osLower.includes("ubuntu") || osLower === "") return "proxmox";
		if (osLower.includes("esxi")) return "esxi";
		return "kvm";
	}
	return null;
};

/** Get the VM list command for a hypervisor type. */
export const getVmListCommand = (hypervisor: "proxmox" | "kvm" | "esxi"): string => {
	switch (hypervisor) {
		case "proxmox":
			return "qm list";
		case "kvm":
			return "virsh list --all --name";
		case "esxi":
			return "vim-cmd vmsvc/getallvms";
	}
};

/** Get the VM detail command for a specific VM ID/name. */
export const getVmDetailCommand = (hypervisor: "proxmox" | "kvm" | "esxi", vmId: string): string => {
	switch (hypervisor) {
		case "proxmox":
			return "qm config " + vmId;
		case "kvm":
			return "virsh dumpxml " + vmId;
		case "esxi":
			return "vim-cmd vmsvc/get.summary " + vmId;
	}
};

/** Get the VM guest network info command (for IP discovery). */
export const getVmGuestInfoCommand = (hypervisor: "proxmox" | "kvm" | "esxi", vmId: string): string => {
	switch (hypervisor) {
		case "proxmox":
			return "qm guest cmd " + vmId + " network-get-interfaces";
		case "kvm":
			return "virsh domifaddr " + vmId + " --source agent";
		case "esxi":
			return "vim-cmd vmsvc/get.summary " + vmId; // already in summary
	}
};

// -- Proxmox parser --

/**
 * Parse `qm list` output:
 *   VMID NAME                 STATUS    MEM    VCPU
 *   100  vm-ubuntu-01         running   16384  4
 *   101  vm-ubuntu-02         stopped   32768  8
 */
const parseProxmoxList = (output: string): { id: string; name: string; status: VmStatus; ramMB: number; vcpu: number }[] => {
	const vms: { id: string; name: string; status: VmStatus; ramMB: number; vcpu: number }[] = [];
	const lines = output.trim().split("\n");
	// Skip header line
	for (let i = 1; i < lines.length; i++) {
		const line = (lines[i] ?? "").trim();
		if (!line) continue;
		// Columns are whitespace-separated
		const parts = line.split(/\s+/);
		if (parts.length < 5) continue;
		const id = parts[0] ?? "";
		const name = parts[1] ?? "";
		const statusRaw = (parts[2] ?? "").toLowerCase();
		const memStr = parts[3] ?? "0";
		const vcpuStr = parts[4] ?? "0";
		const status: VmStatus = statusRaw === "running" ? "running" : statusRaw === "paused" ? "paused" : "stopped";
		const ramMB = parseInt(memStr, 10) || 0;
		const vcpu = parseInt(vcpuStr, 10) || 0;
		vms.push({ id, name, status, ramMB, vcpu });
	}
	return vms;
};

/**
 * Parse `qm config <vmid>` output:
 *   cores: 4
 *   memory: 16384
 *   scsi0: local-lvm:vm-100-disk-0,size=250G
 *   net0: virtio=52:54:00:12:34:56,bridge=vmbr0,tag=10
 *   ostype: l26
 *   name: vm-ubuntu-01
 */
const parseProxmoxConfig = (output: string): Partial<VirtualMachine> => {
	const result: Partial<VirtualMachine> = {};
	const lines = output.split("\n");
	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed) continue;

		// cores: 4
		const coresMatch = trimmed.match(/^cores:\s*(\d+)/);
		if (coresMatch && coresMatch[1]) { result.vcpu = parseInt(coresMatch[1], 10); continue; }

		// memory: 16384
		const memMatch = trimmed.match(/^memory:\s*(\d+)/);
		if (memMatch && memMatch[1]) { result.ramMB = parseInt(memMatch[1], 10); continue; }

		// scsi0: local-lvm:vm-100-disk-0,size=250G  (or ide0, virtio0, etc.)
		const diskMatch = trimmed.match(/(?:scsi|ide|virtio|sata|nvme)\d+:\s*.*?,size=(\d+)([GMK])/i);
		if (diskMatch && diskMatch[1] && diskMatch[2]) {
			const size = parseInt(diskMatch[1], 10);
			const unit = diskMatch[2].toUpperCase();
			if (unit === "G") result.diskGB = size;
			else if (unit === "M") result.diskGB = Math.round(size / 1024);
			else if (unit === "K") result.diskGB = Math.round(size / (1024 * 1024));
			continue;
		}

		// net0: virtio=52:54:00:12:34:56,bridge=vmbr0,tag=10
		const netMatch = trimmed.match(/^net\d+:\s*.*?(?:virtio|e1000|rtl8139|vmxnet3)=([0-9a-fA-F:]{17}).*?(?:tag=(\d+))?/);
		if (netMatch && netMatch[1]) {
			result.macAddress = netMatch[1];
			if (netMatch[2]) result.vlanId = parseInt(netMatch[2], 10);
			continue;
		}

		// ostype: l26
		const osMatch = trimmed.match(/^ostype:\s*(\w+)/);
		if (osMatch && osMatch[1]) {
			result.os = proxmoxOsTypeToString(osMatch[1]);
			continue;
		}

		// name: vm-ubuntu-01
		const nameMatch = trimmed.match(/^name:\s*(.+)/);
		if (nameMatch && nameMatch[1]) { result.name = nameMatch[1].trim(); continue; }
	}
	return result;
};

/** Convert Proxmox ostype code to human-readable OS name. */
const proxmoxOsTypeToString = (ostype: string): string => {
	const map: Record<string, string> = {
		"l26": "Linux 6.x Kernel",
		"l24": "Linux 2.4 Kernel",
		"l26+": "Linux 3.x+ Kernel",
		"win11": "Windows 11",
		"win10": "Windows 10",
		"win8": "Windows 8",
		"win7": "Windows 7",
		"w2k19": "Windows Server 2019",
		"w2k22": "Windows Server 2022",
		"w2k16": "Windows Server 2016",
		"w2k12r2": "Windows Server 2012 R2",
		"w2k8": "Windows Server 2008",
		"wxp": "Windows XP",
		"other": "Other OS",
	};
	return map[ostype] ?? ostype;
};

// -- KVM/libvirt parser --

/**
 * Parse `virsh list --all --name` output:
 *   vm-ubuntu-01
 *   vm-ubuntu-02
 *   vm-windows-01
 */
const parseKvmList = (output: string): { id: string; name: string }[] => {
	const vms: { id: string; name: string }[] = [];
	const lines = output.trim().split("\n");
	for (const line of lines) {
		const name = line.trim();
		if (name) vms.push({ id: name, name });
	}
	return vms;
};

/**
 * Parse `virsh dumpxml <name>` output (XML):
 *   <domain type='kvm'>
 *     <name>vm-ubuntu-01</name>
 *     <vcpu placement='static'>4</vcpu>
 *     <memory unit='KiB'>16777216</memory>
 *     <os>
 *       <type>hvm</type>
 *     </os>
 *     <devices>
 *       <disk type='file' device='disk'>
 *         <source file='/var/lib/libvirt/images/vm-ubuntu-01.qcow2'/>
 *         <target dev='vda'/>
 *         <capacity unit='bytes'>268435456000</capacity>
 *       </disk>
 *       <interface type='bridge'>
 *         <mac address='52:54:00:12:34:56'/>
 *         <vlan><tag id='10'/></vlan>
 *       </interface>
 *     </devices>
 *   </domain>
 */
const parseKvmXml = (xml: string, status: VmStatus): VirtualMachine => {
	const result: VirtualMachine = {
		id: "",
		name: "",
		vcpu: 0,
		ramMB: 0,
		diskGB: 0,
		os: "Linux",
		ipAddress: "",
		macAddress: "",
		vlanId: null,
		status,
		hypervisor: "kvm",
	};

	// name
	const nameMatch = xml.match(/<name>([^<]+)<\/name>/);
	if (nameMatch && nameMatch[1]) { result.name = nameMatch[1].trim(); result.id = result.name; }

	// vcpu
	const vcpuMatch = xml.match(/<vcpu[^>]*>(\d+)<\/vcpu>/);
	if (vcpuMatch && vcpuMatch[1]) result.vcpu = parseInt(vcpuMatch[1], 10);

	// memory (KiB -> MB)
	const memMatch = xml.match(/<memory\s+unit=['"]?KiB['"]?>(\d+)<\/memory>/);
	if (memMatch && memMatch[1]) result.ramMB = Math.round(parseInt(memMatch[1], 10) / 1024);
	const memMatch2 = xml.match(/<memory\s+unit=['"]?MiB['"]?>(\d+)<\/memory>/);
	if (memMatch2 && memMatch2[1]) result.ramMB = parseInt(memMatch2[1], 10);
	const memMatch3 = xml.match(/<memory\s+unit=['"]?GiB['"]?>(\d+)<\/memory>/);
	if (memMatch3 && memMatch3[1]) result.ramMB = parseInt(memMatch3[1], 10) * 1024;

	// mac address (first interface)
	const macMatch = xml.match(/<mac\s+address=['"]([0-9a-fA-F:]{17})['"]\/?>/);
	if (macMatch && macMatch[1]) result.macAddress = macMatch[1];

	// vlan tag
	const vlanMatch = xml.match(/<tag\s+id=['"]?(\d+)['"]?/);
	if (vlanMatch && vlanMatch[1]) result.vlanId = parseInt(vlanMatch[1], 10);

	// disk capacity (bytes -> GB)
	const diskMatch = xml.match(/<capacity\s+unit=['"]?bytes['"]?>(\d+)<\/capacity>/);
	if (diskMatch && diskMatch[1]) result.diskGB = Math.round(parseInt(diskMatch[1], 10) / (1024 * 1024 * 1024));
	const diskMatch2 = xml.match(/<capacity\s+unit=['"]?GiB['"]?>(\d+)<\/capacity>/);
	if (diskMatch2 && diskMatch2[1]) result.diskGB = parseInt(diskMatch2[1], 10);

	return result;
};

// -- ESXi parser --

/**
 * Parse `vim-cmd vmsvc/getallvms` output:
 *   Vmid   Name                          File                           Guest OS         Version   Annotation
 *   100    vm-ubuntu-01                  [datastore1] vm-ubuntu-01/vm-ubuntu-01.vmx   ubuntu64Guest   vmx-13
 *   101    vm-windows-01                 [datastore1] vm-windows-01/vm-windows-01.vmx  windows2019srv_64Guest vmx-13
 */
const parseEsxiList = (output: string): { id: string; name: string; os: string }[] => {
	const vms: { id: string; name: string; os: string }[] = [];
	const lines = output.trim().split("\n");
	// Skip header line
	for (let i = 1; i < lines.length; i++) {
		const line = (lines[i] ?? "").trim();
		if (!line) continue;
		// Vmid is first column, then name, then file path, then guest OS
		const parts = line.split(/\s+/);
		if (parts.length < 4) continue;
		const id = parts[0] ?? "";
		// Name can have spaces, but in ESXi output it's usually one token
		// Find guest OS (before Version column which starts with "vmx-")
		const vmxIdx = parts.findIndex((p) => p.startsWith("vmx-"));
		if (vmxIdx < 2) continue;
		const os = parts[vmxIdx - 1] ?? "";
		const name = parts.slice(1, vmxIdx - 1).join(" ") || parts[1] || "";
		vms.push({ id, name, os: esxiGuestOsToString(os) });
	}
	return vms;
};

/** Convert ESXi guest OS code to human-readable name. */
const esxiGuestOsToString = (guest: string): string => {
	const map: Record<string, string> = {
		"ubuntu64Guest": "Ubuntu (64-bit)",
		"ubuntuGuest": "Ubuntu (32-bit)",
		"debian64Guest": "Debian (64-bit)",
		"debianGuest": "Debian (32-bit)",
		"centos64Guest": "CentOS (64-bit)",
		"centosGuest": "CentOS (32-bit)",
		"rhel8_64Guest": "RHEL 8 (64-bit)",
		"rhel9_64Guest": "RHEL 9 (64-bit)",
		"windows2019srv_64Guest": "Windows Server 2019 (64-bit)",
		"windows2022srv_64Guest": "Windows Server 2022 (64-bit)",
		"windows2016srv_64Guest": "Windows Server 2016 (64-bit)",
		"win11_64Guest": "Windows 11 (64-bit)",
		"win10_64Guest": "Windows 10 (64-bit)",
		"otherLinux64Guest": "Other Linux (64-bit)",
		"otherGuest": "Other OS",
	};
	return map[guest] ?? guest;
};

/**
 * Parse `vim-cmd vmsvc/get.summary <vmid>` output (key=value pairs):
 *   name = "vm-ubuntu-01",
 *   powerstate = "poweredOn",
 *   numcpu = 4,
 *   memorysize = 17179869184,
 *   ... (memorysize is in bytes)
 */
const parseEsxiSummary = (output: string, vmId: string): Partial<VirtualMachine> => {
	const result: Partial<VirtualMachine> = { id: vmId, status: "stopped", hypervisor: "esxi" };
	const lines = output.split("\n");
	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed) continue;

		const nameMatch = trimmed.match(/^name\s*=\s*"?([^",]+)"?/);
		if (nameMatch && nameMatch[1]) { result.name = nameMatch[1].trim(); continue; }

		const powerMatch = trimmed.match(/^powerstate\s*=\s*"?(\w+)"?/);
		if (powerMatch && powerMatch[1]) {
			const ps = powerMatch[1].toLowerCase();
			result.status = ps.includes("on") ? "running" : ps.includes("suspend") ? "paused" : "stopped";
			continue;
		}

		const cpuMatch = trimmed.match(/^numcpu\s*=\s*(\d+)/);
		if (cpuMatch && cpuMatch[1]) { result.vcpu = parseInt(cpuMatch[1], 10); continue; }

		const memMatch = trimmed.match(/^memorysize\s*=\s*(\d+)/);
		if (memMatch && memMatch[1]) { result.ramMB = Math.round(parseInt(memMatch[1], 10) / (1024 * 1024)); continue; }
	}
	return result;
};

// -- Main parse functions --

/** Parse Proxmox VM list + each VM config into VirtualMachine[].
 * Takes raw outputs from: qm list, then qm config <id> for each VM.
 */
export const parseProxmoxVms = (
	listOutput: string,
	configOutputs: Map<string, string>,
): VirtualMachine[] => {
	const listVms = parseProxmoxList(listOutput);
	const vms: VirtualMachine[] = [];
	for (const vm of listVms) {
		const config = configOutputs.get(vm.id);
		const parsed: VirtualMachine = {
			id: vm.id,
			name: vm.name,
			vcpu: vm.vcpu,
			ramMB: vm.ramMB,
			diskGB: 0,
			os: "",
			ipAddress: "",
			macAddress: "",
			vlanId: null,
			status: vm.status,
			hypervisor: "proxmox",
		};
		if (config) {
			const cfg = parseProxmoxConfig(config);
			if (cfg.vcpu !== undefined) parsed.vcpu = cfg.vcpu;
			if (cfg.ramMB !== undefined) parsed.ramMB = cfg.ramMB;
			parsed.diskGB = cfg.diskGB ?? 0;
			parsed.os = cfg.os ?? "";
			parsed.macAddress = cfg.macAddress ?? "";
			parsed.vlanId = cfg.vlanId ?? null;
			if (cfg.name) parsed.name = cfg.name;
		}
		vms.push(parsed);
	}
	return vms;
};

/** Parse KVM VM list + each VM XML into VirtualMachine[]. */
export const parseKvmVms = (
	listOutput: string,
	xmlOutputs: Map<string, string>,
	statuses: Map<string, VmStatus>,
): VirtualMachine[] => {
	const listVms = parseKvmList(listOutput);
	const vms: VirtualMachine[] = [];
	for (const vm of listVms) {
		const xml = xmlOutputs.get(vm.id) ?? "";
		const status = statuses.get(vm.id) ?? "stopped";
		const parsed = parseKvmXml(xml, status);
		if (!parsed.name) parsed.name = vm.name;
		if (!parsed.id) parsed.id = vm.id;
		vms.push(parsed);
	}
	return vms;
};

/** Parse ESXi VM list + summaries into VirtualMachine[]. */
export const parseEsxiVms = (
	listOutput: string,
	summaryOutputs: Map<string, string>,
): VirtualMachine[] => {
	const listVms = parseEsxiList(listOutput);
	const vms: VirtualMachine[] = [];
	for (const vm of listVms) {
		const summaryRaw = summaryOutputs.get(vm.id) ?? "";
		const summary = parseEsxiSummary(summaryRaw, vm.id);
		const result: VirtualMachine = {
			id: vm.id,
			name: summary.name ?? vm.name,
			vcpu: summary.vcpu ?? 0,
			ramMB: summary.ramMB ?? 0,
			diskGB: 0, // ESXi summary doesn't include disk size directly
			os: vm.os,
			ipAddress: "", // Would need guest.info
			macAddress: "", // Would need vim-cmd vmsvc/get.config
			vlanId: null,
			status: summary.status ?? "stopped",
			hypervisor: "esxi",
		};
		vms.push(result);
	}
	return vms;
};

/**
 * Parse `virsh list --all` output to get status per VM:
 *   Id    Name           State
 *   1     vm-ubuntu-01   running
 *   -     vm-windows-01  shut off
 */
export const parseKvmStatuses = (output: string): Map<string, VmStatus> => {
	const statuses = new Map<string, VmStatus>();
	const lines = output.trim().split("\n");
	for (let i = 1; i < lines.length; i++) {
		const line = (lines[i] ?? "").trim();
		if (!line) continue;
		// Split by whitespace: Id, Name, State
		const parts = line.split(/\s+/);
		if (parts.length < 3) continue;
		// State is last column, Name is middle
		const name = parts.slice(1, -1).join(" ");
		const state = (parts[parts.length - 1] ?? "").toLowerCase();
		const status: VmStatus = state === "running" ? "running" : state.includes("pause") ? "paused" : "stopped";
		statuses.set(name, status);
	}
	return statuses;
};
