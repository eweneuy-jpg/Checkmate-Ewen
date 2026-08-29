import { Box, Card, Typography, Chip, Grid2 } from "@mui/material";

const envData = [
	{ label: "Temp", value: "27°C", unit: "Range: 19-38°C", color: "#22c55e" },
	{ label: "Power", value: "8.5 kW", unit: "of 12 kW capacity", color: "#00d4ff" },
	{ label: "Humidity", value: "45%", unit: "Optimal range", color: "#00d4ff" },
	{ label: "UPS", value: "100%", unit: "Battery OK", color: "#22c55e" },
];

export const EnvironmentPanel = () => {
	return (
		<Card variant="outlined" sx={{ height: "100%" }}>
			<Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", p: 1.5, borderBottom: 1, borderColor: "divider" }}>
				<Typography variant="subtitle2">Environment</Typography>
				<Chip label="Normal" size="small" color="success" />
			</Box>
			<Box sx={{ p: 1.5 }}>
				<Grid2 container spacing={1}>
					{envData.map((item) => (
						<Grid2 size={6} key={item.label}>
							<Box sx={{ p: 1, borderRadius: 1, bgcolor: "background.default", display: "flex", flexDirection: "column", gap: 0.25 }}>
								<Typography sx={{ fontSize: 9, color: "text.secondary", textTransform: "uppercase" }}>
									{item.label}
								</Typography>
								<Typography sx={{ fontSize: 16, fontWeight: 700, color: item.color }}>
									{item.value}
								</Typography>
								<Typography sx={{ fontSize: 10, color: "text.secondary" }}>
									{item.unit}
								</Typography>
							</Box>
						</Grid2>
					))}
				</Grid2>
			</Box>
		</Card>
	);
};
