import { Box, Card, Typography, Chip } from "@mui/material";

const logs = [
	{ time: "14:05:01", msg: "Fan 3 failed — SVR-10-vmwu16 (NETS4 U44)", level: "err" as const },
	{ time: "14:05:12", msg: "U44 temp rising 38°C — SVR-10-vmwu16", level: "warn" as const },
	{ time: "14:02:33", msg: "SVR-10-vmwu14 status: degraded", level: "info" as const },
	{ time: "13:58:07", msg: "Network traffic spike: 950 Mbps on 10-SP", level: "info" as const },
	{ time: "13:45:00", msg: "Scheduled check completed — 75 devices", level: "info" as const },
	{ time: "13:30:15", msg: "Power consumption 8.5 kW — above 80% capacity", level: "warn" as const },
	{ time: "13:15:42", msg: "SE-10-FWA failover completed successfully", level: "info" as const },
	{ time: "13:00:00", msg: "Hourly health check — all systems nominal", level: "info" as const },
];

const logColor = {
	err: "#ef4444",
	warn: "#eab308",
	info: "text.primary",
};

export const SystemLogs = () => {
	return (
		<Card variant="outlined" sx={{ height: "100%" }}>
			<Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", p: 1.5, borderBottom: 1, borderColor: "divider" }}>
				<Typography variant="subtitle2">System Logs</Typography>
				<Chip label="live" size="small" color="info" sx={{ fontSize: 9 }} />
			</Box>
			<Box sx={{ p: 1.5, fontFamily: "monospace", fontSize: 10 }}>
				{logs.map((log, i) => (
					<Box key={i} sx={{ display: "flex", gap: 1, py: 0.3, borderBottom: i < logs.length - 1 ? "1px solid" : "none", borderColor: "divider" }}>
						<Typography component="span" sx={{ color: "text.secondary", fontSize: 10, fontFamily: "monospace", flexShrink: 0 }}>
							{log.time}
						</Typography>
						<Typography component="span" sx={{ color: logColor[log.level], fontSize: 10, fontFamily: "monospace" }}>
							{log.msg}
						</Typography>
					</Box>
				))}
			</Box>
		</Card>
	);
};
