import { Types } from "mongoose";
import ServerModel, { type ServerDocument } from "./server.model.js";
import type { IServersRepository } from "./server.repository.interface.js";
import type { Server, ServerSummary, ServerWithMonitors } from "./server.type.js";
import { computeOverallStatus } from "./server.type.js";
import type { MonitorStatus } from "@/domain/monitors/monitor.type.js";

const toDomain = (doc: ServerDocument | null): Server | null => {
	if (!doc) return null;
	return {
		id: doc._id.toString(),
		teamId: doc.teamId.toString(),
		userId: doc.userId.toString(),
		hostname: doc.hostname,
		ipAddress: doc.ipAddress,
		description: doc.description,
		role: doc.role,
		environment: doc.environment,
		os: doc.os,
		location: doc.location,
		sshUsername: doc.sshUsername,
		sshPassword: doc.sshPassword,
		sshPort: doc.sshPort,
		monitors: doc.monitors.map((m) => m.toString()),
		tags: doc.tags,
		// Rack position
		rackId: doc.rackId?.toString(),
		uStart: doc.uStart,
		uHeight: doc.uHeight,
		face: doc.face,
		// Hardware
		hardwareModel: doc.hardwareModel,
		serialNumber: doc.serialNumber,
		// VM / Project
		isVmHost: doc.isVmHost,
		vmNames: doc.vmNames,
		projectName: doc.projectName,
		ports: doc.ports,
		createdAt: doc.createdAt.toISOString(),
		updatedAt: doc.updatedAt.toISOString(),
	};
};

export class MongoServersRepository implements IServersRepository {
	create = async (data: Omit<Server, "id" | "createdAt" | "updatedAt">): Promise<Server | null> => {
		const doc = await ServerModel.create({
			userId: new Types.ObjectId(data.userId),
			teamId: new Types.ObjectId(data.teamId),
			hostname: data.hostname,
			ipAddress: data.ipAddress,
			description: data.description,
			role: data.role,
			environment: data.environment,
			os: data.os,
			location: data.location,
			sshUsername: data.sshUsername,
			sshPassword: data.sshPassword,
			sshPort: data.sshPort,
			monitors: data.monitors?.map((m) => new Types.ObjectId(m)) ?? [],
			tags: data.tags ?? [],
		});
		return toDomain(doc);
	};

	findById = async (serverId: string, teamId: string): Promise<Server | null> => {
		const doc = await ServerModel.findOne({
			_id: new Types.ObjectId(serverId),
			teamId: new Types.ObjectId(teamId),
		});
		return toDomain(doc);
	};

	findByTeamId = async (teamId: string): Promise<Server[]> => {
		const docs = await ServerModel.find({ teamId: new Types.ObjectId(teamId) }).lean();
		return docs.map((d) => toDomain(d as ServerDocument)!);
	};

	findByHostname = async (hostname: string, teamId: string): Promise<Server | null> => {
		const doc = await ServerModel.findOne({
			hostname,
			teamId: new Types.ObjectId(teamId),
		});
		return toDomain(doc);
	};

	findByIpAddress = async (ip: string, teamId: string): Promise<Server | null> => {
		const doc = await ServerModel.findOne({
			ipAddress: ip,
			teamId: new Types.ObjectId(teamId),
		});
		return toDomain(doc);
	};

	findByMonitorId = async (monitorId: string): Promise<Server | null> => {
		const doc = await ServerModel.findOne({
			monitors: new Types.ObjectId(monitorId),
		});
		return toDomain(doc);
	};

	updateById = async (serverId: string, teamId: string, updates: Partial<Server>): Promise<Server | null> => {
		const doc = await ServerModel.findOneAndUpdate(
			{ _id: new Types.ObjectId(serverId), teamId: new Types.ObjectId(teamId) },
			{ $set: updates },
			{ new: true },
		);
		return toDomain(doc);
	};

	deleteById = async (serverId: string, teamId: string): Promise<Server | null> => {
		const doc = await ServerModel.findOneAndDelete({
			_id: new Types.ObjectId(serverId),
			teamId: new Types.ObjectId(teamId),
		});
		return toDomain(doc);
	};

	linkMonitor = async (serverId: string, teamId: string, monitorId: string): Promise<Server | null> => {
		const doc = await ServerModel.findOneAndUpdate(
			{ _id: new Types.ObjectId(serverId), teamId: new Types.ObjectId(teamId) },
			{ $addToSet: { monitors: new Types.ObjectId(monitorId) } },
			{ new: true },
		);
		return toDomain(doc);
	};

	unlinkMonitor = async (serverId: string, teamId: string, monitorId: string): Promise<Server | null> => {
		const doc = await ServerModel.findOneAndUpdate(
			{ _id: new Types.ObjectId(serverId), teamId: new Types.ObjectId(teamId) },
			{ $pull: { monitors: new Types.ObjectId(monitorId) } },
			{ new: true },
		);
		return toDomain(doc);
	};

	findSummariesByTeamId = async (teamId: string): Promise<ServerSummary[]> => {
		const servers = await this.findByTeamId(teamId);
		// Note: overallStatus is computed in service layer (needs monitor statuses)
		return servers.map((s) => ({
			id: s.id,
			hostname: s.hostname,
			ipAddress: s.ipAddress,
			role: s.role,
			environment: s.environment,
			monitorCount: s.monitors.length,
			overallStatus: "unmonitored" as const,
			updatedAt: s.updatedAt,
		}));
	};

	findWithMonitors = async (serverId: string, teamId: string): Promise<ServerWithMonitors | null> => {
		const server = await this.findById(serverId, teamId);
		if (!server) return null;
		// Monitor details fetched in service layer
		return {
			...server,
			overallStatus: "unmonitored",
			linkedMonitors: [],
		};
	};
}
