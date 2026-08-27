/**
 * Agent Aria — diagnostic command bundles.
 *
 * Each alert type maps to a list of shell commands run via SSH on the
 * monitor's target host.  The combined stdout is fed to the AI model
 * alongside the alert context.
 */
export type AlertType = "cpu" | "memory" | "disk" | "network" | "generic";

/** Detect alert type from monitor evaluation metadata. */
export const detectAlertType = (
	monitorType: string,
	decisionThresholds?: { cpu?: boolean; memory?: boolean; disk?: boolean; temp?: boolean },
	statusChangeCode?: string,
): AlertType => {
	if (decisionThresholds?.cpu) return "cpu";
	if (decisionThresholds?.memory) return "memory";
	if (decisionThresholds?.disk) return "disk";
	const t = `${monitorType} ${statusChangeCode ?? ""}`.toLowerCase();
	if (/\b(cpu|load|processor)\b/.test(t)) return "cpu";
	if (/\b(mem|ram|swap)\b/.test(t)) return "memory";
	if (/\b(disk|space|storage|inode)\b/.test(t)) return "disk";
	if (/\b(net|ping|latency|bandwidth|traffic|dns|bgp)\b/.test(t)) return "network";
	return "generic";
};

const COMMON = [
	"hostname",
	"uptime",
	"date '+%Y-%m-%d %H:%M:%S %Z'",
];

const BUNDLES: Record<AlertType, string[]> = {
	cpu: [
		"top -bn1 | head -20",
		"ps aux --sort=-%cpu | head -10",
		"uptime",
		"free -h",
		"df -h /",
		"journalctl --since '5 min ago' --no-pager -n 20",
	],
	memory: [
		"free -h",
		"ps aux --sort=-%mem | head -10",
		"swapon --show",
		"journalctl --since '5 min ago' --no-pager -n 20",
	],
	disk: [
		"df -h",
		"du -sh /var/log/* 2>/dev/null | sort -rh | head -10",
		"lsof +L1 2>/dev/null | head -10",
		"journalctl --since '5 min ago' --no-pager -n 20",
	],
	network: [
		"ss -tlnp",
		"ss -s",
		"ip -s link",
		"ping -c 3 8.8.8.8 2>/dev/null || true",
		"journalctl --since '5 min ago' --no-pager -n 20",
	],
	generic: [
		"top -bn1 | head -15",
		"free -h",
		"df -h /",
		"journalctl --since '5 min ago' --no-pager -n 20",
	],
};

/** Return the deduped command list for a given alert type. */
export const getDiagnosticCommands = (type: AlertType): string[] => {
	const cmds = [...COMMON, ...BUNDLES[type]];
	return [...new Set(cmds)];
};
