import { describe, expect, it, jest } from "@jest/globals";
import { computeOverallStatus } from "../../../../src/domain/servers/server.type.js";
import { parseAriaConfig } from "../../../../src/worker/aria/aria.config.js";
import { detectAlertType, getDiagnosticCommands } from "../../../../src/worker/aria/aria.diagnostics.js";
import type { MonitorStatus } from "../../../../src/domain/monitors/monitor.type.js";

describe("computeOverallStatus", () => {
	it("returns 'up' when all monitors up", () => {
		expect(computeOverallStatus(["up", "up", "up"])).toBe("up");
	});
	it("returns 'down' when any monitor down", () => {
		expect(computeOverallStatus(["up", "down", "up"])).toBe("down");
	});
	it("returns 'degraded' when any breached but no down", () => {
		expect(computeOverallStatus(["up", "breached", "up"])).toBe("degraded");
	});
	it("returns 'paused' when all paused", () => {
		expect(computeOverallStatus(["paused", "paused"])).toBe("paused");
	});
	it("returns 'unmonitored' for empty list", () => {
		expect(computeOverallStatus([])).toBe("unmonitored");
	});
	it("down takes priority over breached", () => {
		expect(computeOverallStatus(["down", "breached"])).toBe("down");
	});
});

describe("aria.config parseAriaConfig", () => {
	it("defaults to disabled", () => {
		const cfg = parseAriaConfig({});
		expect(cfg.enabled).toBe(false);
	});
	it("enables via ARIA_ENABLED=true", () => {
		expect(parseAriaConfig({ ARIA_ENABLED: "true" }).enabled).toBe(true);
	});
	it("parses SSH defaults", () => {
		const cfg = parseAriaConfig({ ARIA_ENABLED: "true" });
		expect(cfg.sshDefaultUser).toBe("root");
		expect(cfg.sshConnectTimeout).toBe(10_000);
	});
});

describe("aria.diagnostics detectAlertType", () => {
	it("detects cpu from threshold breach", () => {
		expect(detectAlertType("hardware", { cpu: true, memory: false, disk: false, temp: false })).toBe("cpu");
	});
	it("detects memory from threshold breach", () => {
		expect(detectAlertType("hardware", { cpu: false, memory: true, disk: false, temp: false })).toBe("memory");
	});
	it("detects disk from threshold breach", () => {
		expect(detectAlertType("hardware", { cpu: false, memory: false, disk: true, temp: false })).toBe("disk");
	});
	it("falls back to generic", () => {
		expect(detectAlertType("http", undefined, "down")).toBe("generic");
	});
	it("detects network from ping type", () => {
		expect(detectAlertType("ping", undefined, "down")).toBe("network");
	});
});

describe("aria.diagnostics getDiagnosticCommands", () => {
	it("returns commands with journalctl for all types", () => {
		for (const t of ["cpu", "memory", "disk", "network", "generic"] as const) {
			const cmds = getDiagnosticCommands(t);
			expect(cmds.some(c => c.includes("journalctl"))).toBe(true);
		}
	});
	it("returns deduped commands", () => {
		const cmds = getDiagnosticCommands("cpu");
		expect(new Set(cmds).size).toBe(cmds.length);
	});
});
