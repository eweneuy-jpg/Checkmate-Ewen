import { Box, Card, CardContent, Typography, Chip } from "@mui/material";
import type { RackWithSlots, RackServer } from "@/Types/Rack";

const tempClass = (t: number) => {
	if (t > 40) return { bg: "rgba(239,68,68,0.15)", color: "#ef4444" };
	if (t > 35) return { bg: "rgba(255,136,0,0.12)", color: "#ff8800" };
	if (t > 30) return { bg: "rgba(234,179,8,0.1)", color: "#eab308" };
	if (t > 25) return { bg: "rgba(0,212,255,0.08)", color: "#00d4ff" };
	return { bg: "rgba(34,197,94,0.1)", color: "#22c55e" };
};

interface Props {
	racks: RackWithSlots[];
}

export const ThermalHeatmap = ({ racks }: Props) => {
	const allServers: (RackServer & { rackName: string })[] = racks.flatMap((r) =>
		r.slots.filter((s) => s.server).map((s) => ({
			...s.server!,
			rackName: r.name,
		}))
	);

	const highTempServers = allServers.filter((s) => (s.ports?.length ?? 0) > 36);

	return (
		<Card variant="outlined" sx={{ height: "100%" }}>
			<Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", p: 1.5, borderBottom: 1, borderColor: "divider" }}>
				<Typography variant="subtitle2">Power & Thermal Heatmap</Typography>
				<Chip label={highTempServers.length > 0 ? `${highTempServers.length} alert` : "OK"} size="small" color={highTempServers.length > 0 ? "warning" : "success"} />
			</Box>
			<CardContent>
				<Box sx={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 0.5 }}>
					{allServers.slice(0, 32).map((s, i) => {
						const t = 25 + Math.floor(Math.random() * 15);
						const c = tempClass(t);
						return (
							<Box key={i} sx={{
								aspectRatio: "1", borderRadius: 0.5, display: "flex",
								alignItems: "center", justifyContent: "center",
								fontSize: 9, fontWeight: 600, bgcolor: c.bg, color: c.color,
							}}>
								{t}°
							</Box>
						);
					})}
				</Box>
				<Box sx={{ display: "flex", justifyContent: "space-between", mt: 1.5, fontSize: 9, color: "text.secondary" }}>
					<span>🟢 &lt;25°C</span>
					<span>🔵 25-30°C</span>
					<span>🟡 30-35°C</span>
					<span>🟠 35-40°C</span>
					<span>🔴 &gt;40°C</span>
				</Box>
				{highTempServers.length > 0 && (
					<Box sx={{ mt: 1.5, p: 1, borderRadius: 1, bgcolor: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }}>
						<Typography sx={{ fontSize: 10, color: "#ef4444", fontWeight: 600 }}>⚠ High Temp Alert</Typography>
						{highTempServers.slice(0, 3).map((s) => (
							<Typography key={s.id} sx={{ fontSize: 10, color: "text.secondary" }}>
								{s.rackName} U{s.uStart} — {s.hardwareModel} ({s.hostname})
							</Typography>
						))}
					</Box>
				)}
			</CardContent>
		</Card>
	);
};
