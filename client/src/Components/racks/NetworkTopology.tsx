import { Box, Card, Typography, Chip } from "@mui/material";

const nodes = [
	{ type: "core", label: "10-PR — Cisco ASR-9006", traffic: "10 Gbps", color: "#00d4ff", bg: "rgba(0,212,255,0.08)" },
	{ type: "firewall", label: "SE-10-FWA — FortiGate 3700D", traffic: "2.1 Gbps", color: "#ef4444", bg: "rgba(239,68,68,0.06)" },
	{ type: "switch", label: "10-SP — Cisco Nexus 9504", traffic: "950 Mbps", color: "#4a9eff", bg: "rgba(74,158,255,0.06)" },
];

const endpoints = [
	{ label: "NETS1-3 FEX", color: "#4a9eff" },
	{ label: "NETS4 FEX", color: "#4a9eff" },
	{ label: "HV101-106", color: "#22c55e" },
	{ label: "vmwu14-17", color: "#22c55e" },
];

export const NetworkTopology = () => {
	return (
		<Card variant="outlined" sx={{ height: "100%" }}>
			<Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", p: 1.5, borderBottom: 1, borderColor: "divider" }}>
				<Typography variant="subtitle2">Network Topology</Typography>
				<Chip label="950 Mbps" size="small" color="info" />
			</Box>
			<Box sx={{ p: 2, display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5 }}>
				{nodes.map((node, i) => (
					<Box key={i} sx={{ width: "100%" }}>
						<Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
							<Box sx={{
								flex: 1, p: 1, borderRadius: 1, fontSize: 10, fontWeight: 600,
								border: 1.5, borderColor: node.color, bgcolor: node.bg, color: node.color,
								display: "flex", alignItems: "center", gap: 1,
							}}>
								{node.label}
							</Box>
							<Typography sx={{ fontSize: 10, color: "text.secondary" }}>{node.traffic}</Typography>
						</Box>
						{i < nodes.length - 1 && (
							<Box sx={{ width: 2, height: 12, bgcolor: "divider", mx: "auto", my: 0.5, position: "relative" }}>
								<Box sx={{
									position: "absolute", left: -1, top: 0, width: 4, height: 4,
									borderRadius: "50%", bgcolor: "#00d4ff",
									animation: "flow 2s linear infinite",
								}} />
							</Box>
						)}
					</Box>
				))}
				<Box sx={{ display: "flex", gap: 2, width: "100%", justifyContent: "center", flexWrap: "wrap" }}>
					{endpoints.map((ep, i) => (
						<Box key={i} sx={{
							display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5,
						}}>
							<Box sx={{
								p: 0.5, borderRadius: 0.5, fontSize: 9, fontWeight: 600,
								border: 1.5, borderColor: ep.color, bgcolor: `${ep.color}0a`, color: ep.color,
							}}>
								{ep.label}
							</Box>
						</Box>
					))}
				</Box>
			</Box>
			<style>{`@keyframes flow { 0% { top: 0; opacity: 1; } 100% { top: 12px; opacity: 0; } }`}</style>
		</Card>
	);
};
