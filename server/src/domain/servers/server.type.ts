/**
 * Server domain — types and constants.
 *
 * A "Server" is a physical/virtual host that owns one or more monitors.
 * It centralises SSH credentials, hardware metadata, and rack position
 * so Agent Aria and SshCommandProvider can look them up instead of
 * duplicating per-monitor fields.
 */
import type { MonitorStatus } from "@/domain/monitors/monitor.type.js";

export const ServerEnvironments = [
	"production",
	"staging",
	"development",
	"lab",
	"dmz",
] as const;
export type ServerEnvironment = (typeof ServerEnvironments)[number];

export const ServerRoles = [
	"web-service",
	"database",
	"app-server",
	"cache",
	"load-balancer",
	"firewall",
	"router",
	"switch",
	"dns",
	"mail",
	"storage",
	"hypervisor",
	"container",
	"other",
] as const;
export type ServerRole = (typeof ServerRoles)[number];

export const RackFaces = ["front", "back", "both"] as const;
export type RackFace = (typeof RackFaces)[number];

export interface ServerPort {
	name: string;
	label: string;
	target?: string;
}

/** Computed from linked monitors — not stored. */
export const ServerOverallStatuses = [
	"up",
	"down",
	"degraded",
	"paused",
	"unmonitored",
] as const;
export type ServerOverallStatus = (typeof ServerOverallStatuses)[number];

export interface Server {
	id: string;
	teamId: string;
	userId: string;
	hostname: string;
	ipAddress: string;
	description?: string;
	role: ServerRole;
	environment: ServerEnvironment;
	os?: string;
	location?: string;
	sshUsername?: string;
	sshPassword?: string;
	sshPort: number;
	/** Monitor IDs linked to this server. */
	monitors: string[];
	/** Tags for grouping (free-form strings, not ObjectId refs). */
	tags: string[];
	// --- Rack position ---
	/** Rack ID this server is mounted in. */
	rackId?: string;
	/** Starting U position (1-indexed from bottom). */
	uStart?: number;
	/** Height in U units (1U, 2U, etc). */
	uHeight?: number;
	/** Which face of the rack this server occupies. */
	face?: RackFace;
	// --- Hardware metadata ---
	/** Hardware model (e.g. "HP DL360p Gen8", "DELL R420"). */
	hardwareModel?: string;
	/** Serial number / asset tag. */
	serialNumber?: string;
	// --- VM / Project ---
	/** Is this a VM host/hypervisor? */
	isVmHost?: boolean;
	/** VM names running on this host. */
	vmNames?: string[];
	/** Project name this server belongs to (e.g. "10-INTDC0", "APJI"). */
	projectName?: string;
	/** Port assignments (e.g. {name:"Port49", label:"Ke 10-SP"}). */
	ports?: ServerPort[];
	createdAt: string;
	updatedAt: string;
}

/** Shape returned by API — without sensitive fields. */
export type ServerResponse = Omit<Server, "sshPassword" | "userId" | "teamId"> & {
	sshPasswordSet: boolean;
};

/** Summary for list views. */
export interface ServerSummary {
	id: string;
	hostname: string;
	ipAddress: string;
	role: ServerRole;
	environment: ServerEnvironment;
	monitorCount: number;
	overallStatus: ServerOverallStatus;
	rackId?: string;
	rackName?: string;
	uStart?: number;
	uHeight?: number;
	hardwareModel?: string;
	projectName?: string;
	updatedAt: string;
}

export interface ServerWithMonitors extends Server {
	overallStatus: ServerOverallStatus;
	rackName?: string;
	linkedMonitors: {
		id: string;
		name: string;
		type: string;
		status: MonitorStatus;
		url: string;
	}[];
}

/** Compute overall server status from a list of monitor statuses. */
export const computeOverallStatus = (statuses: MonitorStatus[]): ServerOverallStatus => {
	if (statuses.length === 0) return "unmonitored";
	if (statuses.every((s) => s === "paused")) return "paused";
	if (statuses.some((s) => s === "down")) return "down";
	if (statuses.some((s) => s === "breached")) return "degraded";
	return "up";
};
