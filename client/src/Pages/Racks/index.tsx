import { useState, useEffect, useCallback } from "react";
import {
	Box,
	Typography,
	CircularProgress,
	MenuItem,
	TextField,
	Grid2,
	Paper,
} from "@mui/material";
import { RackDiagram } from "@/Components/racks/RackDiagram";
import { ServerDetailPanel } from "@/Components/racks/ServerDetailPanel";
import { RackService } from "@/Utils/RackService";
import type { RackSummary, RackWithSlots, RackServer } from "@/Types/Rack";

const RacksPage = () => {
	const [summaries, setSummaries] = useState<RackSummary[]>([]);
	const [selectedRackId, setSelectedRackId] = useState<string>("ALL");
	const [racks, setRacks] = useState<RackWithSlots[]>([]);
	const [loading, setLoading] = useState(true);
	const [selectedServer, setSelectedServer] = useState<RackServer | null>(null);
	const [selectedServerRack, setSelectedServerRack] = useState<RackWithSlots | null>(null);

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
		<Box sx={{ p: 3 }}>
			<Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
				<Typography variant="h5" sx={{ fontWeight: 600 }}>
					Rack Management
				</Typography>
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
							{s.serverCount > 0 && s.serverCount === 0 ? "" : ""}
						</MenuItem>
					))}
				</TextField>
			</Box>

			<Box sx={{ display: "flex", gap: 3, alignItems: "flex-start" }}>
				{/* Rack diagrams */}
				<Box sx={{ flex: 1, display: "flex", gap: 2, flexWrap: "wrap", justifyContent: "center" }}>
					{filteredRacks.length === 0 ? (
						<Paper sx={{ p: 4, textAlign: "center" }}>
							<Typography color="text.secondary">
								No racks found. Create one via Telegram bot: <code>/addrack name location [totalU]</code>
							</Typography>
						</Paper>
					) : (
						filteredRacks.map((rack) => (
							<RackDiagram
								key={rack.id}
								rack={rack}
								onServerClick={handleServerClick}
								selectedServerId={selectedServer?.id}
							/>
						))
					)}
				</Box>

				{/* Detail panel */}
				<Box sx={{ width: 300, flexShrink: 0 }}>
					{selectedServer && selectedServerRack ? (
						<ServerDetailPanel server={selectedServer} rack={selectedServerRack} />
					) : (
						<Paper sx={{ p: 4, textAlign: "center" }}>
							<Typography color="text.secondary" variant="body2">
								Click a server in the rack diagram to see details
							</Typography>
						</Paper>
					)}
				</Box>
			</Box>
		</Box>
	);
};

export default RacksPage;
