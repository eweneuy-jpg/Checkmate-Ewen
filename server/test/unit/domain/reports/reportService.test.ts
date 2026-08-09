import { jest } from "@jest/globals";
import { WeeklyReportService } from "@/domain/reports/report.service.js";
import type { IChecksRepository } from "@/domain/checks/check.repository.interface.js";
import type { IMonitorsRepository } from "@/domain/monitors/monitor.repository.interface.js";
import type { INotificationsRepository } from "@/domain/notifications/notification.repository.interface.js";
import type { TelegramProvider } from "@/domain/notifications/providers/telegram.js";
import type { ILogger } from "@/utils/logger.js";
import type { Monitor } from "@/domain/monitors/monitor.type.js";
import type { UptimeChecksResult } from "@/domain/checks/check.type.js";

const mockLogger: ILogger = {
	info: jest.fn(),
	warn: jest.fn(),
	error: jest.fn(),
	debug: jest.fn(),
	cacheLog: jest.fn(),
	getLogs: jest.fn(),
	buildLogEntry: jest.fn(),
	setLogLevel: jest.fn(),
};

const makeMonitor = (overrides: Partial<Monitor> = {}): Monitor =>
	({
		id: "m1",
		teamId: "t1",
		type: "http",
		name: "Web",
		url: "https://example.com",
		status: "up",
		isActive: true,
		interval: 60000,
		...overrides,
	}) as Monitor;

const makeUptime = (pct: number, outages = 0): UptimeChecksResult => ({
	monitorType: "http",
	groupedChecks: [],
	groupedUpChecks: [],
	groupedDownChecks: Array.from({ length: outages }, (_, i) => ({
		status: false,
		responseTime: 0,
		count: 1,
		createdAt: new Date(),
	})) as any,
	uptimePercentage: pct,
	avgResponseTime: 100,
});

describe("WeeklyReportService", () => {
	let service: WeeklyReportService;
	let checksRepo: jest.Mocked<IChecksRepository>;
	let monitorsRepo: jest.Mocked<IMonitorsRepository>;
	let notificationsRepo: jest.Mocked<INotificationsRepository>;
	let telegramProvider: jest.Mocked<TelegramProvider>;

	beforeEach(() => {
		checksRepo = {
			findByDateRangeAndMonitorId: jest.fn(),
			findSummaryByTeamId: jest.fn(),
		} as any;
		monitorsRepo = { findByTeamId: jest.fn() } as any;
		notificationsRepo = { findByTeamId: jest.fn() } as any;
		telegramProvider = { sendWeeklyReport: jest.fn() } as any;

		service = new WeeklyReportService(checksRepo, monitorsRepo, notificationsRepo, telegramProvider, mockLogger);
	});

	describe("generateWeeklyReport", () => {
		it("should generate report with monitors and worst performers", async () => {
			monitorsRepo.findByTeamId.mockResolvedValue([
				makeMonitor({ id: "m1", name: "Good" }),
				makeMonitor({ id: "m2", name: "Bad" }),
			]);
			checksRepo.findSummaryByTeamId.mockResolvedValue({ totalChecks: 100, downChecks: 5 });
			checksRepo.findByDateRangeAndMonitorId.mockResolvedValueOnce(makeUptime(100)).mockResolvedValueOnce(makeUptime(90, 3));

			const report = await service.generateWeeklyReport("t1");

			expect(report.monitors).toHaveLength(2);
			expect(report.worstMonitors[0].monitor.name).toBe("Bad");
			expect(report.summary.totalChecks).toBe(100);
		});

		it("should skip hardware/pagespeed monitors", async () => {
			monitorsRepo.findByTeamId.mockResolvedValue([makeMonitor({ id: "m1", type: "hardware" })]);
			checksRepo.findSummaryByTeamId.mockResolvedValue({ totalChecks: 0, downChecks: 0 });

			const report = await service.generateWeeklyReport("t1");

			expect(report.monitors).toHaveLength(0);
		});

		it("should handle monitor uptime calc failure gracefully", async () => {
			monitorsRepo.findByTeamId.mockResolvedValue([makeMonitor({ id: "m1" })]);
			checksRepo.findSummaryByTeamId.mockResolvedValue({ totalChecks: 0, downChecks: 0 });
			checksRepo.findByDateRangeAndMonitorId.mockRejectedValue(new Error("db error"));

			const report = await service.generateWeeklyReport("t1");

			expect(report.monitors).toHaveLength(0);
			expect(mockLogger.warn).toHaveBeenCalled();
		});
	});

	describe("publishWeeklyReport", () => {
		it("should return 0 when no Telegram targets", async () => {
			monitorsRepo.findByTeamId.mockResolvedValue([]);
			checksRepo.findSummaryByTeamId.mockResolvedValue({ totalChecks: 0, downChecks: 0 });
			notificationsRepo.findByTeamId.mockResolvedValue([]);

			const count = await service.publishWeeklyReport("t1");

			expect(count).toBe(0);
		});

		it("should send report to Telegram targets and count successes", async () => {
			monitorsRepo.findByTeamId.mockResolvedValue([makeMonitor({ id: "m1" })]);
			checksRepo.findSummaryByTeamId.mockResolvedValue({ totalChecks: 10, downChecks: 0 });
			checksRepo.findByDateRangeAndMonitorId.mockResolvedValue(makeUptime(100));
			notificationsRepo.findByTeamId.mockResolvedValue([
				{ id: "n1", type: "telegram", address: "123", accessToken: "tok" } as any,
				{ id: "n2", type: "email", address: "a@b.c" } as any,
			]);
			telegramProvider.sendWeeklyReport.mockResolvedValue(true);

			const count = await service.publishWeeklyReport("t1");

			expect(count).toBe(1);
			expect(telegramProvider.sendWeeklyReport).toHaveBeenCalledTimes(1);
		});
	});
});
