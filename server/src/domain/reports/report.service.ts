import { ILogger } from "@/utils/logger.js";
import { IChecksRepository } from "@/domain/checks/check.repository.interface.js";
import { IMonitorsRepository } from "@/domain/monitors/monitor.repository.interface.js";
import { INotificationsRepository } from "@/domain/notifications/notification.repository.interface.js";
import { TelegramProvider } from "@/domain/notifications/providers/telegram.js";
import type { UptimeChecksResult } from "@/domain/checks/check.type.js";
import type { Monitor } from "@/domain/monitors/monitor.type.js";
import type { IReportService, WeeklyReport, WeeklyMonitorReport } from "@/domain/reports/report.type.js";
import type { DateRange } from "@/types/query.js";

const SERVICE_NAME = "WeeklyReportService";
const MAX_WORST = 5;

export class WeeklyReportService implements IReportService {
	constructor(
		private checksRepository: IChecksRepository,
		private monitorsRepository: IMonitorsRepository,
		private notificationsRepository: INotificationsRepository,
		private telegramProvider: TelegramProvider,
		private logger: ILogger,
	) {}

	async generateWeeklyReport(teamId: string): Promise<WeeklyReport> {
		const periodStart = new Date(Date.now() - 7 * 864e5).toISOString();
		const periodEnd = new Date().toISOString();
		const dateRange: DateRange = "week";

		// Ambil semua monitor milik team
		const monitors = await this.monitorsRepository.findByTeamId(teamId, {});
		const summary = await this.checksRepository.findSummaryByTeamId(teamId, dateRange);

		// Hitung uptime per monitor (parallel)
		const uptimeTypes = new Set(["http", "ping", "port", "dns", "bgp", "ssh-command", "game", "grpc", "websocket"]);
		const monitorReports: (WeeklyMonitorReport | null)[] = await Promise.all(
			monitors.map(async (m) => {
				if (!uptimeTypes.has(m.type)) return null; // hardware / pagespeed di-skip
				try {
					const res = await this.checksRepository.findByDateRangeAndMonitorId(
						m.id,
						dateRange,
						{ type: m.type as any },
					);
					return {
						monitor: { id: m.id, type: m.type, name: m.name, url: m.url, status: m.status, isActive: m.isActive, interval: m.interval },
						uptimeResult: res as UptimeChecksResult | null,
					};
				} catch (err) {
					this.logger.warn({ message: `Failed uptime calc for monitor ${m.id}`, service: SERVICE_NAME, details: { error: String(err) } });
					return null;
				}
			}),
		);

		const valid = monitorReports.filter((r): r is WeeklyMonitorReport => r !== null);
		const worstMonitors = [...valid]
			.sort((a, b) => (a.uptimeResult?.uptimePercentage ?? 100) - (b.uptimeResult?.uptimePercentage ?? 100))
			.slice(0, MAX_WORST);

		this.logger.info({
			message: `Weekly report generated for team ${teamId}: ${valid.length} monitors`,
			service: SERVICE_NAME,
		});

		return { periodStart, periodEnd, generatedAt: new Date().toISOString(), summary, monitors: valid, worstMonitors };
	}

	async publishWeeklyReport(teamId: string): Promise<number> {
		const report = await this.generateWeeklyReport(teamId);
		const notifications = await this.notificationsRepository.findByTeamId(teamId);
		const telegramTargets = notifications.filter((n) => n.type === "telegram" && n.address && n.accessToken);

		if (telegramTargets.length === 0) {
			this.logger.info({ message: `No Telegram targets for team ${teamId}`, service: SERVICE_NAME });
			return 0;
		}

		const html = this.buildWeeklyHtml(report);
		const results = await Promise.all(telegramTargets.map((n) => this.telegramProvider.sendWeeklyReport(n, html)));
		const okCount = results.filter(Boolean).length;
		this.logger.info({ message: `Weekly report published to ${okCount}/${telegramTargets.length} Telegram targets`, service: SERVICE_NAME });
		return okCount;
	}

	private buildWeeklyHtml(report: WeeklyReport): string {
		const pct = (v?: number) => (v == null ? "—" : `${v.toFixed(2)}%`);
		const period = `${report.periodStart.slice(0, 10)} → ${report.periodEnd.slice(0, 10)}`;
		const s = report.summary;
		const lines: string[] = [
			`<b>📊 Weekly Uptime Report</b>`,
			`<i>${period}</i>`,
			"",
			`<b>Summary</b>`,
			`• Total checks: ${s.totalChecks}`,
			`• Down checks: ${s.downChecks}`,
			"",
		];

		if (report.worstMonitors.length > 0) {
			lines.push("<b>⚠️ Worst performers</b>");
			report.worstMonitors.forEach((w) => {
				const name = w.monitor.name || w.monitor.url || w.monitor.id;
				const outages = w.uptimeResult?.groupedDownChecks?.length ?? 0;
				lines.push(`• ${name} — ${pct(w.uptimeResult?.uptimePercentage)} (${outages} outages)`);
			});
		} else {
			lines.push("✅ All monitored services healthy this week.");
		}

		return lines.join("\n");
	}
}
