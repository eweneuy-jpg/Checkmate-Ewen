import type { IMonitorsRepository } from "@/domain/monitors/monitor.repository.interface.js";
import type { Monitor } from "@/domain/monitors/monitor.type.js";
import {
	ITopologyService,
	TopologyEdge,
	TopologyGraph,
	TopologyNode,
	TopologyNodeState,
	mapStatusToNodeState,
	subnet24Of,
} from "./topology.type.js";

const SERVICE_NAME = "TopologyService";

export interface TopologyServiceDeps {
	monitorsRepository: IMonitorsRepository;
}

/**
 * Membangun graph topologi dari monitor milik sebuah team.
 *
 * Edge disimpulkan (inference), bukan dikonfigurasi manual:
 * - "group":   monitor dalam group yang sama dihubungkan berantai (ring)
 * - "subnet":  monitor dengan URL IPv4 dalam /24 yang sama saling terhubung
 *
 * Heuristik ini cocok untuk jaringan yang dimonitor via ssh-command/bgp
 * di mana target adalah IP perangkat dalam segmen yang sama.
 */
export class TopologyService implements ITopologyService {
	static SERVICE_NAME = SERVICE_NAME;

	constructor(private deps: TopologyServiceDeps) {}

	async buildGraph(teamId: string): Promise<TopologyGraph> {
		const monitors = await this.deps.monitorsRepository.findByTeamId(teamId, {});

		const nodes: TopologyNode[] = monitors.map((m) => ({
			id: m.id,
			name: m.name,
			type: m.type,
			status: m.status,
			state: mapStatusToNodeState(m.status),
			uptimePercentage: m.uptimePercentage,
			group: m.group ?? null,
		}));

		const edges = this.inferEdges(monitors);
		const summary = nodes.reduce(
			(acc, n) => {
				acc[n.state] += 1;
				return acc;
			},
			{ ok: 0, down: 0, paused: 0, degraded: 0, unknown: 0 } as Record<TopologyNodeState, number>
		);

		return { nodes, edges, summary, generatedAt: new Date().toISOString() };
	}

	private inferEdges(monitors: Monitor[]): TopologyEdge[] {
		const edges: TopologyEdge[] = [];
		const seen = new Set<string>();
		const stateOf = new Map(monitors.map((m) => [m.id, mapStatusToNodeState(m.status)]));

		const pushEdge = (a: string, b: string, kind: TopologyEdge["kind"]) => {
			const key = [a, b].sort().join("|");
			if (a === b || seen.has(key)) return;
			seen.add(key);
			edges.push({
				id: `e-${key}`,
				source: a,
				target: b,
				kind,
				impaired: stateOf.get(a) === "down" || stateOf.get(b) === "down",
			});
		};

		// Group ring: hubungkan anggota group secara berantai
		const byGroup = new Map<string, Monitor[]>();
		for (const m of monitors) {
			if (!m.group) continue;
			byGroup.set(m.group, [...(byGroup.get(m.group) ?? []), m]);
		}
		for (const members of byGroup.values()) {
			for (let i = 0; i < members.length; i++) {
				pushEdge(members[i]!.id, members[(i + 1) % members.length]!.id, "group");
			}
		}

		// Subnet /24 mesh: perangkat dalam segmen yang sama
		const bySubnet = new Map<string, Monitor[]>();
		for (const m of monitors) {
			const net = subnet24Of(m.url);
			if (!net) continue;
			bySubnet.set(net, [...(bySubnet.get(net) ?? []), m]);
		}
		for (const members of bySubnet.values()) {
			for (let i = 0; i < members.length; i++) {
				for (let j = i + 1; j < members.length; j++) {
					pushEdge(members[i]!.id, members[j]!.id, "subnet");
				}
			}
		}

		return edges;
	}
}
