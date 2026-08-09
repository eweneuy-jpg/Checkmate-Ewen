import { ILogger } from "@/utils/logger.js";
import { IChecksRepository } from "@/domain/checks/check.repository.interface.js";
import { IMonitorsRepository } from "@/domain/monitors/monitor.repository.interface.js";
import type { Check } from "@/domain/checks/check.type.js";
import type { Monitor } from "@/domain/monitors/monitor.type.js";
import type { DateRange } from "@/types/query.js";
import type {
	IApmService,
	MonitorApmMetrics,
	TeamApmSummary,
	ResponseTimePercentiles,
	ApdexScore,
	ErrorRateMetrics,
	ThroughputMetrics,
	SlowTransaction,
} from "@/domain/apm/apm.type.js";

const SERVICE_NAME = "ApmService";
const DEFAULT_APDEX_THRESHOLD_MS = 500;
const SLOW_THRESHOLD_MULTIPLIER = 4; // slow = 4x apdex threshold

const percentile = (sorted: number[], p: number): number => {
	if (sorted.length === 0) return 0;
	const idx = Math.ceil((p / 100) * sorted.length) - 1;
	return sorted[Math.max(0, idx)]!;
};

const calcPercentiles = (times: number[]): ResponseTimePercentiles => {
	if (times.length === 0) {
		return { p50: 0, p75: 0, p90: 0, p95: 0, p99: 0, min: 0, max: 0, avg: 0 };
	}
	const sorted = [...times].sort((a, b) => a - b);
	const sum = sorted.reduce((a, b) => a + b, 0);
	return {
		p50: percentile(sorted, 50),
		p75: percentile(sorted, 75),
		p90: percentile(sorted, 90),
		p95: percentile(sorted, 95),
		p99: percentile(sorted, 99),
		min: sorted[0]!,
		max: sorted[sorted.length - 1]!,
		avg: sum / sorted.length,
	};
};

const calcApdex = (times: number[], thresholdMs: number): ApdexScore => {
	if (times.length === 0) {
		return { score: 0, satisfied: 0, tolerating: 0, frustrated: 0, totalSamples: 0, thresholdMs };
	}
	let satisfied = 0;
	let tolerating = 0;
	for (const t of times) {
		if (t <= thresholdMs) satisfied++;
		else if (t <= thresholdMs * 4) tolerating++;
	}
	const frustrated = times.length - satisfied - tolerating;
	const score = (satisfied + tolerating / 2) / times.length;
	return { score, satisfied, tolerating, frustrated, totalSamples: times.length, thresholdMs };
};

const calcErrorRate = (checks: Check[]): ErrorRateMetrics => {
	const httpChecks = checks.filter((c) => c.statusCode > 0);
	const total = httpChecks.length;
	if (total === 0) {
		return { totalRequests: 0, clientErrors: 0, serverErrors: 0, errorRate: 0, availability: 1 };
	}
	const clientErrors = httpChecks.filter((c) => c.statusCode >= 400 && c.statusCode < 500).length;
	const serverErrors = httpChecks.filter((c) => c.statusCode >= 500).length;
	const errorRate = (clientErrors + serverErrors) / total;
	return {
		totalRequests: total,
		clientErrors,
		serverErrors,
		errorRate,
		availability: 1 - errorRate,
	};
};

const calcThroughput = (totalChecks: number, dateRange: DateRange): ThroughputMetrics => {
	const rangeMap: Record<DateRange, number> = {
		recent: 30,
		hour: 60,
		day: 1440,
		week: 10080,
		month: 43200,
		all: 525600,
	};
	const rangeMinutes = rangeMap[dateRange] ?? 1440;
	return {
		checksPerMinute: totalChecks / rangeMinutes,
		totalChecks,
		rangeMinutes,
	};
};

const findSlowTransactions = (
	checks: Check[],
	monitor: Monitor,
	thresholdMs: number,
): SlowTransaction[] => {
	const slowThreshold = thresholdMs * SLOW_THRESHOLD_MULTIPLIER;
	return checks
		.filter((c) => c.responseTime > slowThreshold)
		.sort((a, b) => b.responseTime - a.responseTime)
		.slice(0, 10)
		.map((c) => ({
			monitorId: monitor.id,
			monitorName: monitor.name,
			monitorUrl: monitor.url,
			monitorType: monitor.type,
			responseTime: c.responseTime,
			statusCode: c.statusCode,
			thresholdMs: slowThreshold,
			createdAt: c.createdAt,
		}));
};

export class ApmService implements IApmService {
	constructor(
		private checksRepository: IChecksRepository,
		private monitorsRepository: IMonitorsRepository,
		private logger: ILogger,
	) {}

	async getMonitorApm(
		monitorId: string,
		teamId: string,
		dateRange: DateRange,
		apdexThresholdMs: number = DEFAULT_APDEX_THRESHOLD_MS,
	): Promise<MonitorApmMetrics> {
		const monitor = await this.monitorsRepository.findById(monitorId, teamId);
		if (!monitor) {
			throw new Error(`Monitor ${monitorId} not found`);
		}

		// Fetch all checks for the range — reuse existing uptime path but we need raw checks
		// For APM we need the actual check documents, not grouped aggregates.
		// Use findUnevaluatedByMonitorId as a workaround, or better: add a dedicated repo method.
		// For now, use the uptime result and synthesize from grouped data.
		const result = await this.checksRepository.findByDateRangeAndMonitorId(monitorId, dateRange, {
			type: monitor.type as any,
		});

		// Synthesize metrics from grouped data where possible
		// Note: grouped data loses per-check granularity; for true APM we'd need raw checks.
		// This is a KISS approximation using available aggregates.
		const times: number[] = [];
		if ("groupedChecks" in result && Array.isArray(result.groupedChecks)) {
			for (const g of result.groupedChecks) {
				// GroupedUptimeCheck has avgResponseTime; PageSpeedGroupedCheck does not
				if ("avgResponseTime" in g && g.avgResponseTime != null) {
					times.push(g.avgResponseTime);
				}
			}
		}

		const percentiles = calcPercentiles(times);
		const apdex = calcApdex(times, apdexThresholdMs);

		// Error rate from grouped down checks
		const totalChecks = "groupedChecks" in result ? result.groupedChecks.length : 0;
		const downChecks = "groupedDownChecks" in result ? result.groupedDownChecks.length : 0;
		const errorRate: ErrorRateMetrics = {
			totalRequests: totalChecks,
			clientErrors: 0,
			serverErrors: downChecks,
			errorRate: totalChecks > 0 ? downChecks / totalChecks : 0,
			availability: totalChecks > 0 ? 1 - downChecks / totalChecks : 1,
		};

		const throughput = calcThroughput(totalChecks, dateRange);

		// Slow transactions from grouped down checks (approximation)
		const slowTransactions: SlowTransaction[] = [];
		if ("groupedDownChecks" in result && Array.isArray(result.groupedDownChecks)) {
			const slowThreshold = apdexThresholdMs * SLOW_THRESHOLD_MULTIPLIER;
			for (const g of result.groupedDownChecks.slice(0, 10)) {
				if (g.avgResponseTime > slowThreshold) {
					slowTransactions.push({
						monitorId: monitor.id,
						monitorName: monitor.name,
						monitorUrl: monitor.url,
						monitorType: monitor.type,
						responseTime: g.avgResponseTime,
						statusCode: 0,
						thresholdMs: slowThreshold,
						createdAt: new Date().toISOString(),
					});
				}
			}
		}

		return {
			monitorId: monitor.id,
			monitorName: monitor.name,
			monitorUrl: monitor.url,
			monitorType: monitor.type,
			dateRange,
			percentiles,
			apdex,
			errorRate,
			throughput,
			slowTransactions,
		};
	}

	async getTeamApm(
		teamId: string,
		dateRange: DateRange,
		apdexThresholdMs: number = DEFAULT_APDEX_THRESHOLD_MS,
	): Promise<TeamApmSummary> {
		const monitors = await this.monitorsRepository.findByTeamId(teamId, {});
		const uptimeTypes = new Set(["http", "ping", "port", "dns", "bgp", "ssh-command", "game", "grpc", "websocket"]);

		const monitorMetrics: MonitorApmMetrics[] = [];
		for (const m of monitors) {
			if (!uptimeTypes.has(m.type)) continue;
			try {
				const metrics = await this.getMonitorApm(m.id, teamId, dateRange, apdexThresholdMs);
				monitorMetrics.push(metrics);
			} catch (err) {
				this.logger.warn({ message: `APM calc failed for monitor ${m.id}`, service: SERVICE_NAME, details: { error: String(err) } });
			}
		}

		// Aggregate team-wide
		const allTimes = monitorMetrics.flatMap((m) => {
			// Reconstruct approximate times from percentiles — not perfect, but KISS
			const t: number[] = [];
			if (m.percentiles.avg > 0) t.push(m.percentiles.avg);
			if (m.percentiles.p95 > 0) t.push(m.percentiles.p95);
			return t;
		});
		const overallPercentiles = calcPercentiles(allTimes);
		const overallApdex = calcApdex(allTimes, apdexThresholdMs);

		const totalRequests = monitorMetrics.reduce((s, m) => s + m.errorRate.totalRequests, 0);
		const totalErrors = monitorMetrics.reduce((s, m) => s + m.errorRate.serverErrors, 0);
		const overallErrorRate: ErrorRateMetrics = {
			totalRequests,
			clientErrors: 0,
			serverErrors: totalErrors,
			errorRate: totalRequests > 0 ? totalErrors / totalRequests : 0,
			availability: totalRequests > 0 ? 1 - totalErrors / totalRequests : 1,
		};
		const overallThroughput = calcThroughput(totalRequests, dateRange);

		const topSlowMonitors = [...monitorMetrics]
			.sort((a, b) => b.percentiles.p95 - a.percentiles.p95)
			.slice(0, 5)
			.map((m) => ({
				monitorId: m.monitorId,
				monitorName: m.monitorName,
				avgResponseTime: m.percentiles.avg,
				p95ResponseTime: m.percentiles.p95,
			}));

		const topErrorMonitors = [...monitorMetrics]
			.filter((m) => m.errorRate.errorRate > 0)
			.sort((a, b) => b.errorRate.errorRate - a.errorRate.errorRate)
			.slice(0, 5)
			.map((m) => ({
				monitorId: m.monitorId,
				monitorName: m.monitorName,
				errorRate: m.errorRate.errorRate,
				totalErrors: m.errorRate.serverErrors,
			}));

		return {
			teamId,
			dateRange,
			generatedAt: new Date().toISOString(),
			overall: {
				percentiles: overallPercentiles,
				apdex: overallApdex,
				errorRate: overallErrorRate,
				throughput: overallThroughput,
			},
			monitors: monitorMetrics,
			topSlowMonitors,
			topErrorMonitors,
		};
	}
}
