import type { MonitorType } from "@/domain/monitors/monitor.type.js";
import type { DateRange } from "@/types/query.js";

/** Percentile breakdown for response-time distribution. */
export interface ResponseTimePercentiles {
	p50: number;
	p75: number;
	p90: number;
	p95: number;
	p99: number;
	min: number;
	max: number;
	avg: number;
}

/** Apdex score breakdown — T = satisfied threshold, 4T = tolerating. */
export interface ApdexScore {
	score: number; // 0.0 – 1.0
	satisfied: number;
	tolerating: number;
	frustrated: number;
	totalSamples: number;
	thresholdMs: number;
}

/** Error-rate metrics derived from HTTP status codes. */
export interface ErrorRateMetrics {
	totalRequests: number;
	clientErrors: number; // 4xx
	serverErrors: number; // 5xx
	errorRate: number; // 0.0 – 1.0 (4xx+5xx / total)
	availability: number; // 1.0 – errorRate
}

/** Throughput = checks per minute over the range. */
export interface ThroughputMetrics {
	checksPerMinute: number;
	totalChecks: number;
	rangeMinutes: number;
}

/** Slow-transaction sample — one check that breached the slow threshold. */
export interface SlowTransaction {
	monitorId: string;
	monitorName: string;
	monitorUrl: string;
	monitorType: MonitorType;
	responseTime: number;
	statusCode: number;
	thresholdMs: number;
	createdAt: string;
}

/** Aggregated APM metrics for one monitor over a date range. */
export interface MonitorApmMetrics {
	monitorId: string;
	monitorName: string;
	monitorUrl: string;
	monitorType: MonitorType;
	dateRange: DateRange;
	percentiles: ResponseTimePercentiles;
	apdex: ApdexScore;
	errorRate: ErrorRateMetrics;
	throughput: ThroughputMetrics;
	slowTransactions: SlowTransaction[];
}

/** Team-wide APM rollup. */
export interface TeamApmSummary {
	teamId: string;
	dateRange: DateRange;
	generatedAt: string;
	overall: {
		percentiles: ResponseTimePercentiles;
		apdex: ApdexScore;
		errorRate: ErrorRateMetrics;
		throughput: ThroughputMetrics;
	};
	monitors: MonitorApmMetrics[];
	topSlowMonitors: Array<{
		monitorId: string;
		monitorName: string;
		avgResponseTime: number;
		p95ResponseTime: number;
	}>;
	topErrorMonitors: Array<{
		monitorId: string;
		monitorName: string;
		errorRate: number;
		totalErrors: number;
	}>;
}

export interface IApmService {
	getMonitorApm(monitorId: string, teamId: string, dateRange: DateRange, apdexThresholdMs?: number): Promise<MonitorApmMetrics>;
	getTeamApm(teamId: string, dateRange: DateRange, apdexThresholdMs?: number): Promise<TeamApmSummary>;
}
