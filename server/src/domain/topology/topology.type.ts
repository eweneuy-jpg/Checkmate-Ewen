import type { Monitor, MonitorStatus, MonitorType } from "@/domain/monitors/monitor.type.js";

/** Status visual node topologi — dipetakan dari MonitorStatus. */
export type TopologyNodeState = "ok" | "down" | "paused" | "degraded" | "unknown";

export interface TopologyNode {
	id: string;
	name: string;
	type: MonitorType;
	state: TopologyNodeState;
	status: MonitorStatus;
	uptimePercentage?: number;
	/** Group/tag tempat monitor berada — dipakai untuk edge inference & clustering. */
	group: string | null;
}

export interface TopologyEdge {
	id: string;
	source: string;
	target: string;
	/** Bagaimana edge ini disimpulkan. */
	kind: "group" | "subnet";
	/** True bila salah satu ujung edge sedang down — untuk styling merah di client. */
	impaired: boolean;
}

export interface TopologyGraph {
	nodes: TopologyNode[];
	edges: TopologyEdge[];
	summary: Record<TopologyNodeState, number>;
	generatedAt: string;
}

export const mapStatusToNodeState = (status: MonitorStatus): TopologyNodeState => {
	switch (status) {
		case "up":
			return "ok";
		case "down":
			return "down";
		case "paused":
		case "maintenance":
			return "paused";
		case "breached":
		case "initializing":
			return "degraded";
		default:
			return "unknown";
	}
};

/** Warna hex per state — satu sumber kebenaran untuk legend client & docs. */
export const TOPOLOGY_STATE_COLORS: Record<TopologyNodeState, string> = {
	ok: "#22c55e",
	down: "#ef4444",
	paused: "#9ca3af",
	degraded: "#f97316",
	unknown: "#64748b",
};

/** Ambil /24 pertama dari URL monitor bila berupa IPv4 — dasar edge inference per-subnet. */
export const subnet24Of = (url: string | undefined): string | null => {
	if (!url) return null;
	const m = url.match(/\b(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.\d{1,3}\b/);
	if (!m) return null;
	const octets = [Number(m[1]), Number(m[2]), Number(m[3])];
	if (octets.some((o) => o > 255)) return null;
	return octets.join(".");
};

export interface ITopologyService {
	buildGraph(teamId: string): Promise<TopologyGraph>;
}
