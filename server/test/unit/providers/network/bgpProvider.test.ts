import { describe, expect, it } from "@jest/globals";
import {
	BgpProvider,
	parseBgpSummary,
	parseBgpNeighborRoutes,
	evaluateBgpRules,
	BGP_MED_INVALID,
	type IRouterCommandRunner,
} from "../../../../src/service/network/BgpProvider.ts";
import type { Monitor } from "../../../../src/domain/monitors/monitor.type.ts";

// ── Real output from the troubleshooting session (Issue A) ──────────────────

const BGP_SUMMARY_OUTPUT = `
13-PE_R59#show ip bgp vpnv4 vrf 10-017 summary
BGP router identifier 10.0.0.1, local AS number 65001
Neighbor        V    AS   MsgRcvd MsgSent   TblVer  InQ OutQ Up/Down  State/PfxRcd
49.213.56.1     4 6939     98721   99535  129844    0    0 9w2d     Idle
49.213.56.14    4 32934    98190   97959   23080    0    0 4w5d     12
49.213.56.15    4 32934    99064   62688  136538    0    0 4w5d     12
49.213.56.39    4 13335   105140  368141725 22269    0    0 4w5d     15
49.213.56.54    4 20940    53084   53084   53041    0    0 4w5d     62
`;

const BGP_ROUTES_MED_INVALID = `
13-PE_R59#show ip bgp vpnv4 vrf 10-017 neighbors 49.213.56.39 routes
     Network          Next Hop            Metric LocPrf Weight Path
 *>  172.65.0.0/20    49.213.56.39    4294967295    999      0 13335 i
 *>  172.65.0.0/19    49.213.56.39    4294967295    999      0 13335 i
 *>  172.65.16.0/20   49.213.56.39    4294967295    999      0 13335 i
 *>  172.65.48.0/20   49.213.56.39    4294967295    999      0 13335 i
`;

const BGP_ROUTES_HEALTHY = `
     Network          Next Hop            Metric LocPrf Weight Path
 *>  172.65.0.0/20    49.213.56.39           50    999      0 13335 i
 *>  172.65.16.0/20   49.213.56.39          100    999      0 13335 i
`;

const makeMonitor = (overrides: Partial<Monitor> = {}): Monitor =>
	({
		id: "mon-bgp-1",
		teamId: "team-1",
		type: "bgp",
		url: "10.0.0.1",
		bgpNeighbor: "49.213.56.39",
		bgpVrf: "10-017",
		bgpRouterUsername: "netops",
		bgpRouterPassword: "secret",
		bgpExpectedAsn: 13335,
		...overrides,
	}) as Monitor;

const makeRunner = (responses: Record<string, string>): IRouterCommandRunner => ({
	exec: async (_h, _p, _u, _pw, command) => {
		for (const [key, val] of Object.entries(responses)) {
			if (command.includes(key)) return val;
		}
		return "";
	},
});

// ── Parser tests ─────────────────────────────────────────────────────────────

describe("parseBgpSummary", () => {
	it("parses established and idle neighbors from Cisco IOS-XE output", () => {
		const neighbors = parseBgpSummary(BGP_SUMMARY_OUTPUT);
		expect(neighbors).toHaveLength(5);

		const idle = neighbors.find((n) => n.neighbor === "49.213.56.1");
		expect(idle).toMatchObject({ asn: 6939, state: "Idle", prefixesReceived: 0, upDown: "9w2d" });

		const cf = neighbors.find((n) => n.neighbor === "49.213.56.39");
		expect(cf).toMatchObject({ asn: 13335, state: "Established", prefixesReceived: 15, upDown: "4w5d" });
	});
});

describe("parseBgpNeighborRoutes", () => {
	it("parses routes with MED 4294967295 (Issue A signature)", () => {
		const routes = parseBgpNeighborRoutes(BGP_ROUTES_MED_INVALID);
		expect(routes.length).toBe(4);
		expect(routes[0]).toMatchObject({ prefix: "172.65.0.0/20", med: BGP_MED_INVALID, localPref: 999 });
	});

	it("parses healthy routes", () => {
		const routes = parseBgpNeighborRoutes(BGP_ROUTES_HEALTHY);
		expect(routes).toHaveLength(2);
		expect(routes[0].med).toBe(50);
	});
});

// ── Rule evaluation tests ────────────────────────────────────────────────────

describe("evaluateBgpRules", () => {
	it("flags Idle session (case: 49.213.56.1 down 9w2d)", () => {
		const neighbor = parseBgpSummary(BGP_SUMMARY_OUTPUT).find((n) => n.neighbor === "49.213.56.1");
		const result = evaluateBgpRules(makeMonitor({ bgpNeighbor: "49.213.56.1", bgpExpectedAsn: 6939 }), neighbor, []);
		expect(result.up).toBe(false);
		expect(result.messages.join(" ")).toMatch(/Idle/);
	});

	it("flags MED 4294967295 anomalies (case: Cloudflare 49.213.56.39)", () => {
		const neighbor = parseBgpSummary(BGP_SUMMARY_OUTPUT).find((n) => n.neighbor === "49.213.56.39");
		const routes = parseBgpNeighborRoutes(BGP_ROUTES_MED_INVALID);
		const result = evaluateBgpRules(makeMonitor(), neighbor, routes);
		expect(result.up).toBe(false);
		expect(result.anomalies).toHaveLength(4);
		expect(result.anomalies[0].med).toBe(BGP_MED_INVALID);
		expect(result.anomalies[0].reason).toMatch(/invalid\/max/);
	});

	it("flags ASN mismatch", () => {
		const neighbor = parseBgpSummary(BGP_SUMMARY_OUTPUT).find((n) => n.neighbor === "49.213.56.39");
		const result = evaluateBgpRules(makeMonitor({ bgpExpectedAsn: 20940 }), neighbor, []);
		expect(result.up).toBe(false);
		expect(result.messages.join(" ")).toMatch(/AS20940/);
	});

	it("flags prefix count below minimum", () => {
		const neighbor = parseBgpSummary(BGP_SUMMARY_OUTPUT).find((n) => n.neighbor === "49.213.56.39");
		const result = evaluateBgpRules(makeMonitor({ bgpMinPrefixes: 100 }), neighbor, []);
		expect(result.up).toBe(false);
		expect(result.messages.join(" ")).toMatch(/minimum 100/);
	});

	it("passes healthy session with healthy routes", () => {
		const neighbor = parseBgpSummary(BGP_SUMMARY_OUTPUT).find((n) => n.neighbor === "49.213.56.39");
		const routes = parseBgpNeighborRoutes(BGP_ROUTES_HEALTHY);
		const result = evaluateBgpRules(makeMonitor(), neighbor, routes);
		expect(result.up).toBe(true);
		expect(result.anomalies).toHaveLength(0);
	});

	it("fails when neighbor not found in summary", () => {
		const result = evaluateBgpRules(makeMonitor({ bgpNeighbor: "8.8.8.8" }), undefined, []);
		expect(result.up).toBe(false);
		expect(result.messages.join(" ")).toMatch(/tidak ditemukan/);
	});
});

// ── Provider end-to-end (mocked SSH) ─────────────────────────────────────────

describe("BgpProvider", () => {
	it("detects Issue A: Idle neighbor via mocked router", async () => {
		const provider = new BgpProvider(makeRunner({ summary: BGP_SUMMARY_OUTPUT }));
		const res = await provider.handle(makeMonitor({ bgpNeighbor: "49.213.56.1", bgpExpectedAsn: 6939 }));
		expect(res.status).toBe(false);
		expect(res.type).toBe("bgp");
		expect(res.payload?.sessionState).toBe("Idle");
	});

	it("detects Issue A: invalid MED from Cloudflare neighbor", async () => {
		const provider = new BgpProvider(makeRunner({ summary: BGP_SUMMARY_OUTPUT, routes: BGP_ROUTES_MED_INVALID }));
		const res = await provider.handle(makeMonitor());
		expect(res.status).toBe(false);
		expect(res.message).toMatch(/MED anomali/);
		expect(res.payload?.anomalies.length).toBe(4);
		expect(res.payload?.checkedRules).toContain("med-validity");
	});

	it("reports up for healthy session", async () => {
		const provider = new BgpProvider(makeRunner({ summary: BGP_SUMMARY_OUTPUT, routes: BGP_ROUTES_HEALTHY }));
		const res = await provider.handle(makeMonitor());
		expect(res.status).toBe(true);
		expect(res.payload?.sessionUp).toBe(true);
	});

	it("returns error when credentials missing", async () => {
		const provider = new BgpProvider(makeRunner({}));
		const res = await provider.handle(makeMonitor({ bgpRouterPassword: undefined }));
		expect(res.status).toBe(false);
		expect(res.message).toMatch(/Kredensial/);
	});

	it("uses VRF-specific commands", async () => {
		const commands: string[] = [];
		const runner: IRouterCommandRunner = {
			exec: async (_h, _p, _u, _pw, cmd) => {
				commands.push(cmd);
				return cmd.includes("summary") ? BGP_SUMMARY_OUTPUT : BGP_ROUTES_HEALTHY;
			},
		};
		const provider = new BgpProvider(runner);
		await provider.handle(makeMonitor());
		expect(commands[0]).toContain("vpnv4 vrf 10-017");
		expect(commands[1]).toContain("neighbors 49.213.56.39 routes");
	});
});
