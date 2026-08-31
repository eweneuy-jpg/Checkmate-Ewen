import { Box, Typography, useTheme, IconButton } from "@mui/material";
import { Pencil, Link2, Router, Server as ServerIcon, Shield, Database, HardDrive, Cpu, Wifi, Container, Globe } from "lucide-react";
import type { RackWithSlots, RackServer, ServerOverallStatus } from "@/Types/Rack";

const statusColors: Record<ServerOverallStatus, { bg: string; border: string; led: string }> = {
	up: { bg: "rgba(34,197,94,0.08)", border: "#22c55e", led: "#22c55e" },
	down: { bg: "rgba(239,68,68,0.1)", border: "#ef4444", led: "#ef4444" },
	degraded: { bg: "rgba(234,179,8,0.08)", border: "#eab308", led: "#eab308" },
	paused: { bg: "rgba(71,85,105,0.08)", border: "#64748b", led: "#64748b" },
	unmonitored: { bg: "rgba(107,119,133,0.04)", border: "#334155", led: "#334155" },
};

const roleIcons: Record<string, typeof Router> = {
	"web-service": Globe,
	"database": Database,
	"app-server": Cpu,
	"cache": HardDrive,
	"load-balancer": Wifi,
	"firewall": Shield,
	"router": Router,
	"switch": Wifi,
	"dns": Globe,
	"mail": ServerIcon,
	"storage": Database,
	"hypervisor": Container,
	"container": Container,
	"other": ServerIcon,
};

const getRoleIcon = (role: string) => roleIcons[role] ?? ServerIcon;

interface Props {
	rack: RackWithSlots;
	onServerClick: (server: RackServer, rack: RackWithSlots) => void;
	selectedServerId?: string;
	onEditServer?: (server: RackServer) => void;
	onManageConnections?: (server: RackServer) => void;
}

export const RackDiagram = ({ rack, onServerClick, selectedServerId, onEditServer, onManageConnections }: Props) => {
	const theme = useTheme();
	const isDark = theme.palette.mode === "dark";
	const usedU = rack.usedU ?? rack.slots.filter((s) => s.server).length;
	const downCount = rack.slots.filter((s) => s.server?.overallStatus === "down").length;

	const UNIT_H = 20;
	const rackBodyHeight = rack.totalU * UNIT_H;

	const connectionPairs: { fromU: number; toU: number }[] = [];
	for (const slot of rack.slots) {
		if (!slot.server?.ports) continue;
		for (const port of slot.server.ports) {
			if (!port.target) continue;
			const targetId = port.target.split("/")[0];
			const targetSlot = rack.slots.find((s) => s.server?.id === targetId);
			if (targetSlot && slot.u !== targetSlot.u) {
				connectionPairs.push({ fromU: slot.u, toU: targetSlot.u });
			}
		}
	}

	return (
		<Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5 }}>
			<Typography variant="caption" sx={{ fontWeight: 700, color: "primary.main", letterSpacing: 0.5 }}>
				{rack.name}
			</Typography>
			<Typography variant="caption" sx={{ color: "text.secondary", fontSize: 10 }}>
				{usedU}/{rack.totalU}U - {downCount > 0 ? downCount + " DOWN" : "HEALTHY"} - {rack.serverCount} servers
			</Typography>
			<Box
				sx={{
					display: "flex",
					border: "1.5px solid " + (isDark ? "#1c2b3f" : "#e2e8f0"),
					borderRadius: "4px",
					background: isDark ? "#080c14" : "#f8fafc",
					boxShadow: "0 2px 12px rgba(0,0,0,0.2)",
				}}
			>
				{/* U rail */}
				<Box
					sx={{
						width: 22,
						borderRight: "1px solid " + (isDark ? "#1c2b3f" : "#e2e8f0"),
						display: "flex",
						flexDirection: "column",
					}}
				>
					{rack.slots.map((slot) => (
						<Box
							key={slot.u}
							sx={{
								height: 20,
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								fontSize: 8,
								color: "text.disabled",
								borderBottom: "1px solid " + (isDark ? "#0a0e14" : "#f1f5f9"),
							}}
						>
							{slot.u}
						</Box>
					))}
				</Box>
				{/* Server column */}
				<Box sx={{ width: 180, display: "flex", flexDirection: "column", position: "relative" }}>
					{rack.slots.map((slot) => {
						if (!slot.server) {
							return (
								<Box
									key={slot.u}
									sx={{
										height: 20,
										borderBottom: "1px solid " + (isDark ? "#0a0e14" : "#f1f5f9"),
									}}
								/>
							);
						}
						const s = slot.server;
						const c = statusColors[s.overallStatus] ?? statusColors.unmonitored;
						const isSelected = s.id === selectedServerId;
						return (
							<Box
								key={slot.u}
								onClick={() => onServerClick(s, rack)}
								sx={{
									height: 20,
									display: "flex",
									alignItems: "center",
									padding: "0 6px",
									fontSize: 9,
									cursor: "pointer",
									background: c.bg,
									borderLeft: "3px solid " + c.border,
									borderBottom: "1px solid " + (isDark ? "#0a0e14" : "#f1f5f9"),
									transition: "all 0.12s",
									"&:hover": {
										filter: "brightness(1.3)",
										boxShadow: "0 0 8px rgba(0,212,255,0.15)",
									},
									...(isSelected && {
										outline: "2px solid #00d4ff",
										outlineOffset: "-2px",
									}),
									overflow: "hidden",
									whiteSpace: "nowrap",
								}}
							>
								<Box
									component="span"
									sx={{
										width: 5,
										height: 5,
										borderRadius: "50%",
										background: c.led,
										boxShadow: "0 0 3px " + c.led,
										mr: "4px",
										flexShrink: 0,
										...(s.overallStatus === "down" && {
											animation: "blink 1s infinite",
										}),
									}}
								/>
								{(() => {
									const RoleIcon = getRoleIcon(s.role);
									return <RoleIcon size={8} style={{ opacity: 0.5, flexShrink: 0 }} />;
								})()}
								<Typography
									component="span"
									sx={{ fontWeight: 600, fontSize: 9, color: "text.primary" }}
								>
									{s.hostname}
								</Typography>
								{s.hardwareModel && (
									<Typography
										component="span"
										sx={{ fontSize: 8, color: "text.disabled", ml: "3px" }}
									>
										{s.hardwareModel.length > 16
											? s.hardwareModel.slice(0, 14) + "..."
											: s.hardwareModel}
									</Typography>
								)}
								{s.isVmHost && (
									<Box
										component="span"
										sx={{
											background: "rgba(0,212,255,0.15)",
											color: "primary.main",
											fontSize: 8,
											padding: "0 3px",
											borderRadius: "2px",
											ml: "3px",
											fontWeight: 700,
										}}
									>
										VMx{(s.vmNames ?? []).length}
									</Box>
								)}
								{s.projectName && (
									<Typography
										component="span"
										sx={{ ml: "auto", fontSize: 8, color: "text.disabled" }}
									>
										{s.projectName}
									</Typography>
								)}
								{(onEditServer || onManageConnections) && (
									<Box component="span" sx={{ ml: "auto", display: "flex", gap: 0.25, opacity: 0, transition: "opacity 0.15s", "&:hover": { opacity: 1 } }}>
										{onEditServer && (
											<IconButton
												size="small"
												onClick={(e) => { e.stopPropagation(); onEditServer(s); }}
												sx={{ p: 0.25, opacity: 0.5, "&:hover": { opacity: 1, color: "primary.main" } }}
											>
												<Pencil size={9} />
											</IconButton>
										)}
										{onManageConnections && (
											<IconButton
												size="small"
												onClick={(e) => { e.stopPropagation(); onManageConnections(s); }}
												sx={{ p: 0.25, opacity: 0.5, "&:hover": { opacity: 1, color: "success.main" } }}
											>
												<Link2 size={9} />
											</IconButton>
										)}
									</Box>
								)}
							</Box>
						);
					})}
					{/* Connection SVG overlay */}
					{connectionPairs.length > 0 && (
						<svg
							style={{
								position: "absolute",
								top: 0,
								left: 0,
								width: "100%",
								height: rackBodyHeight,
								pointerEvents: "none",
								zIndex: 5,
							}}
							viewBox={"0 0 180 " + rackBodyHeight}
						>
							{connectionPairs.map((conn, i) => {
								const y1 = (rack.totalU - conn.fromU) * UNIT_H + UNIT_H / 2;
								const y2 = (rack.totalU - conn.toU) * UNIT_H + UNIT_H / 2;
								const midY = (y1 + y2) / 2;
								const pd = "M 0 " + y1 + " C 60 " + y1 + ", 60 " + midY + ", 90 " + midY + " C 120 " + midY + ", 120 " + y2 + ", 180 " + y2;
								return (
									<path
										key={i}
										d={pd}
										fill="none"
										stroke={isDark ? "#00d4ff" : "#0284c7"}
										strokeWidth={1}
										strokeDasharray="3 2"
										opacity={0.4}
									/>
								);
							})}
						</svg>
					)}
				</Box>
			</Box>
		</Box>
	);
};
