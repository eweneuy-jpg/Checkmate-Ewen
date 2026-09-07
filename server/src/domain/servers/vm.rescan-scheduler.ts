/**
 * VM Rescan Scheduler — periodic background VM auto-rescan.
 *
 * Every VM_RESYNC_INTERVAL_HOURS (default 6), loops over all VM hosts
 * (isVmHost=true) in the team and re-runs scanVms() to keep VM status
 * and specs fresh. Requires SSH creds on the host to do anything;
 * hosts without creds are skipped.
 *
 * start() is safe to call even when serversService has no SSH runner
 * configured — scanVms throws AppError which we catch and log.
 */
import { ILogger } from "@/utils/logger.js";
import { IServersService } from "./server.service.js";

const SERVICE_NAME = "VmRescanScheduler";
const DEFAULT_INTERVAL_HOURS = 6;
const RESCAN_JITTER_MS = 15 * 60 * 1000; // spread first run up to 15 min after boot

export class VmRescanScheduler {
	private timer: NodeJS.Timeout | null = null;
	private stopped = false;
	private running = false;

	constructor(
		private logger: ILogger,
		private serversService: IServersService,
		private teamId: string,
		private intervalHours: number = DEFAULT_INTERVAL_HOURS,
	) {}

	/** Configure team context (needed for multi-tenant queries). */
	setTeamId = (teamId: string) => {
		this.teamId = teamId;
	};

	/** Perform one full rescan cycle: all VM hosts -> scanVms(). */
	runOnce = async (): Promise<{ hosts: number; vms: number; failed: number }> => {
		if (this.running) return { hosts: 0, vms: 0, failed: 0 };
		this.running = true;
		const stats = { hosts: 0, vms: 0, failed: 0 };
		try {
			const hosts = await this.serversService.listVmHosts(this.teamId);
			for (const host of hosts) {
				if (this.stopped) break;
				try {
					const vms = await this.serversService.scanVms(host.id, this.teamId);
					stats.hosts++;
					stats.vms += vms.length;
					this.logger.info({
						service: SERVICE_NAME,
						method: "runOnce",
						message: "Rescanned " + host.hostname + ": " + vms.length + " VMs",
					});
				} catch (err) {
					stats.failed++;
					this.logger.warn({
						service: SERVICE_NAME,
						method: "runOnce",
						message: "Rescan failed for " + host.hostname + ": " + (err instanceof Error ? err.message : "unknown"),
					});
				}
			}
		} catch (err) {
			this.logger.warn({
				service: SERVICE_NAME,
				method: "runOnce",
				message: "VM rescan cycle error: " + (err instanceof Error ? err.message : "unknown"),
			});
		} finally {
			this.running = false;
		}
		return stats;
	};

	start = async () => {
		if (this.stopped) return;
		if (!this.teamId) {
			this.logger.info({
				service: SERVICE_NAME,
				method: "start",
				message: "No teamId — VM rescan scheduler idle",
			});
			return;
		}
		const intervalMs = Math.max(1, this.intervalHours) * 60 * 60 * 1000;
		this.logger.info({
			service: SERVICE_NAME,
			method: "start",
			message: "VM rescan scheduler active — every " + this.intervalHours + "h (team " + this.teamId + ")",
		});

		// First cycle after a short jitter, then periodic.
		const firstDelay = Math.min(intervalMs, RESCAN_JITTER_MS);
		this.timer = setTimeout(() => {
			this.runOnce().then((s) => {
				this.logger.info({
					service: SERVICE_NAME,
					method: "start",
					message: "Initial VM rescan: " + s.hosts + " hosts, " + s.vms + " VMs, " + s.failed + " failed",
				});
			});
			// Then arm the periodic interval
			this.timer = setInterval(() => {
				this.runOnce().then((s) => {
					this.logger.info({
						service: SERVICE_NAME,
						method: "tick",
						message: "Scheduled VM rescan: " + s.hosts + " hosts, " + s.vms + " VMs, " + s.failed + " failed",
					});
				});
			}, intervalMs);
		}, firstDelay);
	};

	stop = () => {
		this.stopped = true;
		if (this.timer) {
			clearTimeout(this.timer);
			clearInterval(this.timer);
			this.timer = null;
		}
	};
}
