import { Types } from "mongoose";
import { RackModel, type RackDocument } from "./rack.model.js";
import type { IRacksRepository } from "./rack.repository.interface.js";
import type { Rack, RackWithSlots, RackSummary } from "./rack.type.js";
import type { Server } from "@/domain/servers/server.type.js";
import type { MonitorStatus } from "@/domain/monitors/monitor.type.js";
import { computeOverallStatus } from "@/domain/servers/server.type.js";
import ServerModel from "@/domain/servers/server.model.js";
import { IMonitorsRepository } from "@/domain/monitors/monitor.repository.interface.js";

const toDomain = (doc: RackDocument | null): Rack | null => {
	if (!doc) return null;
	return {
		id: doc._id.toString(),
		teamId: doc.teamId.toString(),
		name: doc.name,
		location: doc.location,
		totalU: doc.totalU,
		description: doc.description,
		createdAt: doc.createdAt.toISOString(),
		updatedAt: doc.updatedAt.toISOString(),
	};
};

export class MongoRacksRepository implements IRacksRepository {
	constructor(private monitorsRepository?: IMonitorsRepository) {}

	create = async (data: Omit<Rack, "id" | "createdAt" | "updatedAt">): Promise<Rack | null> => {
		const doc = await RackModel.create({
			teamId: new Types.ObjectId(data.teamId),
			name: data.name,
			location: data.location,
			totalU: data.totalU,
			description: data.description,
		});
		return toDomain(doc);
	};

	findById = async (rackId: string, teamId: string): Promise<Rack | null> => {
		const doc = await RackModel.findOne({
			_id: new Types.ObjectId(rackId),
			teamId: new Types.ObjectId(teamId),
		});
		return toDomain(doc);
	};

	findByTeamId = async (teamId: string): Promise<Rack[]> => {
		const docs = await RackModel.find({ teamId: new Types.ObjectId(teamId) }).lean();
		return docs.map((d) => toDomain(d as RackDocument)!);
	};

	findByName = async (name: string, teamId: string): Promise<Rack | null> => {
		const doc = await RackModel.findOne({ name, teamId: new Types.ObjectId(teamId) });
		return toDomain(doc);
	};

	updateById = async (rackId: string, teamId: string, updates: Partial<Rack>): Promise<Rack | null> => {
		const doc = await RackModel.findOneAndUpdate(
			{ _id: new Types.ObjectId(rackId), teamId: new Types.ObjectId(teamId) },
			{ $set: updates },
			{ new: true },
		);
		return toDomain(doc);
	};

	deleteById = async (rackId: string, teamId: string): Promise<Rack | null> => {
		const doc = await RackModel.findOneAndDelete({
			_id: new Types.ObjectId(rackId),
			teamId: new Types.ObjectId(teamId),
		});
		return toDomain(doc);
	};

	findSummariesByTeamId = async (teamId: string): Promise<RackSummary[]> => {
		const racks = await this.findByTeamId(teamId);
		const summaries: RackSummary[] = [];
		for (const rack of racks) {
			const servers = await ServerModel.find({
				rackId: new Types.ObjectId(rack.id),
			}).lean();
			const usedU = servers.reduce((sum, s) => sum + (s.uHeight || 1), 0);
			summaries.push({
				id: rack.id,
				name: rack.name,
				location: rack.location,
				totalU: rack.totalU,
				usedU,
				serverCount: servers.length,
				updatedAt: rack.updatedAt,
			});
		}
		return summaries;
	};

	findWithSlots = async (rackId: string, teamId: string): Promise<RackWithSlots | null> => {
		const rack = await this.findById(rackId, teamId);
		if (!rack) return null;

		const serverDocs = await ServerModel.find({
			rackId: new Types.ObjectId(rackId),
			teamId: new Types.ObjectId(teamId),
		}).lean();

		// Build server map with overall status
		const serverMap = new Map<string, { server: Server; overallStatus: ServerOverallStatus }>();
		for (const sd of serverDocs) {
			const server: Server = {
				id: sd._id.toString(),
				teamId: sd.teamId.toString(),
				userId: sd.userId.toString(),
				hostname: sd.hostname,
				ipAddress: sd.ipAddress,
				description: sd.description,
				role: sd.role,
				environment: sd.environment,
				os: sd.os,
				location: sd.location,
				sshUsername: sd.sshUsername,
				sshPassword: sd.sshPassword,
				sshPort: sd.sshPort,
				monitors: sd.monitors?.map((m: Types.ObjectId) => m.toString()) ?? [],
				tags: sd.tags ?? [],
				rackId: sd.rackId?.toString(),
				uStart: sd.uStart,
				uHeight: sd.uHeight,
				face: sd.face,
				hardwareModel: sd.hardwareModel,
				serialNumber: sd.serialNumber,
				isVmHost: sd.isVmHost,
				vmNames: sd.vmNames ?? [],
				projectName: sd.projectName,
				ports: sd.ports ?? [],
				createdAt: sd.createdAt.toISOString(),
				updatedAt: sd.updatedAt.toISOString(),
			};
			let overallStatus: ServerOverallStatus = "unmonitored";
			if (this.monitorsRepository && server.monitors.length > 0) {
				try {
					const monitors = await this.monitorsRepository.findByIds(server.monitors);
					const statuses = monitors.map((m) => m.status);
					overallStatus = computeOverallStatus(statuses);
				} catch {
					// best-effort
				}
			}
			serverMap.set(server.id, { server, overallStatus });
		}

		// Build U slots (top to bottom, U=totalU at top)
		const slots: RackWithSlots["slots"] = [];
		for (let u = rack.totalU; u >= 1; u--) {
			const entry = [...serverMap.values()].find(
				({ server }) => server.uStart && server.uStart <= u && u < server.uStart + (server.uHeight || 1),
			);
			if (entry) {
				const { server, overallStatus } = entry;
				slots.push({
					u,
					server: {
						id: server.id,
						hostname: server.hostname,
						ipAddress: server.ipAddress,
						hardwareModel: server.hardwareModel,
						role: server.role,
						projectName: server.projectName,
						isVmHost: server.isVmHost ?? false,
						vmNames: server.vmNames ?? [],
						ports: server.ports ?? [],
						face: server.face ?? "front",
						overallStatus,
						uStart: server.uStart!,
						uHeight: server.uHeight ?? 1,
					},
				});
			} else {
				slots.push({ u, server: null });
			}
		}

		return { ...rack, slots };
	};
}

// Import inline to avoid circular deps
import type { ServerOverallStatus } from "@/domain/servers/server.type.js";
