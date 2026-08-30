import { useState, useEffect, useCallback } from "react";
import { Box, Typography, CircularProgress, TextField, MenuItem, Paper, Button, IconButton } from "@mui/material";
import Grid from "@mui/material/Grid";
import { Plus, Pencil } from "lucide-react";
import { RackDiagram } from "@/Components/racks/RackDiagram";
import { ServerDetailPanel } from "@/Components/racks/ServerDetailPanel";
import { SummaryCards } from "@/Components/racks/SummaryCards";
import { ThermalHeatmap } from "@/Components/racks/ThermalHeatmap";
import { NetworkTopology } from "@/Components/racks/NetworkTopology";
import { IncidentPanel } from "@/Components/racks/IncidentPanel";
import { SystemLogs } from "@/Components/racks/SystemLogs";
import { EnvironmentPanel } from "@/Components/racks/EnvironmentPanel";
import { RackFormDialog } from "@/Components/racks/RackFormDialog";
import { RackService } from "@/Utils/RackService";
import type { RackSummary, RackWithSlots, RackServer } from "@/Types/Rack";

const RacksDashboard = () => {
	const [summaries, setSummaries] = useState<RackSummary[]>([]);
	const [selectedRackId, setSelectedRackId] = useState<string>("ALL");
	const [racks, setRacks] = useState<RackWithSlots[]>([]);
	const [loading, setLoading] = useState(true);
	const [selectedServer, setSelectedServer] = useState<RackServer | null>(null);
	const [selectedServerRack, setSelectedServerRack] = useState<RackWithSlots | null>(null);
	const [rackFormOpen, setRackFormOpen] = useState(false);
	const [editingRack, setEditingRack] = useState<RackSummary | null>(null);

	const loadRacks = useCallback(async () => {
		setLoading(true);
		try {
			const data = await RackService.getRacks();
			setSummaries(data);
			const all = await Promise.all(data.map((s) => RackService.getRack(s.id)));
			setRacks(all);
		} catch {
			// API not ready
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		loadRacks();
	}, [loadRacks]);

	const handleServerClick = (server: RackServer, rack: RackWithSlots) => {
		setSelectedServer(server);
		setSelectedServerRack(rack);
	};

	const handleSelectRack = (name: string) => {
		const rack = racks.find((r) => r.name === name);
		if (rack) setSelectedRackId(rack.id);
	};

	const filteredRacks = selectedRackId === "ALL"
		? racks
		: racks.filter((r) => r.id === selectedRackId);

	if (loading) {
		return (
			<Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}>
				<CircularProgress />
			</Box>
		);
	}

	return (
		<Box sx={{ p: 3, display: "flex", flexDirection: "column", gap: 2 }}>
			{/* Row 1: Summary */}
			<SummaryCards racks={racks} onSelectRack={handleSelectRack} />

			{/* Row 2: Rack Diagrams + Server Detail | Thermal */}
			<Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "2fr 1fr" }, gap: 2 }}>
				<Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
					<Paper variant="outlined" sx={{ p: 2 }}>
						<Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
								<Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Server Racks</Typography>
								<Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
									<TextField
										select
										size="small"
										label="Rack"
										value={selectedRackId}
										onChange={(e) => setSelectedRackId(e.target.value)}
										sx={{ minWidth: 200 }}
									>
										<MenuItem value="ALL">All Racks ({summaries.length})</MenuItem>
										{summaries.map((s) => (
											<MenuItem key={s.id} value={s.id}>
												{s.name} — {s.serverCount} servers, {s.usedU}/{s.totalU}U
											</MenuItem>
										))}
									</TextField>
									<Button
										variant="contained"
										size="small"
										startIcon={<Plus size={16} />}
										onClick={() => { setEditingRack(null); setRackFormOpen(true); }}
									>
										Add Rack
									</Button>
								</Box>
							</Box>
						<Box sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
							<Box sx={{ flex: 1, display: "flex", gap: 1.5, flexWrap: "wrap", justifyContent: "center" }}>
								{filteredRacks.length === 0 ? (
											<Typography color="text.secondary" sx={{ p: 4, textAlign: "center" }}>
												No racks found. Click <strong>Add Rack</strong> to create one.
											</Typography>
										) : (
											filteredRacks.map((rack) => (
												<Box key={rack.id} sx={{ position: "relative" }}>
													<IconButton
														size="small"
														onClick={() => {
															const summary = summaries.find((s) => s.id === rack.id);
															setEditingRack(summary ?? null);
															setRackFormOpen(true);
														}}
														sx={{
															position: "absolute", top: 24, right: -8, zIndex: 10,
															bgcolor: "background.paper", border: 1, borderColor: "divider",
															"&:hover": { borderColor: "primary.main", color: "primary.main" },
														}}
													>
														<Pencil size={12} />
													</IconButton>
													<RackDiagram
														rack={rack}
														onServerClick={handleServerClick}
														selectedServerId={selectedServer?.id}
													/>
												</Box>
											))
										)}
							</Box>
							<Box sx={{ width: 300, flexShrink: 0 }}>
								{selectedServer && selectedServerRack ? (
									<ServerDetailPanel server={selectedServer} rack={selectedServerRack} />
								) : (
									<Paper variant="outlined" sx={{ p: 4, textAlign: "center" }}>
										<Typography color="text.secondary" variant="body2">
											Click a server in the rack diagram to see details
										</Typography>
									</Paper>
								)}
							</Box>
						</Box>
					</Paper>
				</Box>
				<ThermalHeatmap racks={racks} />
			</Box>

			{/* Row 3: Network | Incident | Logs */}
			<Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: 2 }}>
				<NetworkTopology />
				<IncidentPanel racks={racks} />
				<SystemLogs />
			</Box>

			{/* Row 4: Environment | Device Details */}
			<Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
				<EnvironmentPanel />
				<Paper variant="outlined" sx={{ p: 2, minHeight: 120 }}>
					<Typography variant="subtitle2" sx={{ mb: 1.5 }}>Device Details</Typography>
					{selectedServer && selectedServerRack ? (
						<ServerDetailPanel server={selectedServer} rack={selectedServerRack} />
					) : (
						<Typography color="text.secondary" variant="body2" sx={{ textAlign: "center", py: 3 }}>
							Click a server in the rack diagram
						</Typography>
					)}
				</Paper>
			</Box>

			{/* Rack CRUD Dialog */}
			<RackFormDialog
				open={rackFormOpen}
				rack={editingRack}
				onClose={() => setRackFormOpen(false)}
				onSaved={loadRacks}
			/>
		</Box>
	);
};

export default RacksDashboard;
