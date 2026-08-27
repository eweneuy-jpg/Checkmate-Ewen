/**
 * Rack domain — types.
 *
 * A "Rack" is a physical equipment cabinet in a datacenter.
 * Servers are mounted at specific U positions within a rack.
 */
import type { ServerOverallStatus } from "@/domain/servers/server.type.js";

export interface Rack {
	id: string;
	teamId: string;
	/** Rack identifier (e.g. "10-IPDN", "RACK-A1"). */
	name: string;
	/** Datacenter / location name (e.g. "DC-JKT", "10-IPDN NETS4"). */
	location: string;
	/** Total U capacity (typically 42 or 48). */
	totalU: number;
	/** Description / notes. */
	description?: string;
	createdAt: string;
	updatedAt: string;
}

/** Rack with mounted servers rendered as U slots. */
export interface RackWithSlots extends Rack {
	slots: RackSlot[];
}

export interface RackSlot {
	u: number;
	/** Server occupying this U slot, or null if empty. */
	server: {
		id: string;
		hostname: string;
		ipAddress: string;
		hardwareModel?: string;
		role: string;
		projectName?: string;
		isVmHost: boolean;
		vmNames: string[];
		ports: { name: string; label: string; target?: string }[];
		face: string;
		overallStatus: ServerOverallStatus;
		uStart: number;
		uHeight: number;
	} | null;
}

/** Shape returned by API. */
export type RackResponse = Omit<Rack, "teamId">;

/** Summary for list views. */
export interface RackSummary {
	id: string;
	name: string;
	location: string;
	totalU: number;
	usedU: number;
	serverCount: number;
	updatedAt: string;
}
