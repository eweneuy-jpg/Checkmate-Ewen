import { useEffect, useState } from "react";
import {
	Dialog,
	DialogTitle,
	DialogContent,
	DialogActions,
	Button,
	TextField,
	MenuItem,
	Box,
	Typography,
	CircularProgress,
	Alert,
	Switch,
	FormControlLabel,
	InputAdornment,
} from "@mui/material";
import { Rocket, Server } from "lucide-react";
import type { VmTemplate, VirtualMachine } from "@/Types/Rack";
import { ServerService } from "@/Utils/ServerService";

interface Props {
	open: boolean;
	serverId: string;
	onClose: () => void;
	onCreated: (vm: VirtualMachine) => void;
}

/** Dialog untuk provisioning VM baru dari template (ala Hostinger). */
export const VmFormDialog = ({ open, serverId, onClose, onCreated }: Props) => {
	const [templates, setTemplates] = useState<VmTemplate[]>([]);
	const [loadingTemplates, setLoadingTemplates] = useState(false);
	const [creating, setCreating] = useState(false);
	const [error, setError] = useState("");

	// Form state
	const [templateId, setTemplateId] = useState("");
	const [name, setName] = useState("");
	const [vcpu, setVcpu] = useState(2);
	const [ramGB, setRamGB] = useState(2);
	const [diskGB, setDiskGB] = useState(20);
	const [vlanTag, setVlanTag] = useState("");
	const [ipAddress, setIpAddress] = useState("");
	const [gateway, setGateway] = useState("");
	const [startVm, setStartVm] = useState(true);

	// Load templates saat dialog dibuka
	useEffect(() => {
		if (!open || !serverId) return;
		setTemplates([]);
		setTemplateId("");
		setName("");
		setError("");
		setVcpu(2);
		setRamGB(2);
		setDiskGB(20);
		setVlanTag("");
		setIpAddress("");
		setGateway("");
		setStartVm(true);
		setLoadingTemplates(true);
		ServerService.listVmTemplates(serverId)
			.then((list) => {
				setTemplates(list);
				if (list.length > 0) {
					setTemplateId(list[0]?.id ?? "");
					// Pre-fill dari template pertama
					const t = list[0];
					if (t) {
						setVcpu(Math.max(1, t.vcpu));
						setRamGB(Math.max(1, Math.round(t.ramMB / 1024)));
						setDiskGB(Math.max(1, t.diskGB));
					}
				}
			})
			.catch((e: unknown) => {
				const msg = e instanceof Error ? e.message : "Failed to load templates";
				setError(msg);
			})
			.finally(() => setLoadingTemplates(false));
	}, [open, serverId]);

	const handleTemplateChange = (id: string) => {
		setTemplateId(id);
		const t = templates.find((x) => x.id === id);
		if (t) {
			setVcpu(Math.max(1, t.vcpu));
			setRamGB(Math.max(1, Math.round(t.ramMB / 1024)));
			setDiskGB(Math.max(1, t.diskGB));
		}
	};

	const handleCreate = async () => {
		if (!name.trim()) {
			setError("VM name is required");
			return;
		}
		if (!templateId) {
			setError("Select a template");
			return;
		}
		setCreating(true);
		setError("");
		try {
			const vm = await ServerService.provisionVm(serverId, {
				name: name.trim(),
				templateId,
				vcpu,
				ramMB: ramGB * 1024,
				diskGB,
				vlanTag: vlanTag ? parseInt(vlanTag, 10) : undefined,
				ipAddress: ipAddress || undefined,
				gateway: gateway || undefined,
				startVm,
			});
			onCreated(vm);
			onClose();
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : "Provisioning failed";
			setError(msg);
		} finally {
			setCreating(false);
		}
	};

	return (
		<Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
			<DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, fontSize: 16 }}>
				<Rocket size={16} />
				New VM
			</DialogTitle>
			<DialogContent>
				{error && (
					<Alert severity="error" sx={{ mb: 1.5, fontSize: 11 }}>
						{error}
					</Alert>
				)}

				{loadingTemplates ? (
					<Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
						<CircularProgress size={22} />
					</Box>
				) : templates.length === 0 ? (
					<Alert severity="warning" sx={{ fontSize: 11 }}>
						No templates found on this hypervisor. Create a VM template first (e.g. Proxmox: convert a VM to
						template), then reload.
					</Alert>
				) : (
					<Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mt: 1 }}>
						<TextField
							select
							label="Template"
							size="small"
							fullWidth
							value={templateId}
							onChange={(e) => handleTemplateChange(e.target.value)}
							SelectProps={{ startAdornment: <Server size={13} style={{ marginRight: 6, opacity: 0.6 }} /> }}
						>
							{templates.map((t) => (
								<MenuItem key={t.id} value={t.id}>
									{t.name} ({t.vcpu} vCPU / {Math.round(t.ramMB / 1024)} GB / {t.diskGB} GB)
								</MenuItem>
							))}
						</TextField>

						<TextField
							label="VM name"
							size="small"
							fullWidth
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="vm-web-01"
							helperText="lowercase letters, numbers, dash"
						/>

						<Box sx={{ display: "flex", gap: 1 }}>
							<TextField
								label="vCPU"
								type="number"
								size="small"
								value={vcpu}
								onChange={(e) => setVcpu(Math.max(1, parseInt(e.target.value || "1", 10)))}
								inputProps={{ min: 1, max: 128 }}
							/>
							<TextField
								label="RAM (GB)"
								type="number"
								size="small"
								value={ramGB}
								onChange={(e) => setRamGB(Math.max(1, parseInt(e.target.value || "1", 10)))}
								inputProps={{ min: 1, max: 1024 }}
							/>
							<TextField
								label="Disk (GB)"
								type="number"
								size="small"
								value={diskGB}
								onChange={(e) => setDiskGB(Math.max(1, parseInt(e.target.value || "1", 10)))}
								inputProps={{ min: 1, max: 16384 }}
							/>
						</Box>

						<Box sx={{ display: "flex", gap: 1 }}>
							<TextField
								label="VLAN tag"
								size="small"
								value={vlanTag}
								onChange={(e) => setVlanTag(e.target.value)}
								placeholder="optional"
								inputProps={{ inputMode: "numeric" }}
							/>
							<TextField
								label="Bridge"
								size="small"
								value={""}
								disabled
								placeholder="vmbr0 (default)"
								sx={{ flex: 1 }}
							/>
						</Box>

						<Box sx={{ display: "flex", gap: 1 }}>
							<TextField
								label="Static IP (cloud-init)"
								size="small"
								value={ipAddress}
								onChange={(e) => setIpAddress(e.target.value)}
								placeholder="optional, e.g. 10.10.10.51"
								sx={{ flex: 1 }}
								InputProps={{
									startAdornment: (
										<InputAdornment position="start">
											<Typography sx={{ fontSize: 10, color: "text.disabled" }}>IP</Typography>
										</InputAdornment>
									),
								}}
							/>
							<TextField
								label="Gateway"
								size="small"
								value={gateway}
								onChange={(e) => setGateway(e.target.value)}
								placeholder="optional"
							/>
						</Box>

						<FormControlLabel
							control={<Switch checked={startVm} onChange={(e) => setStartVm(e.target.checked)} size="small" />}
							label="Start VM after creation"
							sx={{ "& .MuiFormControlLabel-label": { fontSize: 12 } }}
						/>
					</Box>
				)}
			</DialogContent>
			<DialogActions sx={{ px: 3, pb: 2 }}>
				<Button onClick={onClose} size="small">
					Cancel
				</Button>
				<Button
					variant="contained"
					size="small"
					onClick={handleCreate}
					disabled={creating || loadingTemplates || templates.length === 0}
					startIcon={creating ? <CircularProgress size={12} /> : <Rocket size={12} />}
				>
					{creating ? "Creating..." : "Create VM"}
				</Button>
			</DialogActions>
		</Dialog>
	);
};
