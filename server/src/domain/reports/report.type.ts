import type { UptimeChecksResult, ChecksSummary } from "@/domain/checks/check.type.js";
import type { Monitor } from "@/domain/monitors/monitor.type.js";

export interface WeeklyReport {
	periodStart: string;
	periodEnd: string;
	generatedAt: string;
	summary: ChecksSummary;
	monitors: (WeeklyMonitorReport | null)[];
	worstMonitors: WeeklyMonitorReport[];
}

export interface WeeklyMonitorReport {
	monitor: Pick<Monitor, "id" | "type" | "name" | "url" | "status" | "isActive" | "interval">;
	uptimeResult: UptimeChecksResult | null;
}

export interface IReportService {
	generateWeeklyReport(teamId: string): Promise<WeeklyReport>;
	publishWeeklyReport(teamId: string): Promise<number>; // returns jumlah Telegram tujuan yang sukses
}
