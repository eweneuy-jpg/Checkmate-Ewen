import type { Rack, RackWithSlots, RackSummary } from "./rack.type.js";

export interface IRacksRepository {
	create(data: Omit<Rack, "id" | "createdAt" | "updatedAt">): Promise<Rack | null>;
	findById(rackId: string, teamId: string): Promise<Rack | null>;
	findByTeamId(teamId: string): Promise<Rack[]>;
	findByName(name: string, teamId: string): Promise<Rack | null>;
	updateById(rackId: string, teamId: string, updates: Partial<Rack>): Promise<Rack | null>;
	deleteById(rackId: string, teamId: string): Promise<Rack | null>;
	findSummariesByTeamId(teamId: string): Promise<RackSummary[]>;
	findWithSlots(rackId: string, teamId: string): Promise<RackWithSlots | null>;
}
