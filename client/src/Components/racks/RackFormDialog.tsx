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
} from "@mui/material";
import { X, Trash2, Plus } from "lucide-react";
import { RackService } from "@/Utils/RackService";
import type { RackSummary } from "@/Types/Rack";

const RACK_SIZES = [6, 12, 18, 24, 32, 42, 48];

interface Props {
	open: boolean;
	rack: RackSummary | null;
	onClose: () => void;
	onSaved: () => void;
}

export const RackFormDialog = ({ open, rack, onClose, onSaved }: Props) => {
	const isEdit = !!rack;
	const [name, setName] = useState("");
	const [location, setLocation] = useState("");
	const [totalU, setTotalU] = useState(42);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

	useEffect(() => {
		if (open) {
			setName(rack?.name ?? "");
			setLocation(rack?.location ?? "");
			setTotalU(rack?.totalU ?? 42);
			setError("");
			setShowDeleteConfirm(false);
		}
	}, [open, rack]);

	const handleSave = async () => {
		if (!name.trim()) {
			setError("Rack name is required");
			return;
		}
		setSaving(true);
		setError("");
		try {
			if (isEdit && rack) {
				await RackService.updateRack(rack.id, {
					name: name.trim(),
					location: location.trim(),
					totalU,
				});
			} else {
				await RackService.createRack({
					name: name.trim(),
					location: location.trim(),
					totalU,
				});
			}
			onSaved();
			onClose();
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : "Failed to save rack";
			setError(msg);
		} finally {
			setSaving(false);
		}
	};

	const handleDelete = async () => {
		if (!rack) return;
		setSaving(true);
		try {
			await RackService.deleteRack(rack.id);
			onSaved();
			onClose();
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : "Failed to delete rack";
			setError(msg);
		} finally {
			setSaving(false);
		}
	};

	return (
		<Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
			<DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", pb: 1 }}>
				{isEdit ? "Edit Rack" : "Add Rack"}
				<IconButton size="small" onClick={onClose}><X size={18} /></IconButton>
			</DialogTitle>
			<DialogContent sx={{ pt: 1 }}>
				<Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
					A rack is a vertical panel. Choose its size in rack units (1U = 1.75 inches).
				</Typography>

				{error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

				<Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
					<TextField
						label="Name"
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder="e.g. 10-IPDN NETS4"
						fullWidth
						required
						autoFocus
					/>
					<TextField
						label="Site / Location"
						value={location}
						onChange={(e) => setLocation(e.target.value)}
						placeholder="e.g. DC-01 · PT. Net Sentra Cyberindo"
						fullWidth
					/>
					<TextField
						select
						label="Rack units (size)"
						value={totalU}
						onChange={(e) => setTotalU(Number(e.target.value))}
						fullWidth
					>
						{RACK_SIZES.map((u) => (
							<MenuItem key={u} value={u}>{u} units</MenuItem>
						))}
					</TextField>
				</Box>
			</DialogContent>
			<DialogActions sx={{ px: 3, pb: 2, justifyContent: "space-between" }}>
				<Box>
					{isEdit && !showDeleteConfirm && (
						<Button
							color="error"
							variant="outlined"
							startIcon={<Trash2 size={16} />}
							onClick={() => setShowDeleteConfirm(true)}
							disabled={saving}
						>
							Remove rack
						</Button>
					)}
					{showDeleteConfirm && (
						<Alert severity="warning" sx={{ py: 0 }}>
							Delete this rack and all its devices?
							<Button
								color="error"
								variant="contained"
								size="small"
								onClick={handleDelete}
								disabled={saving}
								sx={{ ml: 1 }}
							>
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
					<Button
						variant="contained"
						onClick={handleSave}
						disabled={saving}
						startIcon={isEdit ? undefined : <Plus size={16} />}
					>
						{saving ? "Saving…" : "Save"}
					</Button>
				</Box>
			</DialogActions>
		</Dialog>
	);
};
