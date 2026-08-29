import { Card, CardContent, Typography, Box, Button, Chip } from "@mui/material";
import Grid from "@mui/material/Grid";
import { Shield, Terminal, Thermometer, Cpu, MemoryStick, Zap } from "lucide-react";
import type { RackServer, RackWithSlots, ServerOverallStatus } from "@/Types/Rack";

const statusColor: Record<ServerOverallStatus, string> = {
	up: "#22c55e",
	down: "#ef4444",
	degraded: "#eab308",
	paused: "#64748b",
	unmonitored: "#334155",
};

interface Props {
	server: RackServer;
	rack: RackWithSlots;
}

export const ServerDetailPanel = ({ server, rack }: Props) => {
	const color = statusColor[server.overallStatus] ?? "#334155";
	const uEnd = (server.uStart ?? 0) + (server.uHeight ?? 1) - 1;

	return (
		<Card variant="outlined" sx={{ height: "100%", borderColor: "primary.main" }}>
			<CardContent>
				<Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}>
					<Box>
						<Typography variant="h6" sx={{ color, fontWeight: 700 }}>
							{server.hostname}
						</Typography>
						<Typography variant="caption" color="text.secondary">
							{rack.name} · U{server.uStart}-{uEnd} ({server.uHeight ?? 1}U) · {server.projectName ?? "—"}
						</Typography>
					</Box>
					<Chip
						label={server.overallStatus.toUpperCase()}
						size="small"
						sx={{
							backgroundColor: `${color}22`,
							color,
							fontWeight: 700,
							fontSize: 10,
						}}
					/>
				</Box>

				<Grid container spacing={1} sx={{ mb: 2 }}>
					{[
						{ icon: <Cpu size={14} />, label: "CPU", value: server.overallStatus === "down" ? "—" : "72%" },
						{ icon: <MemoryStick size={14} />, label: "RAM", value: server.overallStatus === "down" ? "—" : "64%" },
						{ icon: <Thermometer size={14} />, label: "Temp", value: "34°C" },
						{ icon: <Zap size={14} />, label: "Power", value: `${server.ports?.length ?? 0}W` },
					].map((stat) => (
						<Grid size={6} key={stat.label}>
							<Box sx={{ p: 1, backgroundColor: "background.default", borderRadius: 1 }}>
								<Box sx={{ display: "flex", alignItems: "center", gap: 0.5, color: "text.secondary" }}>
									{stat.icon}
									<Typography variant="caption" sx={{ fontSize: 9, textTransform: "uppercase" }}>
										{stat.label}
									</Typography>
								</Box>
								<Typography variant="body2" sx={{ fontWeight: 700, color }}>
									{stat.value}
								</Typography>
							</Box>
						</Grid>
					))}
				</Grid>

				<Box sx={{ mb: 1 }}>
					<Typography variant="caption" color="text.secondary">
						IP: {server.ipAddress} · Model: {server.hardwareModel ?? "—"} · Role: {server.role}
					</Typography>
				</Box>

				{server.isVmHost && server.vmNames && server.vmNames.length > 0 && (
					<Box sx={{ mb: 1 }}>
						<Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase", fontSize: 9 }}>
							VMs
						</Typography>
						<Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.5 }}>
							{server.vmNames.map((vm) => (
								<Chip key={vm} label={vm} size="small" sx={{ fontSize: 10 }} />
							))}
						</Box>
					</Box>
				)}

				{server.ports && server.ports.length > 0 && (
					<Box sx={{ mb: 1 }}>
						<Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase", fontSize: 9 }}>
							Ports
						</Typography>
						{server.ports.map((p) => (
							<Box key={p.name} sx={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
								<Typography color="text.secondary">{p.name}</Typography>
								<Typography>{p.label}</Typography>
							</Box>
						))}
					</Box>
				)}

				<Box sx={{ display: "flex", gap: 1, mt: 2 }}>
					<Button size="small" variant="contained" startIcon={<Shield size={14} />}>
						Investigate
					</Button>
					<Button size="small" variant="outlined" startIcon={<Terminal size={14} />}>
						SSH
					</Button>
				</Box>
			</CardContent>
		</Card>
	);
};
