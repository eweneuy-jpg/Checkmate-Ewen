import { AppError } from "@/utils/AppError.js";
import { ILogger } from "@/utils/logger.js";
import type { IRacksRepository } from "./rack.repository.interface.js";
import type { Rack, RackWithSlots, RackSummary } from "./rack.type.js";

const SERVICE_NAME = "RacksService";

export interface IRacksService {
	createRack(data: Partial<Rack>, teamId: string): Promise<Rack>;
	getRack(rackId: string, teamId: string): Promise<Rack>;
	getRacksByTeamId(teamId: string): Promise<RackSummary[]>;
	getRackWithSlots(rackId: string, teamId: string): Promise<RackWithSlots>;
	updateRack(rackId: string, teamId: string, updates: Partial<Rack>): Promise<Rack>;
	deleteRack(rackId: string, teamId: string): Promise<void>;
}

export class RacksService implements IRacksService {
	static SERVICE_NAME = SERVICE_NAME;

	constructor(
		private logger: ILogger,
		private racksRepository: IRacksRepository,
	) {}

	createRack = async (data: Partial<Rack>, teamId: string): Promise<Rack> => {
		if (!data.name || !data.location) {
			throw new AppError({ message: "name and location are required", status: 400, service: SERVICE_NAME });
		}
		const existing = await this.racksRepository.findByName(data.name, teamId);
		if (existing) {
			throw new AppError({ message: `Rack '${data.name}' already exists`, status: 409, service: SERVICE_NAME });
		}
		const created = await this.racksRepository.create({
			teamId,
			name: data.name,
			location: data.location,
			totalU: data.totalU ?? 42,
			description: data.description,
		});
		if (!created) {
			throw new AppError({ message: "Failed to create rack", status: 500, service: SERVICE_NAME });
		}
		this.logger.info({ service: SERVICE_NAME, method: "createRack", message: `Rack created: ${created.name}` });
		return created;
	};

	getRack = async (rackId: string, teamId: string): Promise<Rack> => {
		const rack = await this.racksRepository.findById(rackId, teamId);
		if (!rack) {
			throw new AppError({ message: "Rack not found", status: 404, service: SERVICE_NAME });
		}
		return rack;
	};

	getRacksByTeamId = async (teamId: string): Promise<RackSummary[]> => {
		return await this.racksRepository.findSummariesByTeamId(teamId);
	};

	getRackWithSlots = async (rackId: string, teamId: string): Promise<RackWithSlots> => {
		const rack = await this.racksRepository.findWithSlots(rackId, teamId);
		if (!rack) {
			throw new AppError({ message: "Rack not found", status: 404, service: SERVICE_NAME });
		}
		return rack;
	};

	updateRack = async (rackId: string, teamId: string, updates: Partial<Rack>): Promise<Rack> => {
		const updated = await this.racksRepository.updateById(rackId, teamId, updates);
		if (!updated) {
			throw new AppError({ message: "Rack not found", status: 404, service: SERVICE_NAME });
		}
		return updated;
	};

	deleteRack = async (rackId: string, teamId: string): Promise<void> => {
		const deleted = await this.racksRepository.deleteById(rackId, teamId);
		if (!deleted) {
			throw new AppError({ message: "Rack not found", status: 404, service: SERVICE_NAME });
		}
		this.logger.info({ service: SERVICE_NAME, method: "deleteRack", message: `Rack deleted: ${deleted.name}` });
	};
}
