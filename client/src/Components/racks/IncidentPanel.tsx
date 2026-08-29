import { Box, Card, Typography, Button, Chip } from "@mui/material";
import { Shield } from "lucide-react";
import type { RackWithSlots, RackServer } from "@/Types/Rack";

interface Props {
	racks: RackWithSlots[];
}

export const IncidentPanel = ({ racks }: Props) => {
	const allServers: (RackServer & { rackName: string })[] = racks.flatMap((r) =>
		r.slots.filter((s) => s.server).map((s) => ({ ...s.server!, rackName: r.name }))
	);

	const downServers = allServers.filter((s) => s.overallStatus === "down");
	const degServers = allServers.filter((s) => s.overallStatus === "degraded");
	const criticalCount = downServers.length;

	return (
		<Card variant="outlined" sx={{ height: "100%" }}>
			<Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", p: 1.5, borderBottom: 1, borderColor: "divider" }}>
				<Typography variant="subtitle2">Incident & Alert Management</Typography>
				{criticalCount > 0 && <Chip label={`${criticalCount} critical`} size="small" color="error" />}
			</Box>
			<Box sx={{ p: 1.5 }}>
				{downServers.map((s) => (
					<Box key={s.id} sx={{
						p: 1.25, borderRadius: 1, mb: 1,
						bgcolor: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)",
					}}>
						<Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
							<Chip label="CRITICAL" size="small" sx={{ fontSize: 9, fontWeight: 700, bgcolor: "#ef4444", color: "#fff" }} />
							<Typography sx={{ fontSize: 11, fontWeight: 600 }}>
								{s.hostname} — Server DOWN
							</Typography>
						</Box>
						<Typography sx={{ fontSize: 10, color: "text.secondary", mb: 1 }}>
							{s.rackName} · U{s.uStart} · {s.hardwareModel} · Project: {s.projectName ?? "—"}
						</Typography>
						<Box sx={{ display: "flex", gap: 0.75 }}>
							<Button size="small" variant="contained" startIcon={<Shield size={12} />} sx={{ fontSize: 10, py: 0.25 }}>
								Investigate
							</Button>
							<Button size="small" variant="outlined" sx={{ fontSize: 10, py: 0.25 }}>
								Acknowledge
							</Button>
							<Button size="small" variant="outlined" sx={{ fontSize: 10, py: 0.25 }}>
								Resolve
							</Button>
						</Box>
					</Box>
				))}
				{degServers.map((s) => (
					<Box key={s.id} sx={{
						p: 1.25, borderRadius: 1, mb: 1,
						bgcolor: "rgba(234,179,8,0.04)", border: "1px solid rgba(234,179,8,0.2)",
					}}>
						<Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
							<Chip label="WARNING" size="small" sx={{ fontSize: 9, fontWeight: 700, bgcolor: "#eab308", color: "#000" }} />
							<Typography sx={{ fontSize: 11, fontWeight: 600 }}>
								{s.hostname} — Degraded
							</Typography>
						</Box>
						<Typography sx={{ fontSize: 10, color: "text.secondary" }}>
							{s.rackName} · U{s.uStart} · {s.hardwareModel}
						</Typography>
					</Box>
				))}
				{downServers.length === 0 && degServers.length === 0 && (
					<Typography sx={{ textAlign: "center", color: "text.secondary", py: 3, fontSize: 12 }}>
						No active incidents ✅
					</Typography>
				)}
			</Box>
		</Card>
	);
};
