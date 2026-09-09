import { AppError } from "@/utils/AppError.js";
import { ILogger } from "@/utils/logger.js";
import type { IRouterCommandRunner } from "@/service/network/sshRunner.js";
import type { IServersRepository } from "./server.repository.interface.js";
import type { IMonitorsRepository } from "@/domain/monitors/monitor.repository.interface.js";
import type { Server, ServerResponse, ServerSummary, ServerWithMonitors } from "./server.type.js";
import { computeOverallStatus } from "./server.type.js";
import { parseLldpNeighbors, getLldpCommand, type LldpNeighbor } from "./lldp.parser.js";
import { detectHypervisor, getVmListCommand, getVmDetailCommand, parseProxmoxVms, parseKvmVms, parseEsxiVms, parseKvmStatuses, parseProxmoxGuestIp, parseArpTable, enrichVmsWithIp, getVmIpCommand, parseEsxiGuestIp, parseKvmGuestIp, type VirtualMachine } from "./vm.parser.js";
import { detectProxmoxTemplates, detectKvmTemplates, parseProxmoxVmListEntries, pickFreeVmid, isProxmoxTemplate, buildProxmoxProvisionCommand, buildKvmProvisionCommand, type VmTemplate, type ProvisionVmSpec } from "./vm.provisioner.js";

const SERVICE_NAME = "ServersService";

export interface IServersService {
	createServer(data: Partial<Server>, userId: string, teamId: string): Promise<Server>;
	getServer(serverId: string, teamId: string): Promise<Server>;
	getServersByTeamId(teamId: string): Promise<ServerSummary[]>;
	getServerWithMonitors(serverId: string, teamId: string): Promise<ServerWithMonitors>;
	updateServer(serverId: string, teamId: string, updates: Partial<Server>): Promise<Server>;
	deleteServer(serverId: string, teamId: string): Promise<void>;
	linkMonitor(serverId: string, teamId: string, monitorId: string): Promise<Server>;
	unlinkMonitor(serverId: string, teamId: string, monitorId: string): Promise<Server>;
	findByMonitorId(monitorId: string): Promise<Server | null>;
	scanConnections(serverId: string, teamId: string): Promise<LldpNeighbor[]>;
	scanVms(serverId: string, teamId: string): Promise<VirtualMachine[]>;
	listVmHosts(teamId: string): Promise<Server[]>;
	listVmTemplates(serverId: string, teamId: string): Promise<VmTemplate[]>;
	provisionVm(serverId: string, teamId: string, spec: ProvisionVmSpec): Promise<VirtualMachine>;
	toResponse(server: Server): ServerResponse;
}

export class ServersService implements IServersService {
	static SERVICE_NAME = SERVICE_NAME;

	constructor(
		private logger: ILogger,
		private serversRepository: IServersRepository,
		private monitorsRepository: IMonitorsRepository,
		private sshRunner?: IRouterCommandRunner,
	) {}

	createServer = async (data: Partial<Server>, userId: string, teamId: string): Promise<Server> => {
		if (!data.hostname || !data.ipAddress) {
			throw new AppError({ message: "hostname and ipAddress are required", status: 400, service: SERVICE_NAME });
		}
		const existing = await this.serversRepository.findByHostname(data.hostname, teamId);
		if (existing) {
			throw new AppError({ message: `Server '${data.hostname}' already exists`, status: 409, service: SERVICE_NAME });
		}

		const created = await this.serversRepository.create({
			teamId,
			userId,
			hostname: data.hostname,
			ipAddress: data.ipAddress,
			description: data.description,
			role: data.role ?? "other",
			environment: data.environment ?? "production",
			os: data.os,
			location: data.location,
			sshUsername: data.sshUsername,
			sshPassword: data.sshPassword,
			sshPort: data.sshPort ?? 22,
			monitors: data.monitors ?? [],
			tags: data.tags ?? [],
		});

		if (!created) {
			throw new AppError({ message: "Failed to create server", status: 500, service: SERVICE_NAME });
		}
		this.logger.info({ service: SERVICE_NAME, method: "createServer", message: `Server created: ${created.hostname}` });
		return created;
	};

	getServer = async (serverId: string, teamId: string): Promise<Server> => {
		const server = await this.serversRepository.findById(serverId, teamId);
		if (!server) {
			throw new AppError({ message: "Server not found", status: 404, service: SERVICE_NAME });
		}
		return server;
	};

	getServersByTeamId = async (teamId: string): Promise<ServerSummary[]> => {
		const summaries = await this.serversRepository.findSummariesByTeamId(teamId);
		// Enrich with monitor statuses for overall status
		for (const s of summaries) {
			if (s.monitorCount === 0) continue;
			const server = await this.serversRepository.findById(s.id, teamId);
			if (!server) continue;
			const monitors = await this.monitorsRepository.findByIds(server.monitors);
			const statuses = monitors.map((m) => m.status);
			s.overallStatus = computeOverallStatus(statuses);
		}
		return summaries;
	};

	getServerWithMonitors = async (serverId: string, teamId: string): Promise<ServerWithMonitors> => {
		const server = await this.getServer(serverId, teamId);
		const monitors = await this.monitorsRepository.findByIds(server.monitors);
		const statuses = monitors.map((m) => m.status);
		const overallStatus = computeOverallStatus(statuses);
		return {
			...server,
			overallStatus,
			linkedMonitors: monitors.map((m) => ({
				id: m.id,
				name: m.name,
				type: m.type,
				status: m.status,
				url: m.url,
			})),
		};
	};

	updateServer = async (serverId: string, teamId: string, updates: Partial<Server>): Promise<Server> => {
		const updated = await this.serversRepository.updateById(serverId, teamId, updates);
		if (!updated) {
			throw new AppError({ message: "Server not found", status: 404, service: SERVICE_NAME });
		}
		return updated;
	};

	deleteServer = async (serverId: string, teamId: string): Promise<void> => {
		const deleted = await this.serversRepository.deleteById(serverId, teamId);
		if (!deleted) {
			throw new AppError({ message: "Server not found", status: 404, service: SERVICE_NAME });
		}
		this.logger.info({ service: SERVICE_NAME, method: "deleteServer", message: `Server deleted: ${deleted.hostname}` });
	};

	linkMonitor = async (serverId: string, teamId: string, monitorId: string): Promise<Server> => {
		const updated = await this.serversRepository.linkMonitor(serverId, teamId, monitorId);
		if (!updated) {
			throw new AppError({ message: "Server not found", status: 404, service: SERVICE_NAME });
		}
		this.logger.info({ service: SERVICE_NAME, method: "linkMonitor", message: `Monitor ${monitorId} linked to ${updated.hostname}` });
		return updated;
	};

	unlinkMonitor = async (serverId: string, teamId: string, monitorId: string): Promise<Server> => {
		const updated = await this.serversRepository.unlinkMonitor(serverId, teamId, monitorId);
		if (!updated) {
			throw new AppError({ message: "Server not found", status: 404, service: SERVICE_NAME });
		}
		return updated;
	};

	findByMonitorId = async (monitorId: string): Promise<Server | null> => {
		return await this.serversRepository.findByMonitorId(monitorId);
	};

	listVmHosts = async (teamId: string): Promise<Server[]> => {
		return await this.serversRepository.findVmHosts(teamId);
	};

	private getSshReadyServer = async (serverId: string, teamId: string): Promise<Server> => {
		const server = await this.getServer(serverId, teamId);
		if (!server.sshUsername || !server.sshPassword) {
			throw new AppError({ message: "Server has no SSH credentials configured", status: 400, service: SERVICE_NAME });
		}
		if (!this.sshRunner) {
			throw new AppError({ message: "SSH runner not available — cannot operate on hypervisor", status: 500, service: SERVICE_NAME });
		}
		return server;
	};

	private sshExec = async (server: Server, command: string): Promise<string> => {
		return await this.sshRunner!.exec(
			server.ipAddress,
			server.sshPort ?? 22,
			server.sshUsername ?? "",
			server.sshPassword ?? "",
			command,
		);
	};

	listVmTemplates = async (serverId: string, teamId: string): Promise<VmTemplate[]> => {
		const server = await this.getSshReadyServer(serverId, teamId);
		const hypervisor = detectHypervisor(server.os, server.role);
		if (!hypervisor) {
			throw new AppError({ message: "Could not detect hypervisor type", status: 400, service: SERVICE_NAME });
		}
		if (hypervisor === "esxi") {
			throw new AppError({ message: "ESXi does not support clone-from-template over SSH", status: 400, service: SERVICE_NAME });
		}
		if (hypervisor === "kvm") {
			const output = await this.sshExec(server, "virsh list --all --name");
			return detectKvmTemplates(output);
		}
		// proxmox
		const listOutput = await this.sshExec(server, "qm list");
		const entries = parseProxmoxVmListEntries(listOutput);
		const configOutputs = new Map<string, string>();
		for (const e of entries) {
			try {
				const cfg = await this.sshExec(server, "qm config " + e.id);
				configOutputs.set(String(e.id), cfg);
			} catch {
				// template may be locked/stopped — skip config fetch
			}
		}
		return detectProxmoxTemplates(listOutput, configOutputs);
	};

	provisionVm = async (serverId: string, teamId: string, spec: ProvisionVmSpec): Promise<VirtualMachine> => {
		const server = await this.getSshReadyServer(serverId, teamId);
		const hypervisor = detectHypervisor(server.os, server.role);
		if (!hypervisor) {
			throw new AppError({ message: "Could not detect hypervisor type", status: 400, service: SERVICE_NAME });
		}
		if (hypervisor === "esxi") {
			throw new AppError({ message: "ESXi provisioning is not supported over SSH", status: 400, service: SERVICE_NAME });
		}

		let newId: string;
		let command: string;

		if (hypervisor === "proxmox") {
			// Resolve template + free VMID
			const listOutput = await this.sshExec(server, "qm list");
			const entries = parseProxmoxVmListEntries(listOutput);
			let template: VmTemplate | undefined;
			try {
				const cfg = await this.sshExec(server, "qm config " + spec.templateId);
				if (isProxmoxTemplate(cfg)) {
					const t = detectProxmoxTemplates(listOutput, new Map([[spec.templateId, cfg]]));
					template = t[0];
				}
			} catch {
				template = undefined;
			}
			if (!template) {
				throw new AppError({ message: "Template " + spec.templateId + " not found or is not a template", status: 400, service: SERVICE_NAME });
			}
			const templateIds = entries.filter((e) => e.id >= 9000).map((e) => e.id);
			const freeVmid = pickFreeVmid(entries.map((e) => e.id), templateIds);
			newId = String(freeVmid);
			command = buildProxmoxProvisionCommand(spec, template, freeVmid);
		} else {
			// kvm — virt-clone
			newId = spec.name;
			command = buildKvmProvisionCommand(spec, spec.name);
		}

		this.logger.info({
			service: SERVICE_NAME,
			method: "provisionVm",
			message: "Provisioning VM '" + spec.name + "' on " + server.hostname + " (" + hypervisor + "): " + command,
		});
		try {
			await this.sshExec(server, command);
		} catch (err) {
			throw new AppError({
				message: "VM provisioning failed: " + (err instanceof Error ? err.message : "unknown"),
				status: 500,
				service: SERVICE_NAME,
			});
		}

		// Auto-scan to pick up the new VM record + persist
		const vms = await this.scanVms(serverId, teamId);
		const created = vms.find((v) => v.id === newId || v.name === spec.name);
		if (created) {
			return created;
		}
		// Scan may not show it immediately (qm list races) — return a minimal record
		return {
			id: newId,
			name: spec.name,
			vcpu: spec.vcpu,
			ramMB: spec.ramMB,
			diskGB: spec.diskGB,
			os: "",
			ipAddress: spec.ipAddress ?? "",
			macAddress: "",
			vlanId: spec.vlanTag ?? null,
			status: spec.startVm ? "running" : "stopped",
			hypervisor,
		};
	};

	scanConnections = async (serverId: string, teamId: string): Promise<LldpNeighbor[]> => {
		const server = await this.getServer(serverId, teamId);
		if (!server.sshUsername) {
			throw new AppError({ message: "Server has no SSH username configured", status: 400, service: SERVICE_NAME });
		}
		if (!server.sshPassword) {
			throw new AppError({ message: "Server has no SSH password configured", status: 400, service: SERVICE_NAME });
		}
		if (!this.sshRunner) {
			throw new AppError({ message: "SSH runner not available — cannot scan", status: 500, service: SERVICE_NAME });
		}

		const command = getLldpCommand(server.os, server.role);
		this.logger.info({
			service: SERVICE_NAME,
			method: "scanConnections",
			message: `LLDP scan: SSH ${server.sshUsername}@${server.ipAddress}:${server.sshPort} — ${command}`,
		});

		const rawOutput = await this.sshRunner.exec(
			server.ipAddress,
			server.sshPort ?? 22,
			server.sshUsername,
			server.sshPassword,
			command,
		);

		const neighbors = parseLldpNeighbors(rawOutput);
		this.logger.info({
			service: SERVICE_NAME,
			method: "scanConnections",
			message: `LLDP scan complete: ${neighbors.length} neighbors discovered on ${server.hostname}`,
		});

		return neighbors;
	};

	scanVms = async (serverId: string, teamId: string): Promise<VirtualMachine[]> => {
		const server = await this.getServer(serverId, teamId);
		if (!server.sshUsername) {
			throw new AppError({ message: "Server has no SSH username configured", status: 400, service: SERVICE_NAME });
		}
		if (!server.sshPassword) {
			throw new AppError({ message: "Server has no SSH password configured", status: 400, service: SERVICE_NAME });
		}
		if (!this.sshRunner) {
			throw new AppError({ message: "SSH runner not available -- cannot scan", status: 500, service: SERVICE_NAME });
		}

		const hypervisor = detectHypervisor(server.os, server.role);
		if (!hypervisor) {
			throw new AppError({
				message: "Could not detect hypervisor type. Set server OS to 'proxmox', 'esxi', or 'kvm'.",
				status: 400,
				service: SERVICE_NAME,
			});
		}

		this.logger.info({
			service: SERVICE_NAME,
			method: "scanVms",
			message: "VM scan: SSH " + server.sshUsername + "@" + server.ipAddress + ":" + server.sshPort + " -- hypervisor=" + hypervisor,
		});

		// Step 1: Get VM list
		const listCmd = getVmListCommand(hypervisor);
		const listOutput = await this.sshRunner.exec(
			server.ipAddress,
			server.sshPort,
			server.sshUsername,
			server.sshPassword,
			listCmd,
		);

		if (hypervisor === "proxmox") {
			// Step 2: Get config for each VM
			const listVms = parseProxmoxVms(listOutput, new Map());
			const configOutputs = new Map<string, string>();
			for (const vm of listVms) {
				const detailCmd = getVmDetailCommand("proxmox", vm.id);
				try {
					const configOutput = await this.sshRunner.exec(
						server.ipAddress,
						server.sshPort ?? 22,
						server.sshUsername,
						server.sshPassword,
						detailCmd,
					);
					configOutputs.set(vm.id, configOutput);
				} catch {
					// Skip VMs that fail config fetch
				}
			}
			const vms = parseProxmoxVms(listOutput, configOutputs);
			// Best-effort IP discovery (guest agent, then ARP fallback)
			await this.discoverVmIps(server, hypervisor, vms);
			this.logger.info({
				service: SERVICE_NAME,
				method: "scanVms",
				message: "VM scan complete: " + vms.length + " VMs discovered on " + server.hostname,
			});
			// Auto-save full VM records to server
			await this.serversRepository.updateById(serverId, teamId, {
				isVmHost: true,
				vmNames: vms.map((v) => v.name),
				vms: vms as unknown as Server["vms"],
			});
			return vms;
		}

		if (hypervisor === "kvm") {
			// Step 2: Get status for each VM
			const statusOutput = await this.sshRunner.exec(
				server.ipAddress,
				server.sshPort ?? 22,
				server.sshUsername,
				server.sshPassword,
				"virsh list --all",
			);
			const statuses = parseKvmStatuses(statusOutput);

			// Step 3: Get XML for each VM
			const xmlOutputs = new Map<string, string>();
			const listVms = listOutput.trim().split("\n").map((l) => l.trim()).filter(Boolean);
			for (const vmName of listVms) {
				try {
					const xmlOutput = await this.sshRunner.exec(
						server.ipAddress,
						server.sshPort ?? 22,
						server.sshUsername,
						server.sshPassword,
						"virsh dumpxml " + vmName,
					);
					xmlOutputs.set(vmName, xmlOutput);
				} catch {
					// Skip VMs that fail XML fetch
				}
			}
			const vms = parseKvmVms(listOutput, xmlOutputs, statuses);
			// Best-effort IP discovery (guest agent, then ARP fallback)
			await this.discoverVmIps(server, hypervisor, vms);
			this.logger.info({
				service: SERVICE_NAME,
				method: "scanVms",
				message: "VM scan complete: " + vms.length + " VMs discovered on " + server.hostname,
			});
			await this.serversRepository.updateById(serverId, teamId, {
				isVmHost: true,
				vmNames: vms.map((v) => v.name),
				vms: vms as unknown as Server["vms"],
			});
			return vms;
		}

		// ESXi
		const summaryOutputs = new Map<string, string>();
		// Parse list to get VM IDs
		const esxiListLines = listOutput.trim().split("\n").slice(1);
		for (const line of esxiListLines) {
			const parts = line.trim().split(/\s+/);
			if (parts.length < 4) continue;
			const vmId = parts[0];
			if (!vmId) continue;
			try {
				const summaryOutput = await this.sshRunner.exec(
					server.ipAddress,
					server.sshPort ?? 22,
					server.sshUsername,
					server.sshPassword,
					"vim-cmd vmsvc/get.summary " + vmId,
				);
				summaryOutputs.set(vmId, summaryOutput);
			} catch {
				// Skip VMs that fail summary fetch
			}
		}
		const vms = parseEsxiVms(listOutput, summaryOutputs);
		// Best-effort IP discovery (guest agent, then ARP fallback)
		await this.discoverVmIps(server, "esxi", vms);
		this.logger.info({
			service: SERVICE_NAME,
			method: "scanVms",
			message: "VM scan complete: " + vms.length + " VMs discovered on " + server.hostname,
		});
		await this.serversRepository.updateById(serverId, teamId, {
			isVmHost: true,
			vmNames: vms.map((v) => v.name),
			vms: vms as unknown as Server["vms"],
		});
		return vms;
	};

	/**
	 * Best-effort IP discovery for scanned VMs.
	 * 1. Guest-agent path per hypervisor (qm guest cmd / virsh domifaddr / vim-cmd get.guest)
	 * 2. ARP table fallback on the hypervisor (cross-ref by MAC).
	 * Failures are silent — IP stays "" rather than failing the scan.
	 */
	discoverVmIps = async (
		server: Server,
		hypervisor: "proxmox" | "kvm" | "esxi",
		vms: VirtualMachine[],
	): Promise<void> => {
		if (!this.sshRunner || vms.length === 0) return;
		const exec = (cmd: string) =>
			this.sshRunner!.exec(server.ipAddress, server.sshPort ?? 22, server.sshUsername ?? "", server.sshPassword ?? "", cmd);

		// 1. Guest agent per running VM without an IP yet
		for (const vm of vms) {
			if (vm.ipAddress) continue;
			const cmd = getVmIpCommand(hypervisor, vm.id, vm.name, vm.status);
			if (!cmd) continue;
			try {
				const output = await exec(cmd);
				let ip = "";
				if (hypervisor === "proxmox") ip = parseProxmoxGuestIp(output);
				else if (hypervisor === "kvm") ip = parseKvmGuestIp(output);
				else ip = parseEsxiGuestIp(output);
				if (ip) vm.ipAddress = ip;
			} catch {
				// guest agent unavailable (not installed / VM agent off) — fall through to ARP
			}
		}

		// 2. ARP table fallback for VMs still missing an IP
		const missing = vms.filter((v) => !v.ipAddress);
		if (missing.length === 0) return;
		try {
			const arpOutput = await exec("ip neigh");
			const macToIp = parseArpTable(arpOutput);
			enrichVmsWithIp(missing, macToIp);
		} catch {
			// no arp on this host — leave IPs empty
		}
	};

	toResponse = (server: Server): ServerResponse => {
		const { sshPassword, userId, teamId, ...rest } = server;
		return {
			...rest,
			sshPasswordSet: !!sshPassword,
		};
	};
}
