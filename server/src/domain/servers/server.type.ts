/**
 * Server domain — types and constants.
 *
 * A "Server" is a physical/virtual host that owns one or more monitors.
 * It centralises SSH credentials and metadata so Agent Aria and
 * SshCommandProvider can look them up instead of duplicating per-monitor.
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
	updatedAt: string;
}

export interface ServerWithMonitors extends Server {
	overallStatus: ServerOverallStatus;
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
