import type { Server, ServerSummary, ServerWithMonitors } from "./server.type.js";

export interface IServersRepository {
	create(server: Omit<Server, "id" | "createdAt" | "updatedAt">): Promise<Server | null>;
	findById(serverId: string, teamId: string): Promise<Server | null>;
	findByTeamId(teamId: string): Promise<Server[]>;
	findByHostname(hostname: string, teamId: string): Promise<Server | null>;
	findByIpAddress(ip: string, teamId: string): Promise<Server | null>;
	findByMonitorId(monitorId: string): Promise<Server | null>;
	updateById(serverId: string, teamId: string, updates: Partial<Server>): Promise<Server | null>;
	deleteById(serverId: string, teamId: string): Promise<Server | null>;
	linkMonitor(serverId: string, teamId: string, monitorId: string): Promise<Server | null>;
	unlinkMonitor(serverId: string, teamId: string, monitorId: string): Promise<Server | null>;
	findSummariesByTeamId(teamId: string): Promise<ServerSummary[]>;
	findWithMonitors(serverId: string, teamId: string): Promise<ServerWithMonitors | null>;
}
