import { AppError } from "@/utils/AppError.js";
import { ILogger } from "@/utils/logger.js";
import type { IRouterCommandRunner } from "@/service/network/sshRunner.js";
import type { IServersRepository } from "./server.repository.interface.js";
import type { IMonitorsRepository } from "@/domain/monitors/monitor.repository.interface.js";
import type { Server, ServerResponse, ServerSummary, ServerWithMonitors } from "./server.type.js";
import { computeOverallStatus } from "./server.type.js";
import { parseLldpNeighbors, getLldpCommand, type LldpNeighbor } from "./lldp.parser.js";
import { detectHypervisor, getVmListCommand, getVmDetailCommand, parseProxmoxVms, parseKvmVms, parseEsxiVms, parseKvmStatuses, type VirtualMachine } from "./vm.parser.js";

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
			this.logger.info({
				service: SERVICE_NAME,
				method: "scanVms",
				message: "VM scan complete: " + vms.length + " VMs discovered on " + server.hostname,
			});
			// Auto-save VM names to server
			await this.serversRepository.updateById(serverId, teamId, {
				isVmHost: true,
				vmNames: vms.map((v) => v.name),
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
			this.logger.info({
				service: SERVICE_NAME,
				method: "scanVms",
				message: "VM scan complete: " + vms.length + " VMs discovered on " + server.hostname,
			});
			await this.serversRepository.updateById(serverId, teamId, {
				isVmHost: true,
				vmNames: vms.map((v) => v.name),
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
		this.logger.info({
			service: SERVICE_NAME,
			method: "scanVms",
			message: "VM scan complete: " + vms.length + " VMs discovered on " + server.hostname,
		});
		await this.serversRepository.updateById(serverId, teamId, {
			isVmHost: true,
			vmNames: vms.map((v) => v.name),
		});
		return vms;
	};

	toResponse = (server: Server): ServerResponse => {
		const { sshPassword, userId, teamId, ...rest } = server;
		return {
			...rest,
			sshPasswordSet: !!sshPassword,
		};
	};
}
