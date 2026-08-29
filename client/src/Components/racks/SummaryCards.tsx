import { Box, Card, CardContent, Typography, Modal, IconButton, Chip } from "@mui/material";
import { Close } from "@mui/icons-material";
import { useState, type ReactNode } from "react";
import type { RackWithSlots, RackServer, ServerOverallStatus } from "@/Types/Rack";

const statusColor: Record<ServerOverallStatus, string> = {
	up: "#22c55e",
	down: "#ef4444",
	degraded: "#eab308",
	paused: "#64748b",
	unmonitored: "#334155",
};

interface SummaryData {
	rackCount: number;
	deviceCount: number;
	alertCount: number;
	avgTemp: number;
	totalPower: number;
	downCount: number;
	degradedCount: number;
	highTempCount: number;
	minTemp: number;
	maxTemp: number;
	peakPower: number;
}

interface Props {
	racks: RackWithSlots[];
	onRackClick?: () => void;
	onSelectRack?: (name: string) => void;
}

export const SummaryCards = ({ racks, onSelectRack }: Props) => {
	const [modalType, setModalType] = useState<string | null>(null);

	const allServers: (RackServer & { rackName: string })[] = racks.flatMap((r) =>
		r.slots.filter((s) => s.server).map((s) => ({
			...s.server!,
			rackName: r.name,
		}))
	);

	const data: SummaryData = {
		rackCount: racks.length,
		deviceCount: allServers.length,
		alertCount: allServers.filter((s) => s.overallStatus === "down" || s.overallStatus === "degraded").length,
		avgTemp: 27,
		totalPower: allServers.reduce((sum, s) => sum + (s.ports?.length ?? 0), 0),
		downCount: allServers.filter((s) => s.overallStatus === "down").length,
		degradedCount: allServers.filter((s) => s.overallStatus === "degraded").length,
		highTempCount: 0,
		minTemp: 19,
		maxTemp: 38,
		peakPower: 12300,
	};

	const cards = [
		{ type: "racks", icon: "🗂", label: "Racks", value: data.rackCount, sub: `${data.rackCount - 2} healthy · 2 alerts`, color: "#00d4ff" },
		{ icon: "🖥", label: "Active Devices", value: data.deviceCount, sub: `${data.deviceCount - data.downCount} online · ${data.downCount} down`, color: "#22c55e" },
		{ type: "alerts", icon: "🚨", label: "Alerts", value: data.alertCount, sub: `${data.downCount} critical · ${data.degradedCount} warning`, color: "#ef4444" },
		{ type: "thermal", icon: "🌡", label: "Avg Temp", value: `${data.avgTemp}°C`, sub: `Range: ${data.minTemp}-${data.maxTemp}°C`, color: "#eab308" },
		{ type: "power", icon: "⚡", label: "Total Power", value: `${(data.totalPower / 1000).toFixed(1)} kW`, sub: `Peak: ${(data.peakPower / 1000).toFixed(1)} kW`, color: "#a855f7" },
	];

	const closeModal = () => setModalType(null);

	const renderModal = () => {
		if (!modalType) return null;
		let title = "";
		let body: ReactNode = null;

		if (modalType === "racks") {
			title = `Racks — ${racks.length} Total`;
			body = racks.map((r) => {
				const usedU = r.usedU;
				const down = r.slots.filter((s) => s.server?.overallStatus === "down").length;
				return (
					<Box
						key={r.id}
						onClick={() => { onSelectRack?.(r.name); closeModal(); }}
						sx={{ display: "flex", alignItems: "center", gap: 1, p: 1, borderRadius: 1, mb: 0.5, cursor: "pointer", "&:hover": { bgcolor: "action.hover" } }}
					>
						<Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: down > 0 ? "#ef4444" : "#22c55e" }} />
						<Typography sx={{ fontSize: 11, fontWeight: 600 }}>{r.name}</Typography>
						<Typography sx={{ fontSize: 9, color: "text.secondary" }}>{r.serverCount} servers · {usedU}/{r.totalU}U</Typography>
						<Typography sx={{ ml: "auto", fontSize: 10, color: down > 0 ? "#ef4444" : "#22c55e", fontWeight: 700 }}>
							{down > 0 ? `${down} DOWN` : "HEALTHY"}
						</Typography>
					</Box>
				);
			});
		} else if (modalType === "alerts") {
			const down = allServers.filter((s) => s.overallStatus === "down");
			const deg = allServers.filter((s) => s.overallStatus === "degraded");
			title = `Alerts — ${down.length + deg.length} Active`;
			body = (
				<Box>
					{down.map((s) => (
						<AlertRow key={s.id} server={s} severity="critical" rackName={s.rackName} />
					))}
					{deg.map((s) => (
						<AlertRow key={s.id} server={s} severity="warning" rackName={s.rackName} />
					))}
				</Box>
			);
		} else if (modalType === "devices") {
			title = `Active Devices — ${allServers.length} Total`;
			const groups: ServerOverallStatus[] = ["down", "degraded", "up", "paused", "unmonitored"];
			body = (
				<Box>
					{groups.map((status) => {
						const list = allServers.filter((s) => s.overallStatus === status);
						if (!list.length) return null;
						return (
							<Box key={status}>
								<Typography sx={{ fontSize: 10, color: statusColor[status], textTransform: "uppercase", fontWeight: 700, mt: 1, mb: 0.5 }}>
									{status} ({list.length})
								</Typography>
								{list.map((s) => (
									<Box key={s.id} sx={{ display: "flex", alignItems: "center", gap: 1, p: 1, borderRadius: 1, mb: 0.5, "&:hover": { bgcolor: "action.hover" }, cursor: "pointer" }} onClick={closeModal}>
										<Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: statusColor[status] }} />
										<Typography sx={{ fontSize: 11, fontWeight: 600 }}>{s.hostname}</Typography>
										<Typography sx={{ fontSize: 9, color: "text.secondary" }}>{s.hardwareModel ?? ""}</Typography>
										<Typography sx={{ ml: "auto", fontSize: 10, color: "text.secondary" }}>{s.rackName} U{s.uStart}</Typography>
									</Box>
								))}
							</Box>
						);
					})}
				</Box>
			);
		} else {
			title = "Details";
			body = <Typography color="text.secondary">No data</Typography>;
		}

		return (
			<Modal open={!!modalType} onClose={closeModal}>
				<Box sx={{
					position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
					width: 520, maxHeight: "80vh", bgcolor: "background.paper", borderRadius: 2,
					boxShadow: 24, display: "flex", flexDirection: "column", overflow: "hidden",
				}}>
					<Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", p: 2, borderBottom: 1, borderColor: "divider" }}>
						<Typography variant="h6" sx={{ color: "primary.main", fontSize: 14 }}>{title}</Typography>
						<IconButton size="small" onClick={closeModal}><Close /></IconButton>
					</Box>
					<Box sx={{ p: 2, overflow: "auto" }}>{body}</Box>
				</Box>
			</Modal>
		);
	};

	return (
		<>
			<Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(5, 1fr)" }, gap: 1.5 }}>
				{cards.map((c, i) => (
					<Card
						key={i}
						variant="outlined"
						onClick={() => setModalType(c.type ?? "devices")}
						sx={{
							cursor: "pointer", transition: "all 0.15s",
							"&:hover": { borderColor: "primary.main", transform: "translateY(-2px)", boxShadow: 3 },
						}}
					>
						<CardContent sx={{ position: "relative", p: 1.5, "&:last-child": { pb: 1.5 } }}>
							<Box sx={{ position: "absolute", top: 8, right: 8, width: 28, height: 28, borderRadius: 1, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, bgcolor: `${c.color}1a`, color: c.color }}>
								{c.icon}
							</Box>
							<Typography sx={{ fontSize: 10, color: "text.secondary", textTransform: "uppercase", letterSpacing: 0.5 }}>{c.label}</Typography>
							<Typography sx={{ fontSize: 22, fontWeight: 700, color: c.label === "Alerts" ? "#ef4444" : "text.primary" }}>{c.value}</Typography>
							<Typography sx={{ fontSize: 10, color: "text.secondary" }}>{c.sub}</Typography>
						</CardContent>
					</Card>
				))}
			</Box>
			{renderModal()}
		</>
	);
};

const AlertRow = ({ server, severity, rackName }: { server: RackServer; severity: "critical" | "warning"; rackName: string }) => {
	const color = severity === "critical" ? "#ef4444" : "#eab308";
	const label = server.overallStatus === "down" ? "Server DOWN" : "Degraded Performance";
	return (
		<Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, p: 1, borderRadius: 1, mb: 0.5, bgcolor: "background.default", border: 1, borderColor: "divider", "&:hover": { borderColor: color } }}>
			<Box sx={{ width: 8, height: 8, borderRadius: "50%", mt: 0.5, bgcolor: color, boxShadow: `0 0 4px ${color}` }} />
			<Box sx={{ flex: 1 }}>
				<Typography sx={{ fontSize: 12, fontWeight: 600 }}>{server.hostname} — {label}</Typography>
				<Typography sx={{ fontSize: 10, color: "text.secondary" }}>{rackName} · U{server.uStart} · {server.hardwareModel} · Project: {server.projectName ?? "—"}</Typography>
			</Box>
			<Chip label={severity} size="small" sx={{ fontSize: 9, fontWeight: 700, bgcolor: `${color}33`, color, textTransform: "uppercase" }} />
		</Box>
	);
};
