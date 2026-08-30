import { useState, useEffect, useMemo } from "react";
import {
	Dialog,
	DialogTitle,
	DialogContent,
	DialogActions,
	Button,
	Box,
	Typography,
	IconButton,
	Alert,
	Chip,
	MenuItem,
	TextField,
	Paper,
	CircularProgress,
} from "@mui/material";
import { X, Link2, Trash2, Plus, Radar, CheckCircle2 } from "lucide-react";
import { ServerService } from "@/Utils/ServerService";
import type { RackServer, RackWithSlots, ServerPort } from "@/Types/Rack";

interface Props {
	open: boolean;
	server: RackServer | null;
	rack: RackWithSlots | null;
	allRacks: RackWithSlots[];
	onClose: () => void;
	onSaved: () => void;
}

interface Connection {
	id: string;
	fromPort: string;
	toServerId: string;
	toServerName: string;
	toPort: string;
}

export const PortConnectionsDialog = ({ open, server, rack, allRacks, onClose, onSaved }: Props) => {
	const [saving, setSaving] = useState(false);
	const [scanning, setScanning] = useState(false);
	const [scanResults, setScanResults] = useState<{ localPort: string; remoteHostname: string; remotePort: string }[]>([]);
	const [scanApplied, setScanApplied] = useState(false);
	const [error, setError] = useState("");
	const [connections, setConnections] = useState<Connection[]>([]);
	const [newFromPort, setNewFromPort] = useState("");
	const [newToServer, setNewToServer] = useState("");
	const [newToPort, setNewToPort] = useState("");

	// All servers in the same rack (excluding current)
	const rackServers = useMemo(() => {
		if (!rack) return [];
		return rack.slots
			.filter((s) => s.server && s.server.id !== server?.id)
			.map((s) => s.server!) as RackServer[];
	}, [rack, server]);

	// Current server's ports
	const serverPorts = server?.ports ?? [];

	// Load existing connections from ports' target field
	useEffect(() => {
		if (open && server) {
			const conns: Connection[] = [];
			(server.ports ?? []).forEach((p) => {
				if (p.target) {
					// target format: "serverId/port" or "serverName/port"
					const parts = p.target.split("/");
					if (parts.length >= 2) {
						conns.push({
							id: `${p.name}/${p.label}`,
							fromPort: `${p.name}/${p.label}`,
							toServerId: parts[0],
							toServerName: parts[0],
							toPort: parts.slice(1).join("/"),
						});
					}
				}
			});
			setConnections(conns);
			setNewFromPort(serverPorts[0] ? `${serverPorts[0].name}/${serverPorts[0].label}` : "");
			setError("");
		}
	}, [open, server]);

	const selectedToServer = rackServers.find((s) => s.id === newToServer);
	const toServerPorts = selectedToServer?.ports ?? [];

	const handleAddConnection = async () => {
		if (!newFromPort || !newToServer || !newToPort) {
			setError("Select port on both sides");
			return;
		}
		// Check duplicate
		const dup = connections.some(c =>
			c.fromPort === newFromPort && c.toServerId === newToServer && c.toPort === newToPort
		);
		if (dup) { setError("That link already exists"); return; }

		setConnections([...connections, {
			id: `${newFromPort}→${newToServer}/${newToPort}`,
			fromPort: newFromPort,
			toServerId: newToServer,
			toServerName: selectedToServer?.hostname ?? newToServer,
			toPort: newToPort,
		}]);
		setNewToServer("");
		setNewToPort("");
		setError("");
	};

	const handleRemoveConnection = (id: string) => {
		setConnections(connections.filter(c => c.id !== id));
	};

	const handleScan = async () => {
		if (!server) return;
		setScanning(true); setError("");
		setScanResults([]); setScanApplied(false);
		try {
			const neighbors = await ServerService.scanConnections(server.id);
			setScanResults(neighbors);
		} catch (err: unknown) {
			setError(err instanceof Error ? err.message : "LLDP scan failed — check SSH credentials");
		} finally {
			setScanning(false);
		}
	};

	const handleApplyScan = () => {
		// Merge scan results into connections
		const newConns: Connection[] = scanResults.map(sr => {
			const portKey = sr.localPort;
			return {
				id: `${portKey}→${sr.remoteHostname}/${sr.remotePort}`,
				fromPort: portKey,
				toServerId: sr.remoteHostname,
				toServerName: sr.remoteHostname,
				toPort: sr.remotePort,
			};
		});
		// Deduplicate against existing
		const merged = [...connections];
		for (const nc of newConns) {
			if (!merged.some(c => c.fromPort === nc.fromPort && c.toServerId === nc.toServerId && c.toPort === nc.toPort)) {
				merged.push(nc);
			}
		}
		setConnections(merged);
		setScanApplied(true);
	};

	const handleSave = async () => {
		if (!server) return;
		setSaving(true); setError("");
		try {
			// Update ports with target field
			const updatedPorts: ServerPort[] = serverPorts.map(p => {
				const portKey = `${p.name}/${p.label}`;
				const conn = connections.find(c => c.fromPort === portKey);
				return {
					...p,
					target: conn ? `${conn.toServerId}/${conn.toPort}` : undefined,
				};
			});
			await ServerService.updateServer(server.id, { ports: updatedPorts });
			onSaved();
			onClose();
		} catch (err: unknown) {
			setError(err instanceof Error ? err.message : "Failed to save connections");
		} finally {
			setSaving(false);
		}
	};

	if (!server) return null;

	return (
		<Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
			<DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", pb: 1 }}>
				<Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
					<Link2 size={20} />
					Connections for <em>{server.hostname}</em>
				</Box>
				<IconButton size="small" onClick={onClose}><X size={18} /></IconButton>
			</DialogTitle>
			<DialogContent dividers sx={{ pt: 1 }}>
				<Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
					Each link names the port on both sides (NIC / switch / patch panel / firewall port).
				</Typography>

				{error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

				{/* Existing connections */}
				{connections.length === 0 ? (
					<Paper variant="outlined" sx={{ p: 3, textAlign: "center", mb: 2 }}>
						<Typography color="text.secondary" variant="body2">No links yet.</Typography>
					</Paper>
				) : (
					<Box sx={{ display: "flex", flexDirection: "column", gap: 1, mb: 2 }}>
						{connections.map((c) => (
							<Paper key={c.id} variant="outlined" sx={{ p: 1.5, display: "flex", alignItems: "center", gap: 1 }}>
								<Chip size="small" color="primary" label={c.fromPort} />
								<Link2 size={14} style={{ opacity: 0.5 }} />
								<Typography variant="body2" sx={{ fontWeight: 600 }}>{c.toServerName}</Typography>
								<Chip size="small" variant="outlined" label={c.toPort} />
								<Box sx={{ flex: 1 }} />
								<IconButton size="small" color="error" onClick={() => handleRemoveConnection(c.id)}>
									<Trash2 size={14} />
								</IconButton>
							</Paper>
						))}
					</Box>
				)}

				{/* LLDP Auto-Scan */}
				<Box sx={{ mb: 2 }}>
					<Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
						<Button
							variant="outlined"
							size="small"
							startIcon={scanning ? <CircularProgress size={14} /> : <Radar size={16} />}
							onClick={handleScan}
							disabled={scanning || saving}
						>
							{scanning ? "Scanning…" : "LLDP Auto-Scan"}
						</Button>
						{scanApplied && (
							<Chip size="small" color="success" icon={<CheckCircle2 size={14} />} label="Applied" />
						)}
					</Box>
					{scanResults.length > 0 && !scanApplied && (
						<Paper variant="outlined" sx={{ p: 1.5, bgcolor: "rgba(34,197,94,0.05)" }}>
							<Typography variant="subtitle2" sx={{ mb: 1, color: "success.main" }}>
								Discovered {scanResults.length} LLDP neighbors:
							</Typography>
							<Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, mb: 1 }}>
								{scanResults.map((sr, i) => (
									<Box key={i} sx={{ display: "flex", alignItems: "center", gap: 0.5, fontSize: 12 }}>
										<Chip size="small" color="primary" label={sr.localPort} />
										<Link2 size={12} style={{ opacity: 0.5 }} />
										<Typography variant="body2" sx={{ fontWeight: 600 }}>{sr.remoteHostname}</Typography>
										<Chip size="small" variant="outlined" label={sr.remotePort} />
									</Box>
								))}
							</Box>
							<Button size="small" variant="contained" color="success" onClick={handleApplyScan}>
								Apply {scanResults.length} connections
							</Button>
						</Paper>
					)}
				</Box>

				{/* Add new connection */}
				<Paper variant="outlined" sx={{ p: 2, bgcolor: "action.hover" }}>
					<Typography variant="subtitle2" sx={{ mb: 1 }}>Add New Link</Typography>
					<Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr 1fr auto" }, gap: 1, alignItems: "center" }}>
						<TextField
							select
							size="small"
							label="This device port"
							value={newFromPort}
							onChange={(e) => setNewFromPort(e.target.value)}
						>
							{serverPorts.map((p, i) => (
								<MenuItem key={i} value={`${p.name}/${p.label}`}>{p.name} {p.label}</MenuItem>
							))}
						</TextField>
						<TextField
							select
							size="small"
							label="Connect to device"
							value={newToServer}
							onChange={(e) => { setNewToServer(e.target.value); setNewToPort(""); }}
						>
							{rackServers.map((s) => (
								<MenuItem key={s.id} value={s.id}>{s.hostname}</MenuItem>
							))}
						</TextField>
						<TextField
							select
							size="small"
							label="Target port"
							value={newToPort}
							onChange={(e) => setNewToPort(e.target.value)}
							disabled={!newToServer}
						>
							{toServerPorts.map((p, i) => (
								<MenuItem key={i} value={`${p.name}/${p.label}`}>{p.name} {p.label}</MenuItem>
							))}
						</TextField>
						<Button
							variant="contained"
							size="small"
							startIcon={<Plus size={14} />}
							onClick={handleAddConnection}
						>
							Add
						</Button>
					</Box>
				</Paper>
			</DialogContent>
			<DialogActions sx={{ px: 3, pb: 2 }}>
				<Button onClick={onClose}>Done</Button>
				<Button variant="contained" onClick={handleSave} disabled={saving}>
					{saving ? "Saving…" : "Save Connections"}
				</Button>
			</DialogActions>
		</Dialog>
	);
};
