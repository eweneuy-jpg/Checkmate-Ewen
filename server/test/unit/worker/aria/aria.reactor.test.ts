import { describe, expect, it, jest } from "@jest/globals";
import { AgentAriaReactor } from "../../../../src/worker/aria/aria.reactor.js";
import { detectAlertType, getDiagnosticCommands } from "../../../../src/worker/aria/aria.diagnostics.js";
import { parseAriaConfig } from "../../../../src/worker/aria/aria.config.js";
import type { IRouterCommandRunner } from "../../../../src/service/network/sshRunner.js";
import type { Monitor } from "../../../../src/domain/monitors/monitor.type.js";
import type { MonitorEvaluation } from "../../../../src/worker/worker.interface.js";
import type { AriaConfig } from "../../../../src/worker/aria/aria.config.js";

// ── Mocks ───────────────────────────────────────────────────────────────────

const mockLogger = {
	info: jest.fn(),
	warn: jest.fn(),
	error: jest.fn(),
	debug: jest.fn(),
} as any;

const makeSshRunner = (output: string): IRouterCommandRunner => ({
	exec: jest.fn(async () => output),
});

// ── Realistic stress-ng output (from the screenshot OCR) ─────────────────────
const STRESS_NG_TOP = `
top - 14:09:01 up 12 days,  3:21,  2 users,  load average: 30.05, 28.41, 15.92
Tasks: 132 total,   2 running, 130 sleeping,   0 stopped,   0 zombie
%Cpu(s): 99.4 us,  0.3 sy,  0.0 ni,  0.0 id,  0.0 wa,  0.0 hi,  0.3 si
  PID USER      PR  NI    VIRT    RES    SHR S  %CPU  %MEM     TIME+ COMMAND
12345 root      20   0  131056   2100    100 R  99.4   0.1   0:04.05 stress-ng
`;

const makeMonitor = (overrides: Partial<Monitor> = {}): Monitor =>
	({
		id: "mon-cpu-1",
		teamId: "team-1",
		name: "CPU Alert Rule",
		type: "hardware",
		url: "192.168.2.123",
		status: "down",
		method: "GET",
		statusWindow: [],
		statusWindowSize: 5,
		statusWindowThreshold: 3,
		ignoreTlsErrors: false,
		useAdvancedMatching: false,
		isActive: true,
		interval: 60,
		notifications: [],
		tags: [],
		customUpCodes: [],
		cpuAlertThreshold: 90,
		cpuAlertCounter: 3,
		memoryAlertThreshold: 90,
		memoryAlertCounter: 0,
		diskAlertThreshold: 90,
		diskAlertCounter: 0,
		tempAlertThreshold: 80,
		tempAlertCounter: 0,
		selectedDisks: [],
		group: null,
		recentChecks: [],
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		lastEvaluatedAt: Date.now(),
		...overrides,
	}) as Monitor;

const makeEvaluation = (overrides: Partial<MonitorEvaluation> = {}): MonitorEvaluation =>
	({
		monitor: makeMonitor(),
		status: { payload: { statusText: "CPU 99.4%" } } as any,
		check: {} as any,
		statusChange: { code: "down", status: "down", changed: true },
		decision: {
			shouldCreateIncident: true,
			shouldResolveIncident: false,
			shouldSendNotification: true,
			incidentReason: "status_down",
			notificationReason: "status_change",
			thresholdBreaches: { cpu: true, memory: false, disk: false, temp: false },
		},
		...overrides,
	}) as MonitorEvaluation;

// ── Tests ───────────────────────────────────────────────────────────────────

describe("detectAlertType", () => {
	it("detects CPU from threshold breach", () => {
		const type = detectAlertType("hardware", { cpu: true, memory: false, disk: false, temp: false });
		expect(type).toBe("cpu");
	});

	it("detects memory from threshold breach", () => {
		const type = detectAlertType("hardware", { cpu: false, memory: true, disk: false, temp: false });
		expect(type).toBe("memory");
	});

	it("detects disk from threshold breach", () => {
		const type = detectAlertType("hardware", { cpu: false, memory: false, disk: true, temp: false });
		expect(type).toBe("disk");
	});

	it("falls back to generic for unknown type", () => {
		const type = detectAlertType("http", undefined, "down");
		expect(type).toBe("generic");
	});

	it("detects network from monitor type", () => {
		const type = detectAlertType("ping", undefined, "down");
		expect(type).toBe("network");
	});
});

describe("getDiagnosticCommands", () => {
	it("returns deduped commands for cpu", () => {
		const cmds = getDiagnosticCommands("cpu");
		// Should include top, ps, and common commands
		expect(cmds.some(c => c.includes("top -bn1"))).toBe(true);
		expect(cmds.some(c => c.includes("ps aux"))).toBe(true);
		expect(cmds.some(c => c.includes("hostname"))).toBe(true);
	});

	it("returns unique commands (no duplicates)", () => {
		const cmds = getDiagnosticCommands("memory");
		expect(new Set(cmds).size).toBe(cmds.length);
	});

	it("includes journalctl for all types", () => {
		for (const t of ["cpu", "memory", "disk", "network", "generic"] as const) {
			const cmds = getDiagnosticCommands(t);
			expect(cmds.some(c => c.includes("journalctl"))).toBe(true);
		}
	});
});

describe("parseAriaConfig", () => {
	it("defaults to disabled when env unset", () => {
		const cfg = parseAriaConfig({});
		expect(cfg.enabled).toBe(false);
	});

	it("enables via ARIA_ENABLED=true", () => {
		const cfg = parseAriaConfig({ ARIA_ENABLED: "true" });
		expect(cfg.enabled).toBe(true);
	});

	it("parses AI config from env", () => {
		const cfg = parseAriaConfig({
			ARIA_ENABLED: "true",
			ARIA_AI_MODEL: "llama3.2",
			ARIA_AI_BASE_URL: "http://localhost:11434/v1",
			ARIA_AI_API_KEY: "sk-test",
			ARIA_AI_MAX_TOKENS: "2000",
			ARIA_AI_TEMPERATURE: "5", // => 0.5
		});
		expect(cfg.enabled).toBe(true);
		expect(cfg.aiModel).toBe("llama3.2");
		expect(cfg.aiBaseUrl).toBe("http://localhost:11434/v1");
		expect(cfg.aiApiKey).toBe("sk-test");
		expect(cfg.aiMaxTokens).toBe(2000);
		expect(cfg.aiTemperature).toBe(0.5);
	});

	it("defaults triggerOn to down,critical", () => {
		const cfg = parseAriaConfig({});
		expect(cfg.triggerOn).toContain("down");
		expect(cfg.triggerOn).toContain("critical");
	});
});

describe("AgentAriaReactor", () => {
	it("is non-blocking (fire-and-forget)", () => {
		const reactor = new AgentAriaReactor(mockLogger, parseAriaConfig({}), makeSshRunner(""), {} as any);
		expect(reactor.blocking).toBe(false);
		expect(reactor.name).toBe("agent-aria");
	});

	it("returns immediately when disabled", async () => {
		const cfg = parseAriaConfig({}); // enabled=false
		const runner = makeSshRunner(STRESS_NG_TOP);
		const reactor = new AgentAriaReactor(mockLogger, cfg, runner, {} as any);
		const eval_ = makeEvaluation();
		await reactor.react(eval_);
		// SSH should not have been called
		expect(runner.exec).not.toHaveBeenCalled();
	});

	it("returns immediately when shouldSendNotification is false", async () => {
		const cfg = parseAriaConfig({ ARIA_ENABLED: "true", ARIA_AI_API_KEY: "sk-test" });
		const runner = makeSshRunner(STRESS_NG_TOP);
		const reactor = new AgentAriaReactor(mockLogger, cfg, runner, {} as any);
		const eval_ = makeEvaluation({
			decision: {
				shouldCreateIncident: false,
				shouldResolveIncident: false,
				shouldSendNotification: false,
				incidentReason: null,
				notificationReason: null,
			} as any,
		});
		await reactor.react(eval_);
		expect(runner.exec).not.toHaveBeenCalled();
	});

	it("runs SSH diagnostics when enabled and alerting", async () => {
		const cfg = parseAriaConfig({ ARIA_ENABLED: "true", ARIA_AI_API_KEY: "sk-test" });
		const runner = makeSshRunner(STRESS_NG_TOP);
		const reactor = new AgentAriaReactor(mockLogger, cfg, runner, {} as any);
		const eval_ = makeEvaluation();
		await reactor.react(eval_);
		// SSH should have been called
		expect(runner.exec).toHaveBeenCalled();
		// Should have logged investigation
		expect(mockLogger.info).toHaveBeenCalledWith(
			expect.objectContaining({ service: "AgentAriaReactor" }),
		);
	});

	it("skips SSH when monitor URL has no host", async () => {
		const cfg = parseAriaConfig({ ARIA_ENABLED: "true", ARIA_AI_API_KEY: "sk-test" });
		const runner = makeSshRunner(STRESS_NG_TOP);
		const reactor = new AgentAriaReactor(mockLogger, cfg, runner, {} as any);
		const eval_ = makeEvaluation({
			monitor: makeMonitor({ url: "" }),
		});
		await reactor.react(eval_);
		expect(runner.exec).not.toHaveBeenCalled();
	});
});
