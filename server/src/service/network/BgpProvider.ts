import { BgpStatusPayload, BgpNeighborState, BgpRouteAnomaly } from "@/types/network.js";
import { IStatusProvider } from "./IStatusProvider.js";
import { MonitorType, Monitor } from "@/domain/monitors/monitor.type.js";
import { MonitorStatusResponse } from "@/types/network.js";
import { NETWORK_ERROR } from "@/types/network.js";
import { IRouterCommandRunner } from "./sshRunner.js";

/**
 * Nilai MED maksimum 32-bit — indikator rute yang di-invalidasi
 * (persis pola yang terlihat pada Isu A: MED 4294967295 dari AS13335).
 */
export const BGP_MED_INVALID = 4294967295;
/** Ambang default: MED di atas nilai ini dianggap anomali. */
export const BGP_DEFAULT_MAX_MED = 1000000;

export type { IRouterCommandRunner } from "./sshRunner.js";

/**
 * Parser output `show ip bgp [vpnv4 vrf X] summary` gaya Cisco IOS-XE.
 * Format baris neighbor:
 *   49.213.56.39    4  13335  105140  368141725  22269  0  0  4w5d  5
 *   49.213.56.1     4   6939   ...                            9w2d  Idle
 */
export function parseBgpSummary(text: string): BgpNeighborState[] {
	const neighbors: BgpNeighborState[] = [];
	const lineRe = /^\s*(\d{1,3}(?:\.\d{1,3}){3})\s+(\d)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\S+)\s+(\S+)\s*$/;
	for (const line of text.split(/\r?\n/)) {
		const m = line.match(lineRe);
		if (!m) continue;
		const ip = m[1]!;
		const asn = m[3]!;
		const upDown = m[9]!;
		const stateOrPfx = m[10]!;
		const isNumeric = /^\d+$/.test(stateOrPfx);
		neighbors.push({
			neighbor: ip,
			asn: parseInt(asn, 10),
			state: isNumeric ? "Established" : stateOrPfx,
			prefixesReceived: isNumeric ? parseInt(stateOrPfx, 10) : 0,
			upDown,
		});
	}
	return neighbors;
}

/**
 * Parser output `show ip bgp vpnv4 vrf X nei A.B.C.D routes` gaya IOS-XE.
 * Baris rute:  *> 172.65.0.0/20   49.213.56.39   4294967295   999   0 13335 i
 * Kolom: Network  NextHop  Metric(MED)  LocPrf  Weight  Path  Origin
 */
export function parseBgpNeighborRoutes(text: string): { prefix: string; med: number; localPref?: number; asPath?: string }[] {
	const routes: { prefix: string; med: number; localPref?: number; asPath?: string }[] = [];
	const re = /^\s*\*?>?\s*(\d{1,3}(?:\.\d{1,3}){3}\/\d{1,2})\s+\d{1,3}(?:\.\d{1,3}){3}\s+(\d+)\s*(\d+)?\s*\d*\s*([\d\s{}().]*?)\s*([ie?])?\s*$/;
	for (const line of text.split(/\r?\n/)) {
		const m = line.match(re);
		if (!m) continue;
		const prefix = m[1]!;
		const medStr = m[2]!;
		const locPrefStr = m[3];
		const asPath = m[4];
		routes.push({
			prefix,
			med: parseInt(medStr, 10),
			localPref: locPrefStr ? parseInt(locPrefStr, 10) : undefined,
			asPath: asPath?.trim() || undefined,
		});
	}
	return routes;
}

export interface BgpRuleResult {
	up: boolean;
	anomalies: BgpRouteAnomaly[];
	messages: string[];
	checkedRules: string[];
}

/** Evaluasi aturan Isu A terhadap state sesi + rute yang diparse. */
export function evaluateBgpRules(
	monitor: Monitor,
	neighbor: BgpNeighborState | undefined,
	routes: { prefix: string; med: number; localPref?: number; asPath?: string }[]
): BgpRuleResult {
	const anomalies: BgpRouteAnomaly[] = [];
	const messages: string[] = [];
	const checkedRules: string[] = ["session-state"];
	let up = true;

	// Rule 1 — sesi harus Established (menangkap kasus 49.213.56.1 Idle 9w2d)
	if (!neighbor) {
		checkedRules.push("neighbor-exists");
		return {
			up: false,
			anomalies,
			messages: [`Neighbor ${monitor.bgpNeighbor} tidak ditemukan di BGP summary`],
			checkedRules,
		};
	}
	if (neighbor.state !== "Established") {
		up = false;
		messages.push(`Sesi BGP ${neighbor.neighbor} (AS${neighbor.asn}) status ${neighbor.state} (up/down: ${neighbor.upDown})`);
	}

	// Rule 2 — ASN harus sesuai ekspektasi (mis. 13335 untuk Cloudflare)
	if (monitor.bgpExpectedAsn !== undefined && neighbor.asn !== monitor.bgpExpectedAsn) {
		checkedRules.push("asn-match");
		up = false;
		messages.push(`ASN neighbor ${neighbor.asn} != expected AS${monitor.bgpExpectedAsn}`);
	}

	// Rule 3 — jumlah prefix minimum (menangkap sesi Established tapi rute kosong)
	if (monitor.bgpMinPrefixes !== undefined && neighbor.state === "Established") {
		checkedRules.push("min-prefixes");
		if (neighbor.prefixesReceived < monitor.bgpMinPrefixes) {
			up = false;
			messages.push(`Prefix diterima ${neighbor.prefixesReceived} < minimum ${monitor.bgpMinPrefixes}`);
		}
	}

	// Rule 4 — deteksi MED invalid/anomali (inti Isu A: 4294967295)
	const checkMed = monitor.bgpCheckMed !== false; // default on
	if (checkMed && routes.length > 0) {
		checkedRules.push("med-validity");
		const maxMed = monitor.bgpMaxMed ?? BGP_DEFAULT_MAX_MED;
		for (const r of routes) {
			if (r.med >= BGP_MED_INVALID || r.med > maxMed) {
				anomalies.push({
					prefix: r.prefix,
					med: r.med,
					localPref: r.localPref,
					asPath: r.asPath,
					reason:
						r.med >= BGP_MED_INVALID
							? "MED = 4294967295 (invalid/max 32-bit) — rute tidak akan diinstal ke RIB"
							: `MED ${r.med} melebihi ambang ${maxMed}`,
				});
			}
		}
		if (anomalies.length > 0) {
			up = false;
			const first = anomalies[0]!;
			messages.push(`${anomalies.length} rute dengan MED anomali (contoh: ${first.prefix} MED=${first.med})`);
		}
	}

	// Rule 5 — prefix check: apakah kita menerima rute sama sekali dari neighbor ini
	if (monitor.bgpCheckPrefixes && routes.length === 0 && neighbor.state === "Established") {
		checkedRules.push("routes-received");
		up = false;
		messages.push("Tidak ada rute yang diterima dari neighbor padahal sesi Established");
	}

	return { up, anomalies, messages, checkedRules };
}

export class BgpProvider implements IStatusProvider<BgpStatusPayload> {
	readonly type = "bgp";

	constructor(private runner: IRouterCommandRunner) {}

	supports(type: MonitorType): boolean {
		return type === "bgp";
	}

	private buildSummaryCommand(monitor: Monitor): string {
		const vrf = monitor.bgpVrf?.trim();
		return vrf ? `show ip bgp vpnv4 vrf ${vrf} summary` : "show ip bgp summary";
	}

	private buildRoutesCommand(monitor: Monitor): string {
		const vrf = monitor.bgpVrf?.trim();
		const nei = monitor.bgpNeighbor!;
		return vrf ? `show ip bgp vpnv4 vrf ${vrf} neighbors ${nei} routes` : `show ip bgp neighbors ${nei} routes`;
	}

	async handle(monitor: Monitor): Promise<MonitorStatusResponse<BgpStatusPayload>> {
		const started = Date.now();
		try {
			const host = monitor.url;
			if (!host) throw new Error("URL (router host) wajib diisi untuk monitor bgp");
			if (!monitor.bgpNeighbor) throw new Error("bgpNeighbor wajib diisi untuk monitor bgp");
			if (!monitor.bgpRouterUsername || !monitor.bgpRouterPassword) {
				throw new Error("Kredensial SSH router (bgpRouterUsername/bgpRouterPassword) wajib diisi");
			}

			const port = monitor.bgpRouterPort ?? 22;
			const user = monitor.bgpRouterUsername;
			const pass = monitor.bgpRouterPassword;

			// 1) Ambil BGP summary, cari neighbor target
			const summaryRaw = await this.runner.exec(host, port, user, pass, this.buildSummaryCommand(monitor));
			const neighbors = parseBgpSummary(summaryRaw);
			const neighbor = neighbors.find((n) => n.neighbor === monitor.bgpNeighbor);

			// 2) Ambil rute dari neighbor (untuk cek MED) — hanya bila sesi Established
			let routes: { prefix: string; med: number; localPref?: number; asPath?: string }[] = [];
			let routesRaw = "";
			const wantRoutes = monitor.bgpCheckMed !== false || monitor.bgpCheckPrefixes === true;
			if (neighbor?.state === "Established" && wantRoutes) {
				routesRaw = await this.runner.exec(host, port, user, pass, this.buildRoutesCommand(monitor));
				routes = parseBgpNeighborRoutes(routesRaw);
			}

			// 3) Evaluasi aturan
			const result = evaluateBgpRules(monitor, neighbor, routes);

			const payload: BgpStatusPayload = {
				router: host,
				neighbor: monitor.bgpNeighbor,
				sessionUp: result.up,
				sessionState: neighbor?.state ?? "NotFound",
				asn: neighbor?.asn,
				prefixesReceived: neighbor?.prefixesReceived,
				upDown: neighbor?.upDown,
				anomalies: result.anomalies,
				checkedRules: result.checkedRules,
			};

			return {
				monitorId: monitor.id,
				teamId: monitor.teamId,
				type: "bgp",
				status: result.up,
				code: result.up ? 200 : NETWORK_ERROR,
				message: result.up
					? `BGP ${monitor.bgpNeighbor} Established, ${neighbor?.prefixesReceived ?? 0} prefix, tidak ada anomali`
					: result.messages.join("; "),
				responseTime: Date.now() - started,
				payload,
			};
		} catch (error) {
			return {
				monitorId: monitor.id,
				teamId: monitor.teamId,
				type: "bgp",
				status: false,
				code: NETWORK_ERROR,
				message: error instanceof Error ? error.message : String(error),
				responseTime: Date.now() - started,
				payload: {
					router: monitor.url ?? "",
					neighbor: monitor.bgpNeighbor ?? "",
					sessionUp: false,
					sessionState: "Error",
					anomalies: [],
					checkedRules: [],
				},
			};
		}
	}
}
