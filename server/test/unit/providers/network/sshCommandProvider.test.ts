import { describe, expect, it } from "@jest/globals";
import { SshCommandProvider, evaluateSshOutput } from "../../../../src/service/network/SshCommandProvider.ts";
import type { IRouterCommandRunner } from "../../../../src/service/network/sshRunner.ts";
import type { Monitor } from "../../../../src/domain/monitors/monitor.type.ts";

// ── Real output from the troubleshooting session: 12-SP-RDES# sh int e2/21 ──

const NXOS_INTERFACE_UP = `
Ethernet2/21 is up
admin state is up, Dedicated Interface
  Hardware: 1000/10000 Ethernet, address: 0081.c443.4858 (bia 0081.c443.4858)
  Description: Eth2/21 port2|0FF-PLUG|Huasei CE6851-48S60-HI-B(RAK-T4) - Jupiter Lintas Arta|PT. JUPITER JALA ARTA| FO-LR-10G
  MTU 1500 bytes, BW 10000000 Kbit, DLY 10 usec
  reliability 255/255, txload 1/255, rxload 1/255
  full-duplex, 10 Gb/s, media type is 10G
  3 interface resets
`;

const NXOS_INTERFACE_DOWN = `
Ethernet2/21 is down
  Hardware: 1000/10000 Ethernet, address: 0081.c443.4858 (bia 0081.c443.4858)
  reliability 255/255, txload 1/255, rxload 1/255
  28 interface resets
  5 input errors, 3 CRC, 0 frame, 0 overrun
`;

const NXOS_JSON = JSON.stringify({
	TABLE_interface: {
		ROW_interface: { interface: "Ethernet2/21", state: "up", admin_state: "up", eth_hw_desc: "1000/10000 Ethernet" },
	},
});

const makeMonitor = (overrides: Partial<Monitor> = {}): Monitor =>
	({
		id: "mon-ssh-1",
		teamId: "team-1",
		type: "ssh-command",
		url: "10.1.1.5",
		sshCommand: "show interface Ethernet2/21",
		sshUsername: "netops",
		sshPassword: "secret",
		sshMatchMethod: "contains",
		sshExpectedValue: "is up",
		...overrides,
	}) as Monitor;

const makeRunner = (output: string): IRouterCommandRunner => ({ exec: async () => output });

// ── evaluateSshOutput ────────────────────────────────────────────────────────

describe("evaluateSshOutput", () => {
	it("contains: matches 'is up' on real Nexus output", () => {
		const r = evaluateSshOutput(makeMonitor(), NXOS_INTERFACE_UP);
		expect(r.matched).toBe(true);
	});

	it("contains: substring pitfall — 'is up' match juga pada 'admin state is up'", () => {
		// Dokumentasi perilaku: fixture down-with-admin-up membuktikan substring
		// matching bisa false-positive; gunakan regex ^...is up$ untuk presisi.
		const downButAdminUp = "Ethernet2/21 is down\nadmin state is up\n";
		const r = evaluateSshOutput(makeMonitor(), downButAdminUp);
		expect(r.matched).toBe(true); // "admin state is up" mengandung substring "is up"
	});

	it("regex: presisi line-start untuk menghindari substring pitfall", () => {
		const m = makeMonitor({ sshMatchMethod: "regex", sshExpectedValue: "^Ethernet2/21 is up$" });
		expect(evaluateSshOutput(m, NXOS_INTERFACE_UP).matched).toBe(true);
		expect(evaluateSshOutput(m, NXOS_INTERFACE_DOWN).matched).toBe(false);
	});

	it("not-contains: flags CRC errors in output", () => {
		const m = makeMonitor({ sshMatchMethod: "not-contains", sshExpectedValue: "CRC" });
		expect(evaluateSshOutput(m, NXOS_INTERFACE_UP).matched).toBe(true);
		expect(evaluateSshOutput(m, NXOS_INTERFACE_DOWN).matched).toBe(false);
	});

	it("regex: extracts interface reset count", () => {
		const m = makeMonitor({ sshMatchMethod: "regex", sshExpectedValue: "\\d+ interface resets" });
		expect(evaluateSshOutput(m, NXOS_INTERFACE_UP).matched).toBe(true);
	});

	it("regex: invalid pattern returns unmatched with error message", () => {
		const m = makeMonitor({ sshMatchMethod: "regex", sshExpectedValue: "([invalid" });
		const r = evaluateSshOutput(m, NXOS_INTERFACE_UP);
		expect(r.matched).toBe(false);
		expect(r.message).toMatch(/Regex tidak valid/);
	});

	it("json-path: extracts state from NX-OS | json output", () => {
		const m = makeMonitor({
			sshCommand: "show interface Ethernet2/21 | json",
			sshMatchMethod: "json-path",
			sshExpectedValue: "TABLE_interface.ROW_interface.state",
		});
		const r = evaluateSshOutput(m, NXOS_JSON);
		expect(r.matched).toBe(true);
		expect(r.extracted).toBe("up");
	});

	it("json-path: fails on non-JSON output with helpful message", () => {
		const m = makeMonitor({ sshMatchMethod: "json-path", sshExpectedValue: "state" });
		const r = evaluateSshOutput(m, NXOS_INTERFACE_UP);
		expect(r.matched).toBe(false);
		expect(r.message).toMatch(/bukan JSON valid/);
	});
});

// ── Provider end-to-end (mocked SSH) ─────────────────────────────────────────

describe("SshCommandProvider", () => {
	it("reports up for healthy interface (contains 'is up')", async () => {
		const provider = new SshCommandProvider(makeRunner(NXOS_INTERFACE_UP));
		const res = await provider.handle(makeMonitor());
		expect(res.status).toBe(true);
		expect(res.type).toBe("ssh-command");
		expect(res.payload?.matched).toBe(true);
		expect(res.payload?.exitOk).toBe(true);
		expect(res.payload?.outputPreview).toContain("Ethernet2/21 is up");
	});

	it("reports down when interface is down (regex presisi)", async () => {
		const provider = new SshCommandProvider(makeRunner(NXOS_INTERFACE_DOWN));
		const res = await provider.handle(makeMonitor({ sshMatchMethod: "regex", sshExpectedValue: "^Ethernet2/21 is up$" }));
		expect(res.status).toBe(false);
		expect(res.payload?.matched).toBe(false);
	});

	it("returns error when command missing", async () => {
		const provider = new SshCommandProvider(makeRunner(""));
		const res = await provider.handle(makeMonitor({ sshCommand: undefined }));
		expect(res.status).toBe(false);
		expect(res.message).toMatch(/sshCommand wajib/);
	});

	it("returns error when credentials missing", async () => {
		const provider = new SshCommandProvider(makeRunner(""));
		const res = await provider.handle(makeMonitor({ sshPassword: undefined }));
		expect(res.status).toBe(false);
		expect(res.message).toMatch(/Kredensial/);
	});

	it("propagates SSH connection failure as down status", async () => {
		const failing: IRouterCommandRunner = {
			exec: async () => {
				throw new Error("SSH timeout after 15000ms");
			},
		};
		const provider = new SshCommandProvider(failing);
		const res = await provider.handle(makeMonitor());
		expect(res.status).toBe(false);
		expect(res.message).toMatch(/SSH timeout/);
		expect(res.payload?.exitOk).toBe(false);
	});

	it("passes host/port/credentials/command to runner correctly", async () => {
		const calls: unknown[][] = [];
		const spy: IRouterCommandRunner = {
			exec: async (...args) => {
				calls.push(args);
				return NXOS_INTERFACE_UP;
			},
		};
		const provider = new SshCommandProvider(spy);
		await provider.handle(makeMonitor({ sshPort: 2222 }));
		expect(calls[0]).toEqual(["10.1.1.5", 2222, "netops", "secret", "show interface Ethernet2/21"]);
	});
});
