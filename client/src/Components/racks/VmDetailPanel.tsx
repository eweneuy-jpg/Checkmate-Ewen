import { useState } from "react";
import {
	Box,
	Typography,
	Button,
	CircularProgress,
	Chip,
	Paper,
	Collapse,
	IconButton,
	Alert,
	Divider,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import {
	Radar,
	ChevronDown,
	ChevronRight,
	Cpu,
	MemoryStick,
	HardDrive,
	Network,
	Tag,
	MonitorPlay,
} from "lucide-react";
import type { RackServer, VirtualMachine, VmStatus } from "@/Types/Rack";
import { ServerService } from "@/Utils/ServerService";

const vmStatusColor: Record<VmStatus, string> = {
	running: "#22c55e",
	stopped: "#ef4444",
	paused: "#eab308",
};

interface Props {
	server: RackServer;
}

export const VmDetailPanel = ({ server }: Props) => {
	const [vms, setVms] = useState<VirtualMachine[]>([]);
	const [scanning, setScanning] = useState(false);
	const [scanned, setScanned] = useState(false);
	const [error, setError] = useState("");
	const [expandedVm, setExpandedVm] = useState<string | null>(null);

	const handleScan = async () => {
		setScanning(true);
		setError("");
		try {
			const result = await ServerService.scanVms(server.id);
			setVms(result);
			setScanned(true);
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : "Scan failed";
			setError(msg);
		} finally {
			setScanning(false);
		}
	};

	const formatRam = (mb: number): string => {
		if (mb >= 1024) return (mb / 1024).toFixed(0) + " GB";
		return mb + " MB";
	};

	// Show existing VM names from server data (pre-scan)
	const existingVmNames = server.vmNames ?? [];

	return (
		<Box>
			<Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
				<Typography variant="subtitle2" sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
					<MonitorPlay size={14} />
					Virtual Machines
				</Typography>
				<Button
					variant="outlined"
					size="small"
					startIcon={scanning ? <CircularProgress size={14} /> : <Radar size={14} />}
					onClick={handleScan}
					disabled={scanning}
				>
					{scanning ? "Scanning..." : "Scan VMs"}
				</Button>
			</Box>

			{error && (
				<Alert severity="error" sx={{ mb: 1, fontSize: 11 }}>
					{error}
				</Alert>
			)}

			{/* Pre-scan: show VM names from server data */}
			{!scanned && existingVmNames.length > 0 && (
				<Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mb: 1 }}>
					{existingVmNames.map((name) => (
						<Chip key={name} label={name} size="small" variant="outlined" sx={{ fontSize: 10 }} />
					))}
				</Box>
			)}

			{/* Post-scan: show full VM details */}
			{scanned && vms.length === 0 && (
				<Typography variant="body2" color="text.secondary" sx={{ fontSize: 11, py: 1 }}>
					No VMs discovered. Make sure the server OS field is set to "proxmox", "esxi", or "kvm".
				</Typography>
			)}

			{scanned && vms.length > 0 && (
				<Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
					{vms.map((vm) => {
						const isExpanded = expandedVm === vm.id;
						const color = vmStatusColor[vm.status] ?? "#64748b";
						return (
							<Paper key={vm.id} variant="outlined" sx={{ overflow: "hidden" }}>
								<Box
									onClick={() => setExpandedVm(isExpanded ? null : vm.id)}
									sx={{
										display: "flex",
										alignItems: "center",
										gap: 0.5,
										p: 0.75,
										cursor: "pointer",
										"&:hover": { bgcolor: "action.hover" },
									}}
								>
									<IconButton size="small" sx={{ p: 0 }}>
										{isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
									</IconButton>
									<Chip
										label={vm.status}
										size="small"
										sx={{
											backgroundColor: color + "22",
											color,
											fontSize: 9,
											fontWeight: 700,
											height: 16,
										}}
									/>
									<Typography variant="body2" sx={{ fontWeight: 600, fontSize: 11 }}>
										{vm.name}
									</Typography>
									<Typography variant="caption" sx={{ fontSize: 9, color: "text.disabled", ml: "auto" }}>
										{vm.vcpu} vCPU / {formatRam(vm.ramMB)}
									</Typography>
								</Box>
								<Collapse in={isExpanded}>
									<Divider />
									<Box sx={{ p: 1 }}>
										<Grid container spacing={1}>
											<Grid size={6}>
												<Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
													<Cpu size={10} />
													<Typography variant="caption" sx={{ fontSize: 9, color: "text.secondary" }}>
														vCPU
													</Typography>
												</Box>
												<Typography variant="body2" sx={{ fontSize: 11, fontWeight: 600 }}>
													{vm.vcpu} cores
												</Typography>
											</Grid>
											<Grid size={6}>
												<Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
													<MemoryStick size={10} />
													<Typography variant="caption" sx={{ fontSize: 9, color: "text.secondary" }}>
														RAM
													</Typography>
												</Box>
												<Typography variant="body2" sx={{ fontSize: 11, fontWeight: 600 }}>
													{formatRam(vm.ramMB)}
												</Typography>
											</Grid>
											<Grid size={6}>
												<Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
													<HardDrive size={10} />
													<Typography variant="caption" sx={{ fontSize: 9, color: "text.secondary" }}>
														Disk
													</Typography>
												</Box>
												<Typography variant="body2" sx={{ fontSize: 11, fontWeight: 600 }}>
													{vm.diskGB > 0 ? vm.diskGB + " GB" : "--"}
												</Typography>
											</Grid>
											<Grid size={6}>
												<Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
													<Tag size={10} />
													<Typography variant="caption" sx={{ fontSize: 9, color: "text.secondary" }}>
														OS
													</Typography>
												</Box>
												<Typography variant="body2" sx={{ fontSize: 11, fontWeight: 600 }}>
													{vm.os || "--"}
												</Typography>
											</Grid>
											<Grid size={6}>
												<Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
													<Network size={10} />
													<Typography variant="caption" sx={{ fontSize: 9, color: "text.secondary" }}>
														MAC
													</Typography>
												</Box>
												<Typography variant="body2" sx={{ fontSize: 10, fontWeight: 600, fontFamily: "monospace" }}>
													{vm.macAddress || "--"}
												</Typography>
											</Grid>
											<Grid size={6}>
												<Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
													<Network size={10} />
													<Typography variant="caption" sx={{ fontSize: 9, color: "text.secondary" }}>
														VLAN
													</Typography>
												</Box>
												<Typography variant="body2" sx={{ fontSize: 11, fontWeight: 600 }}>
													{vm.vlanId !== null ? "VLAN " + vm.vlanId : "--"}
												</Typography>
											</Grid>
										</Grid>
										{vm.ipAddress && (
											<Box sx={{ mt: 0.5 }}>
												<Typography variant="caption" sx={{ fontSize: 9, color: "text.secondary" }}>
													IP: {vm.ipAddress}
												</Typography>
											</Box>
										)}
										<Box sx={{ mt: 0.5 }}>
											<Chip
												label={vm.hypervisor.toUpperCase()}
												size="small"
												variant="outlined"
												sx={{ fontSize: 8, height: 14 }}
											/>
										</Box>
									</Box>
								</Collapse>
							</Paper>
						);
					})}
				</Box>
			)}
		</Box>
	);
};
