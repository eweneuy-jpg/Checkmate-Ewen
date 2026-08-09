import { jest } from "@jest/globals";
import { TopologyService } from "@/domain/topology/topology.service.js";
import type { IMonitorsRepository } from "@/domain/monitors/monitor.repository.interface.js";
import type { ILogger } from "@/utils/logger.js";
import type { Monitor } from "@/domain/monitors/monitor.type.js";

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

describe("TopologyService", () => {
	let service: TopologyService;
	let monitorsRepo: jest.Mocked<IMonitorsRepository>;

	beforeEach(() => {
		monitorsRepo = { findByTeamId: jest.fn() } as any;
		service = new TopologyService({ monitorsRepository: monitorsRepo });
	});

	it("should build nodes with correct state for each status", async () => {
		monitorsRepo.findByTeamId.mockResolvedValue([
			makeMonitor({ id: "m1", status: "up" }),
			makeMonitor({ id: "m2", status: "down" }),
			makeMonitor({ id: "m3", status: "paused" }),
			makeMonitor({ id: "m4", status: "unknown" }),
		]);

		const topo = await service.buildGraph("t1");

		expect(topo.nodes).toHaveLength(4);
		const byId = Object.fromEntries(topo.nodes.map((n) => [n.id, n]));
		expect(byId.m1.state).toBe("ok");
		expect(byId.m2.state).toBe("down");
		expect(byId.m3.state).toBe("paused");
		expect(byId.m4.state).toBe("unknown");
		expect(topo.summary.ok).toBe(1);
		expect(topo.summary.down).toBe(1);
		expect(topo.summary.paused).toBe(1);
		expect(topo.summary.unknown).toBe(1);
	});

	it("should infer edges from shared group", async () => {
		monitorsRepo.findByTeamId.mockResolvedValue([
			makeMonitor({ id: "m1", group: "web" }),
			makeMonitor({ id: "m2", group: "web" }),
			makeMonitor({ id: "m3", group: "db" }),
		]);

		const topo = await service.buildGraph("t1");

		expect(topo.edges.some((e) => e.source === "m1" && e.target === "m2" && e.kind === "group")).toBe(true);
		expect(topo.edges.some((e) => e.source === "m1" && e.target === "m3")).toBe(false);
	});

	it("should infer edges from shared subnet", async () => {
		monitorsRepo.findByTeamId.mockResolvedValue([
			makeMonitor({ id: "m1", url: "https://10.0.1.10/api" }),
			makeMonitor({ id: "m2", url: "https://10.0.1.11/api" }),
			makeMonitor({ id: "m3", url: "https://10.0.2.10/api" }),
		]);

		const topo = await service.buildGraph("t1");

		expect(topo.edges.some((e) => e.source === "m1" && e.target === "m2" && e.kind === "subnet")).toBe(true);
		expect(topo.edges.some((e) => e.source === "m1" && e.target === "m3")).toBe(false);
	});

	it("should mark edge as impaired when one end is down", async () => {
		monitorsRepo.findByTeamId.mockResolvedValue([
			makeMonitor({ id: "m1", status: "down", group: "web" }),
			makeMonitor({ id: "m2", status: "up", group: "web" }),
		]);

		const topo = await service.buildGraph("t1");

		expect(topo.edges[0].impaired).toBe(true);
	});

	it("should return empty arrays when no monitors", async () => {
		monitorsRepo.findByTeamId.mockResolvedValue([]);

		const topo = await service.buildGraph("t1");

		expect(topo.nodes).toHaveLength(0);
		expect(topo.edges).toHaveLength(0);
	});
});
