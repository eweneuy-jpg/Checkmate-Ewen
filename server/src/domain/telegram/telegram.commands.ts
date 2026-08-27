/**
 * Telegram bot command handlers.
 *
 * Each command returns an HTML-formatted string to send back to the user.
 * Commands are restricted to allowedChatIds from config.
 */
import type { IRacksService } from "@/domain/racks/rack.service.js";
import type { IServersService } from "@/domain/servers/server.service.js";
import type { ILogger } from "@/utils/logger.js";

const SERVICE_NAME = "TelegramCommands";

export class TelegramCommandHandler {
	constructor(
		private logger: ILogger,
		private racksService: IRacksService,
		private serversService: IServersService,
	) {}

	/**
	 * Parse and route a command message.
	 * Returns { text, keyboard } or null if not a command.
	 */
	handle = async (
		text: string,
		chatId: string,
		teamId: string,
	): Promise<{ text: string; keyboard?: unknown } | null> => {
		const trimmed = text.trim();
		if (!trimmed.startsWith("/")) return null;

		const parts = trimmed.split(/\s+/);
		const cmd = (parts[0] ?? "").toLowerCase();
		const args = parts.slice(1).join(" ");

		this.logger.info({
			service: SERVICE_NAME,
			method: "handle",
			message: `Command: ${cmd} args=${args.slice(0, 80)}`,
		});

		try {
			switch (cmd) {
				case "/start":
				case "/help":
					return this.cmdHelp();

				case "/addrack":
					return await this.cmdAddRack(args, teamId);

				case "/listrack":
				case "/listracks":
					return await this.cmdListRacks(teamId);

				case "/rack":
					return await this.cmdRackDetail(args, teamId);

				case "/addserver":
					return await this.cmdAddServer(args, teamId);

				case "/listserver":
				case "/listservers":
					return await this.cmdListServers(teamId);

				case "/linkserver":
					return await this.cmdLinkServer(args, teamId);

				case "/server":
					return await this.cmdServerDetail(args, teamId);

				default:
					return {
						text: `❌ Unknown command: <code>${cmd}</code>\n\nKetik <code>/help</code> untuk daftar perintah.`,
					};
			}
		} catch (err) {
			const msg = err instanceof Error ? err.message : "unknown error";
			this.logger.error({
				service: SERVICE_NAME,
				method: "handle",
				message: `Command ${cmd} failed: ${msg}`,
			});
			return {
				text: `❌ Error: <code>${msg}</code>`,
			};
		}
	};

	private cmdHelp = () => ({
		text: `<b>🤖 Checkmate Bot — DC Rack Management</b>

<b>Perintah Rack:</b>
• <code>/addrack &lt;name&gt; &lt;location&gt; [totalU]</code> — Tambah rack baru
• <code>/listrack</code> — Daftar semua rack
• <code>/rack &lt;name&gt;</code> — Detail rack + posisi server

<b>Perintah Server:</b>
• <code>/addserver &lt;hostname&gt; &lt;ip&gt; [role] [project]</code> — Tambah server
• <code>/listserver</code> — Daftar semua server
• <code>/linkserver &lt;hostname&gt; &lt;rackName&gt; &lt;uStart&gt; [uHeight]</code> — Pasang server ke rack
• <code>/server &lt;hostname&gt;</code> — Detail server

<b>Contoh:</b>
<code>/addrack 10-IPDN NETS4 42</code>
<code>/addserver 10-vmwU14 192.168.2.14 hypervisor 10-INT101</code>
<code>/linkserver 10-vmwU14 10-IPDN 29 2</code>`,
	});

	private cmdAddRack = async (args: string, teamId: string) => {
		const parts = args.split(/\s+/);
		if (parts.length < 2) {
			return {
				text: `Usage: <code>/addrack &lt;name&gt; &lt;location&gt; [totalU]</code>\nContoh: <code>/addrack 10-IPDN NETS4 42</code>`,
			};
		}
		const name = parts[0];
		const location = parts[1];
		const totalU = parts[2] ? parseInt(parts[2], 10) : 42;

		const rack = await this.racksService.createRack({ name, location, totalU }, teamId);
		return {
			text: `✅ <b>Rack created</b>\n\n• Name: <code>${rack.name}</code>\n• Location: <code>${rack.location}</code>\n• Total U: ${rack.totalU}\n• ID: <code>${rack.id}</code>`,
		};
	};

	private cmdListRacks = async (teamId: string) => {
		const racks = await this.racksService.getRacksByTeamId(teamId);
		if (racks.length === 0) {
			return { text: "📭 Belum ada rack. Ketik <code>/addrack</code> untuk membuat." };
		}
		const lines = racks.map(
			(r) =>
				`• <code>${r.name}</code> — ${r.location} | ${r.usedU}/${r.totalU}U used | ${r.serverCount} servers`,
		);
		return {
			text: `<b>📋 Rack List (${racks.length})</b>\n\n${lines.join("\n")}`,
		};
	};

	private cmdRackDetail = async (args: string, teamId: string) => {
		if (!args.trim()) {
			return { text: "Usage: <code>/rack &lt;name&gt;</code>" };
		}
		const name = args.trim();
		// Find rack by name — need to list and find
		const racks = await this.racksService.getRacksByTeamId(teamId);
		const rackSummary = racks.find((r) => r.name === name);
		if (!rackSummary) {
			return { text: `❌ Rack <code>${name}</code> tidak ditemukan` };
		}
		const rack = await this.racksService.getRackWithSlots(rackSummary.id, teamId);
		const slotLines: string[] = [];
		for (const slot of rack.slots) {
			if (slot.server) {
				const s = slot.server;
				const led = s.overallStatus === "up" ? "🟢" : s.overallStatus === "down" ? "🔴" : s.overallStatus === "degraded" ? "🟡" : "⚪";
				const vm = s.isVmHost ? ` [VM×${s.vmNames.length}]` : "";
				const proj = s.projectName ? ` ${s.projectName}` : "";
				slotLines.push(`U${String(slot.u).padStart(2, "0")} ${led} <code>${s.hostname}</code>${vm}${proj}`);
			}
		}
		return {
			text: `<b>🗄 ${rack.name}</b> — ${rack.location}\n<b>${rackSummary.usedU}/${rack.totalU}U used | ${rackSummary.serverCount} servers</b>\n\n${slotLines.join("\n")}`,
		};
	};

	private cmdAddServer = async (args: string, teamId: string) => {
		const parts = args.split(/\s+/);
		if (parts.length < 2) {
			return {
				text: `Usage: <code>/addserver &lt;hostname&gt; &lt;ip&gt; [role] [project]</code>\nContoh: <code>/addserver 10-vmwU14 192.168.2.14 hypervisor 10-INT101</code>`,
			};
		}
		const hostname = parts[0];
		const ip = parts[1];
		const role = parts[2] || "other";
		const project = parts[3] || undefined;

		// Get userId from first rack's team — use a system user
		const server = await this.serversService.createServer(
			{ hostname, ipAddress: ip, role: role as never, projectName: project },
			"000000000000000000000000",
			teamId,
		);
		return {
			text: `✅ <b>Server created</b>\n\n• Hostname: <code>${server.hostname}</code>\n• IP: <code>${server.ipAddress}</code>\n• Role: ${server.role}\n• Project: ${server.projectName || "—"}\n• ID: <code>${server.id}</code>`,
		};
	};

	private cmdListServers = async (teamId: string) => {
		const servers = await this.serversService.getServersByTeamId(teamId);
		if (servers.length === 0) {
			return { text: "📭 Belum ada server. Ketik <code>/addserver</code> untuk membuat." };
		}
		const lines = servers.map(
			(s) =>
				`• <code>${s.hostname}</code> — ${s.ipAddress} | ${s.role}${s.rackName ? ` | ${s.rackName} U${s.uStart}` : ""}`,
		);
		return {
			text: `<b>🖥 Server List (${servers.length})</b>\n\n${lines.join("\n")}`,
		};
	};

	private cmdLinkServer = async (args: string, teamId: string) => {
		const parts = args.split(/\s+/);
		if (parts.length < 3) {
			return {
				text: `Usage: <code>/linkserver &lt;hostname&gt; &lt;rackName&gt; &lt;uStart&gt; [uHeight]</code>\nContoh: <code>/linkserver 10-vmwU14 10-IPDN 29 2</code>`,
			};
		}
		const hostname = parts[0];
		const rackName = parts[1];
		const uStart = parseInt(parts[2] ?? "0", 10);
		const uHeight = parts[3] ? parseInt(parts[3], 10) : 1;

		// Find server by hostname
		const servers = await this.serversService.getServersByTeamId(teamId);
		const server = servers.find((s) => s.hostname === hostname);
		if (!server) {
			return { text: `❌ Server <code>${hostname}</code> tidak ditemukan` };
		}

		// Find rack by name
		const racks = await this.racksService.getRacksByTeamId(teamId);
		const rack = racks.find((r) => r.name === rackName);
		if (!rack) {
			return { text: `❌ Rack <code>${rackName}</code> tidak ditemukan` };
		}

		const updated = await this.serversService.updateServer(server.id, teamId, {
			rackId: rack.id,
			uStart,
			uHeight,
			face: "front",
		});

		return {
			text: `✅ <b>Server linked to rack</b>\n\n• Server: <code>${updated.hostname}</code>\n• Rack: <code>${rackName}</code>\n• Position: U${uStart} (${uHeight}U)`,
		};
	};

	private cmdServerDetail = async (args: string, teamId: string) => {
		if (!args.trim()) {
			return { text: "Usage: <code>/server &lt;hostname&gt;</code>" };
		}
		const hostname = args.trim();
		const servers = await this.serversService.getServersByTeamId(teamId);
		const server = servers.find((s) => s.hostname === hostname);
		if (!server) {
			return { text: `❌ Server <code>${hostname}</code> tidak ditemukan` };
		}
		const detail = await this.serversService.getServerWithMonitors(server.id, teamId);
		const monitors = detail.linkedMonitors.length
			? detail.linkedMonitors.map((m) => `  • ${m.name} (${m.type}) — ${m.status}`).join("\n")
			: "  —";
		return {
			text: `<b>🖥 ${detail.hostname}</b>\n\n• IP: <code>${detail.ipAddress}</code>\n• Role: ${detail.role}\n• Project: ${detail.projectName || "—"}\n• Hardware: ${detail.hardwareModel || "—"}\n• Rack: ${detail.rackName || "—"} ${detail.uStart ? `U${detail.uStart} (${detail.uHeight}U)` : ""}\n• Status: ${detail.overallStatus.toUpperCase()}\n• VMs: ${detail.isVmHost ? (detail.vmNames ?? []).join(", ") : "—"}\n\n<b>Monitors:</b>\n<code>${monitors}</code>`,
		};
	};
}
