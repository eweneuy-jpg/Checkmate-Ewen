import { useMemo } from "react";
import { Box, Stack, Typography, useTheme } from "@mui/material";
import { BasePage } from "@/Components/design-elements";
import { useGet } from "@/Hooks/UseApi";
import type { MonitorType, MonitorStatus } from "@/Types/Monitor";

type NodeState = "ok" | "down" | "paused" | "degraded" | "unknown";

interface TopologyNode {
	id: string;
	name: string;
	type: MonitorType;
	state: NodeState;
	status: MonitorStatus;
	uptimePercentage?: number;
	group: string | null;
}

interface TopologyEdge {
	id: string;
	source: string;
	target: string;
	kind: "group" | "subnet";
	impaired: boolean;
}

interface TopologyGraph {
	nodes: TopologyNode[];
	edges: TopologyEdge[];
	summary: Record<NodeState, number>;
	generatedAt: string;
}

const STATE_COLORS: Record<NodeState, string> = {
	ok: "#22c55e",
	down: "#ef4444",
	paused: "#9ca3af",
	degraded: "#f97316",
	unknown: "#64748b",
};

const STATE_LABELS: Record<NodeState, string> = {
	ok: "OK (up)",
	down: "Down",
	paused: "Paused / Maintenance",
	degraded: "Degraded / Initializing",
	unknown: "Unknown",
};

const NODE_W = 200;
const NODE_H = 64;
const COL_GAP = 260;
const ROW_GAP = 96;
const PER_COL = 8;

/** Layout grid sederhana — tidak butuh library graph tambahan. */
const layoutNodes = (nodes: TopologyNode[]) =>
	nodes.map((n, i) => ({
		...n,
		x: 40 + Math.floor(i / PER_COL) * COL_GAP,
		y: 40 + (i % PER_COL) * ROW_GAP,
	}));

const TopologyPage = () => {
	const theme = useTheme();

	const { data: graph, isLoading, isValidating, error } = useGet<TopologyGraph>(
		"/topology",
		{},
		{ keepPreviousData: true, refreshInterval: 30000 }
	);

	const laidOut = useMemo(() => layoutNodes(graph?.nodes ?? []), [graph]);
	const pos = useMemo(() => new Map(laidOut.map((n) => [n.id, n])), [laidOut]);
	const cols = Math.max(1, Math.ceil((graph?.nodes.length ?? 0) / PER_COL));
	const width = 80 + cols * COL_GAP;
	const height = 80 + Math.min(PER_COL, Math.max(1, graph?.nodes.length ?? 1)) * ROW_GAP;

	return (
		<BasePage
			headerKey="topology"
			loading={isLoading || isValidating}
			error={!!error}
		>
			<Stack spacing={2}>
				{/* Legend */}
				<Stack direction="row" spacing={3} flexWrap="wrap">
					{(Object.keys(STATE_COLORS) as NodeState[]).map((s) => (
						<Stack key={s} direction="row" spacing={1} alignItems="center">
							<Box sx={{ width: 14, height: 14, borderRadius: "50%", bgcolor: STATE_COLORS[s] }} />
							<Typography variant="body2">
								{STATE_LABELS[s]} ({graph?.summary[s] ?? 0})
							</Typography>
						</Stack>
					))}
				</Stack>

				{/* Canvas */}
				<Box
					sx={{
						overflow: "auto",
						border: `1px solid ${theme.palette.divider}`,
						borderRadius: 2,
						bgcolor: theme.palette.background.default,
					}}
				>
					<svg width={width} height={height} role="img" aria-label="network topology">
						{/* edges */}
						{(graph?.edges ?? []).map((e) => {
							const a = pos.get(e.source);
							const b = pos.get(e.target);
							if (!a || !b) return null;
							return (
								<line
									key={e.id}
									x1={a.x + NODE_W / 2}
									y1={a.y + NODE_H / 2}
									x2={b.x + NODE_W / 2}
									y2={b.y + NODE_H / 2}
									stroke={e.impaired ? STATE_COLORS.down : theme.palette.divider}
									strokeWidth={e.impaired ? 2.5 : 1.5}
									strokeDasharray={e.kind === "subnet" ? "6 4" : undefined}
								/>
							);
						})}
						{/* nodes */}
						{laidOut.map((n) => (
							<g key={n.id}>
								<rect
									x={n.x}
									y={n.y}
									width={NODE_W}
									height={NODE_H}
									rx={10}
									fill={theme.palette.background.paper}
									stroke={STATE_COLORS[n.state]}
									strokeWidth={n.state === "down" ? 3 : 2}
								/>
								<circle cx={n.x + 16} cy={n.y + NODE_H / 2} r={7} fill={STATE_COLORS[n.state]} />
								<text x={n.x + 32} y={n.y + 26} fontSize={12} fontWeight={600} fill={theme.palette.text.primary}>
									{n.name.length > 22 ? `${n.name.slice(0, 22)}…` : n.name}
								</text>
								<text x={n.x + 32} y={n.y + 44} fontSize={10} fill={theme.palette.text.secondary}>
									{n.type}
									{n.uptimePercentage !== undefined ? ` · ${n.uptimePercentage.toFixed(1)}%` : ""}
								</text>
							</g>
						))}
					</svg>
				</Box>
			</Stack>
		</BasePage>
	);
};

export default TopologyPage;
