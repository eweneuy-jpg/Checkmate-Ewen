/**
 * LLDP/CDP neighbor discovery — multi-vendor parser.
 *
 * SSH ke switch/router, jalankan LLDP neighbors command, parse output
 * untuk dapatkan: local port → remote hostname + remote port.
 *
 * Supports:
 *   - Cisco IOS-XE:  `show lldp neighbors detail`
 *   - Cisco NX-OS:   `show lldp neighbors detail`
 *   - Huawei CE:     `display lldp neighbor`
 *   - FortiGate:     `diagnose lldp neighbor list`
 *   - Generic Linux: `lldpctl`  (optional fallback)
 */

export interface LldpNeighbor {
	localPort: string;
	remoteHostname: string;
	remotePort: string;
	remoteChassisId?: string;
	remoteDescription?: string;
}

/**
 * Detect vendor from SSH output content.
 */
const detectVendor = (output: string): "cisco-ios" | "cisco-nxos" | "huawei" | "fortigate" | "linux" | "unknown" => {
	const lower = output.toLowerCase();
	if (lower.includes("diagnose lldp") || lower.includes("fortios")) return "fortigate";
	if (lower.includes("display lldp")) return "huawei";
	if (lower.includes("capability codes") && lower.includes("local intf")) return "cisco-nxos";
	if (lower.includes("capability codes") || lower.includes("local intf") || lower.includes("device id")) return "cisco-ios";
	if (lower.includes("lldpctl") || lower.includes("lldp.neighbors")) return "linux";
	return "unknown";
};

/**
 * Parse Cisco IOS-XE `show lldp neighbors detail` output.
 *
 * Example:
 *   ----------
 *   Local Intf: Gi0/1
 *   Chassis ID: 0011.2233.4455
 *   Port ID: eth0
 *   Port Description: Ethernet0
 *   System Name: SVR-10-vmwu16
 *   ----------
 */
const parseCiscoIos = (output: string): LldpNeighbor[] => {
	const neighbors: LldpNeighbor[] = [];
	const blocks = output.split(/^-+$/m);
	for (const block of blocks) {
		const localIntf = block.match(/Local Intf:\s*(.+)/i)?.[1]?.trim();
		const portId = block.match(/Port ID:\s*(.+)/i)?.[1]?.trim();
		const chassisId = block.match(/Chassis ID:\s*(.+)/i)?.[1]?.trim();
		const sysName = block.match(/System Name:\s*(.+)/i)?.[1]?.trim();
		const portDesc = block.match(/Port Description:\s*(.+)/i)?.[1]?.trim();
		if (localIntf && (sysName || chassisId)) {
			neighbors.push({
				localPort: localIntf,
				remoteHostname: sysName || chassisId || "unknown",
				remotePort: portId ?? "",
				remoteChassisId: chassisId ?? "",
				remoteDescription: portDesc ?? "",
			});
		}
	}
	return neighbors;
};

/**
 * Parse Cisco NX-OS `show lldp neighbors` (table format).
 *
 * Example:
 *   Capability codes:
 *   Local Intf   Chassis ID         Port ID           Capability
 *   Gi0/1        0011.2233.4455     eth0              B
 *   Gi0/2        0066.7788.99aa     eth0              B
 */
const parseCiscoNxos = (output: string): LldpNeighbor[] => {
	const neighbors: LldpNeighbor[] = [];
	const lines = output.split("\n");
	for (const line of lines) {
		// Match: <intf> <chassis-id> <port-id> <capability>
		const m = line.match(/^(\S+)\s+([0-9a-fA-F:.]+)\s+(\S+)\s+([A-Z]+)\s*$/);
		if (m) {
			neighbors.push({
				localPort: m[1] ?? "",
				remoteHostname: m[2] ?? "unknown",
				remotePort: m[3] ?? "",
				remoteChassisId: m[2] ?? "",
			});
		}
	}
	return neighbors;
};

/**
 * Parse Huawei CE `display lldp neighbor` output.
 *
 * Example:
 *   GigabitEthernet0/0/1 has 1 neighbor(s):
 *    Neighbor 1:
 *     Chassis ID : 0011-2233-4455
 *     Port ID    : eth0
 *     System Name: SVR-10-vmwu16
 */
const parseHuawei = (output: string): LldpNeighbor[] => {
	const neighbors: LldpNeighbor[] = [];
	const portBlocks = output.split(/(\S+)\s+has\s+\d+\s+neighbor/i);
	let currentPort = "";
	for (let i = 0; i < portBlocks.length; i++) {
		const block = portBlocks[i] ?? "";
		if (i % 2 === 0) {
			currentPort = block.trim();
		} else {
			const chassisId = block.match(/Chassis ID\s*:\s*(.+)/i)?.[1]?.trim();
			const portId = block.match(/Port ID\s*:\s*(.+)/i)?.[1]?.trim();
			const sysName = block.match(/System Name\s*:\s*(.+)/i)?.[1]?.trim();
			if (currentPort && (sysName || chassisId)) {
				neighbors.push({
					localPort: currentPort,
					remoteHostname: sysName || chassisId || "unknown",
					remotePort: portId ?? "",
					remoteChassisId: chassisId,
				});
			}
		}
	}
	return neighbors;
};

/**
 * Parse FortiGate `diagnose lldp neighbor list` output.
 *
 * Example:
 *   lldp.neighbor:
 *       local interface: port1
 *       chassis id: 00:11:22:33:44:55
 *       port id: eth0
 *       system name: SVR-10-vmwu16
 */
const parseFortigate = (output: string): LldpNeighbor[] => {
	const neighbors: LldpNeighbor[] = [];
	const blocks = output.split(/lldp\.neighbor:?/i);
	for (const blockRaw of blocks) {
		const block = blockRaw ?? "";
		const localIntf = block.match(/local interface:\s*(.+)/i)?.[1]?.trim();
		const chassisId = block.match(/chassis id:\s*(.+)/i)?.[1]?.trim();
		const portId = block.match(/port id:\s*(.+)/i)?.[1]?.trim();
		const sysName = block.match(/system name:\s*(.+)/i)?.[1]?.trim();
		if (localIntf && (sysName || chassisId)) {
			neighbors.push({
				localPort: localIntf,
				remoteHostname: sysName || chassisId || "unknown",
				remotePort: portId ?? "",
				remoteChassisId: chassisId,
			});
		}
	}
	return neighbors;
};

/**
 * Parse Linux `lldpctl` output.
 *
 * Example:
 *   et1:
 *     ChassisID: 001122334455
 *     PortID: eth0
 *     SysName: SVR-10-vmwu16
 */
const parseLinux = (output: string): LldpNeighbor[] => {
	const neighbors: LldpNeighbor[] = [];
	const blocks = output.split(/^(\S+):$/m);
	let currentPort = "";
	for (let i = 0; i < blocks.length; i++) {
		const block = blocks[i] ?? "";
		if (i % 2 === 1) {
			currentPort = block.trim().replace(/:$/, "");
		} else if (currentPort) {
			const chassisId = block.match(/ChassisID:\s*(.+)/i)?.[1]?.trim();
			const portId = block.match(/PortID:\s*(.+)/i)?.[1]?.trim();
			const sysName = block.match(/SysName:\s*(.+)/i)?.[1]?.trim();
			if (currentPort && (sysName || chassisId)) {
				neighbors.push({
					localPort: currentPort,
					remoteHostname: sysName || chassisId || "unknown",
					remotePort: portId ?? "",
					remoteChassisId: chassisId,
				});
			}
			currentPort = "";
		}
	}
	return neighbors;
};

/**
 * Parse LLDP/CDP neighbors output from any vendor.
 */
export const parseLldpNeighbors = (output: string): LldpNeighbor[] => {
	const vendor = detectVendor(output);
	switch (vendor) {
		case "cisco-ios": return parseCiscoIos(output);
		case "cisco-nxos": return parseCiscoNxos(output);
		case "huawei": return parseHuawei(output);
		case "fortigate": return parseFortigate(output);
		case "linux": return parseLinux(output);
		default: return parseCiscoIos(output); // best-effort
	}
};

/**
 * Generate the appropriate LLDP command for a given device OS/role.
 */
export const getLldpCommand = (os?: string, role?: string): string => {
	const hint = `${os ?? ""} ${role ?? ""}`.toLowerCase();
	if (hint.includes("fortigate") || hint.includes("fortios")) {
		return "diagnose lldp neighbor list";
	}
	if (hint.includes("huawei") || hint.includes("ce68") || hint.includes("vrp")) {
		return "display lldp neighbor";
	}
	if (hint.includes("nx-os") || hint.includes("nexus") || hint.includes("nxos")) {
		return "show lldp neighbors detail";
	}
	if (hint.includes("linux") || hint.includes("ubuntu") || hint.includes("proxmox") || hint.includes("debian")) {
		return "lldpctl 2>/dev/null || echo 'lldpctl not installed'";
	}
	// Default: Cisco IOS-XE
	return "show lldp neighbors detail";
};
