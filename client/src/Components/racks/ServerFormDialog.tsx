import { useState, useEffect } from "react";
import {
	Dialog,
	DialogTitle,
	DialogContent,
	DialogActions,
	TextField,
	Button,
	MenuItem,
	Box,
	Typography,
	IconButton,
	Alert,
	Chip,
} from "@mui/material";
import { X, Trash2, Plus, Link2 } from "lucide-react";
import { ServerService } from "@/Utils/ServerService";
import type { RackServer, ServerPort } from "@/Types/Rack";

const ROLES = [
	"web-service", "database", "app-server", "cache", "load-balancer",
	"firewall", "router", "switch", "dns", "mail", "storage",
	"hypervisor", "container", "other",
];
const ENVIRONMENTS = ["production", "staging", "development", "lab", "dmz"];
const FACES = ["front", "back", "both"];
const PORT_KINDS = ["RJ45", "Fiber", "Console", "USB", "Power", "Special"];

interface Props {
	open: boolean;
	server: RackServer | null;
	rackId: string;
	rackTotalU: number;
	defaultUStart?: number;
	onClose: () => void;
	onSaved: () => void;
	onManagePorts?: (server: RackServer) => void;
}

export const ServerFormDialog = ({ open, server, rackId, rackTotalU, defaultUStart, onClose, onSaved, onManagePorts }: Props) => {
	const isEdit = !!server;
	const [hostname, setHostname] = useState("");
	const [ipAddress, setIpAddress] = useState("");
	const [role, setRole] = useState("other");
	const [environment, setEnvironment] = useState("production");
	const [os, setOs] = useState("");
	const [hardwareModel, setHardwareModel] = useState("");
	const [serialNumber, setSerialNumber] = useState("");
	const [uStart, setUStart] = useState(1);
	const [uHeight, setUHeight] = useState(1);
	const [face, setFace] = useState("front");
	const [projectName, setProjectName] = useState("");
	const [isVmHost, setIsVmHost] = useState(false);
	const [vmNames, setVmNames] = useState("");
	const [sshUsername, setSshUsername] = useState("");
	const [sshPort, setSshPort] = useState(22);
	const [ports, setPorts] = useState<ServerPort[]>([{ name: "RJ45", label: "1" }]);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

	useEffect(() => {
		if (open) {
			setHostname(server?.hostname ?? "");
			setIpAddress(server?.ipAddress ?? "");
			setRole(server?.role ?? "other");
			setEnvironment(server?.environment ?? "production");
			setOs(server?.os ?? "");
			setHardwareModel(server?.hardwareModel ?? "");
			setSerialNumber(server?.serialNumber ?? "");
			setUStart(server?.uStart ?? defaultUStart ?? 1);
			setUHeight(server?.uHeight ?? 1);
			setFace(server?.face ?? "front");
			setProjectName(server?.projectName ?? "");
			setIsVmHost(server?.isVmHost ?? false);
			setVmNames((server?.vmNames ?? []).join(", "));
			setSshUsername(server?.sshUsername ?? "");
			setSshPort(server?.sshPort ?? 22);
			setPorts(server?.ports?.length ? server.ports : [{ name: "RJ45", label: "1" }]);
			setError("");
			setShowDeleteConfirm(false);
		}
	}, [open, server]);

	const maxStart = Math.max(1, rackTotalU - uHeight + 1);

	const handleAddPort = () => {
		setPorts([...ports, { name: "RJ45", label: String(ports.length + 1) }]);
	};

	const handleRemovePort = (idx: number) => {
		setPorts(ports.filter((_, i) => i !== idx));
	};

	const handlePortChange = (idx: number, field: keyof ServerPort, value: string) => {
		setPorts(ports.map((p, i) => i === idx ? { ...p, [field]: value } : p));
	};

	const handleSave = async () => {
		if (!hostname.trim()) { setError("Hostname is required"); return; }
		if (!ipAddress.trim()) { setError("IP Address is required"); return; }
		setSaving(true); setError("");
		try {
			const vmArr = vmNames.split(",").map(v => v.trim()).filter(Boolean);
			const body = {
				hostname: hostname.trim(),
				ipAddress: ipAddress.trim(),
				role, environment,
				os: os.trim() || undefined,
				hardwareModel: hardwareModel.trim() || undefined,
				serialNumber: serialNumber.trim() || undefined,
				rackId,
				uStart, uHeight, face,
				projectName: projectName.trim() || undefined,
				isVmHost,
				vmNames: vmArr,
				sshUsername: sshUsername.trim() || undefined,
				sshPort,
				ports: ports.filter(p => p.label.trim()),
			};
			if (isEdit && server) {
				await ServerService.updateServer(server.id, body);
			} else {
				await ServerService.createServer(body);
			}
			onSaved();
			onClose();
		} catch (err: unknown) {
			setError(err instanceof Error ? err.message : "Failed to save server");
		} finally {
			setSaving(false);
		}
	};

	const handleDelete = async () => {
		if (!server) return;
		setSaving(true);
		try {
			await ServerService.deleteServer(server.id);
			onSaved();
			onClose();
		} catch (err: unknown) {
			setError(err instanceof Error ? err.message : "Failed to delete server");
		} finally {
			setSaving(false);
		}
	};

	return (
		<Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
			<DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", pb: 1 }}>
				{isEdit ? "Edit Device" : "Add Device"}
				<IconButton size="small" onClick={onClose}><X size={18} /></IconButton>
			</DialogTitle>
			<DialogContent dividers sx={{ pt: 1 }}>
				{error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

				<Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
					<TextField
						label="Hostname"
						value={hostname}
						onChange={(e) => setHostname(e.target.value)}
						placeholder="e.g. SVR-10-vmwu16"
						required
						autoFocus
					/>
					<TextField
						label="IP Address"
						value={ipAddress}
						onChange={(e) => setIpAddress(e.target.value)}
						placeholder="e.g. 10.10.10.16"
						required
					/>
					<TextField select label="Role" value={role} onChange={(e) => setRole(e.target.value)}>
						{ROLES.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
					</TextField>
					<TextField select label="Environment" value={environment} onChange={(e) => setEnvironment(e.target.value)}>
						{ENVIRONMENTS.map((e) => <MenuItem key={e} value={e}>{e}</MenuItem>)}
					</TextField>
					<TextField select label="Start Unit (1=bottom)" value={uStart} onChange={(e) => setUStart(Number(e.target.value))}>
						{Array.from({ length: maxStart }, (_, i) => i + 1).map((u) => (
							<MenuItem key={u} value={u}>U{u}–{u + uHeight - 1}</MenuItem>
						))}
					</TextField>
					<TextField select label="Height (U)" value={uHeight} onChange={(e) => setUHeight(Number(e.target.value))}>
						{[1, 2, 3, 4, 5, 6].map((h) => <MenuItem key={h} value={h}>{h}U</MenuItem>)}
					</TextField>
					<TextField select label="Face" value={face} onChange={(e) => setFace(e.target.value)}>
						{FACES.map((f) => <MenuItem key={f} value={f}>{f}</MenuItem>)}
					</TextField>
					<TextField
						label="Hardware Model"
						value={hardwareModel}
						onChange={(e) => setHardwareModel(e.target.value)}
						placeholder="e.g. HP DL360p Gen8"
					/>
					<TextField
						label="Serial Number"
						value={serialNumber}
						onChange={(e) => setSerialNumber(e.target.value)}
						placeholder="e.g. MXQ84021"
					/>
					<TextField
						label="OS"
						value={os}
						onChange={(e) => setOs(e.target.value)}
						placeholder="e.g. Proxmox 8.2"
					/>
					<TextField
						label="Project Name"
						value={projectName}
						onChange={(e) => setProjectName(e.target.value)}
						placeholder="e.g. 10-IPDN"
					/>
					<TextField
						label="SSH Username"
						value={sshUsername}
						onChange={(e) => setSshUsername(e.target.value)}
						placeholder="e.g. root"
					/>
					<TextField
						label="SSH Port"
						type="number"
						value={sshPort}
						onChange={(e) => setSshPort(Number(e.target.value))}
					/>
				</Box>

				{/* VM Host */}
				<Box sx={{ mt: 2, display: "flex", alignItems: "center", gap: 1 }}>
					<Chip
						label="VM Host"
						color={isVmHost ? "primary" : "default"}
						variant={isVmHost ? "filled" : "outlined"}
						onClick={() => setIsVmHost(!isVmHost)}
						size="small"
					/>
					{isVmHost && (
						<TextField
							size="small"
							label="VM names (comma-separated)"
							value={vmNames}
							onChange={(e) => setVmNames(e.target.value)}
							placeholder="vm-proxmox1, vm-proxmox2"
							sx={{ flex: 1 }}
						/>
					)}
				</Box>

				{/* Ports editor */}
				<Box sx={{ mt: 2 }}>
					<Typography variant="subtitle2" sx={{ mb: 1 }}>Port Assignments</Typography>
					{ports.map((p, i) => (
						<Box key={i} sx={{ display: "flex", gap: 1, mb: 1, alignItems: "center" }}>
							<TextField
								select
								size="small"
								value={p.name}
								onChange={(e) => handlePortChange(i, "name", e.target.value)}
								sx={{ width: 130 }}
							>
								{PORT_KINDS.map((k) => <MenuItem key={k} value={k}>{k}</MenuItem>)}
							</TextField>
							<TextField
								size="small"
								value={p.label}
								onChange={(e) => handlePortChange(i, "label", e.target.value)}
								placeholder="Port # / label"
								sx={{ flex: 1 }}
							/>
							<TextField
								size="small"
								value={p.target ?? ""}
								onChange={(e) => handlePortChange(i, "target" as keyof ServerPort, e.target.value)}
								placeholder="→ target device/port"
								sx={{ flex: 1 }}
							/>
							<IconButton size="small" onClick={() => handleRemovePort(i)} disabled={ports.length <= 1}>
								<Trash2 size={14} />
							</IconButton>
						</Box>
					))}
					<Button
						size="small"
						variant="outlined"
						startIcon={<Plus size={14} />}
						onClick={handleAddPort}
						sx={{ mt: 0.5 }}
					>
						Add port
					</Button>
				</Box>
			</DialogContent>
			<DialogActions sx={{ px: 3, pb: 2, justifyContent: "space-between" }}>
				<Box sx={{ display: "flex", gap: 1 }}>
					{isEdit && !showDeleteConfirm && (
						<>
							<Button
								color="error"
								variant="outlined"
								startIcon={<Trash2 size={16} />}
								onClick={() => setShowDeleteConfirm(true)}
								disabled={saving}
							>
								Delete
							</Button>
							{onManagePorts && (
								<Button
									variant="outlined"
									startIcon={<Link2 size={16} />}
									onClick={() => { if (server) onManagePorts(server); }}
									disabled={saving}
								>
									Connections
								</Button>
							)}
						</>
					)}
					{showDeleteConfirm && (
						<Alert severity="warning" sx={{ py: 0 }}>
							Delete this device?
							<Button color="error" variant="contained" size="small" onClick={handleDelete} disabled={saving} sx={{ ml: 1 }}>
								Confirm
							</Button>
							<Button size="small" onClick={() => setShowDeleteConfirm(false)} sx={{ ml: 0.5 }}>
								Cancel
							</Button>
						</Alert>
					)}
				</Box>
				<Box sx={{ display: "flex", gap: 1 }}>
					<Button onClick={onClose} disabled={saving}>Cancel</Button>
					<Button variant="contained" onClick={handleSave} disabled={saving}>
						{saving ? "Saving…" : "Save"}
					</Button>
				</Box>
			</DialogActions>
		</Dialog>
	);
};
