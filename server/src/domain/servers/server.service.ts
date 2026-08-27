import { AppError } from "@/utils/AppError.js";
import { ILogger } from "@/utils/logger.js";
import type { IServersRepository } from "./server.repository.interface.js";
import type { IMonitorsRepository } from "@/domain/monitors/monitor.repository.interface.js";
import type { Server, ServerResponse, ServerSummary, ServerWithMonitors } from "./server.type.js";
import { computeOverallStatus } from "./server.type.js";

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
	toResponse(server: Server): ServerResponse;
}

export class ServersService implements IServersService {
	static SERVICE_NAME = SERVICE_NAME;

	constructor(
		private logger: ILogger,
		private serversRepository: IServersRepository,
		private monitorsRepository: IMonitorsRepository,
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

	toResponse = (server: Server): ServerResponse => {
		const { sshPassword, userId, teamId, ...rest } = server;
		return {
			...rest,
			sshPasswordSet: !!sshPassword,
		};
	};
}
