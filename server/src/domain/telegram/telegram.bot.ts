/**
 * Telegram bot — long-polling getUpdates loop.
 *
 * Runs as a background loop alongside the main Express server.
 * When TELEGRAM_BOT_TOKEN is unset, start() is a no-op.
 *
 * Uses got (already in deps) for HTTP calls to the Telegram Bot API.
 */
import got from "got";
import type { ILogger } from "@/utils/logger.js";
import type { IRacksService } from "@/domain/racks/rack.service.js";
import type { IServersService } from "@/domain/servers/server.service.js";
import type { TelegramBotConfig } from "./telegram.config.js";
import { TelegramCommandHandler } from "./telegram.commands.js";

const SERVICE_NAME = "TelegramBot";

export class TelegramBot {
	private offset = 0;
	private running = false;
	private commands: TelegramCommandHandler;
	private teamId = "";

	constructor(
		private logger: ILogger,
		private config: TelegramBotConfig,
		private racksService: IRacksService,
		private serversService: IServersService,
	) {
		this.commands = new TelegramCommandHandler(logger, racksService, serversService);
	}

	/** Set teamId for multi-tenant context. */
	setTeamId = (teamId: string) => {
		this.teamId = teamId;
	};

	start = async () => {
		if (!this.config.enabled) {
			this.logger.info({
				service: SERVICE_NAME,
				method: "start",
				message: "Telegram bot disabled (TELEGRAM_BOT_TOKEN not set)",
			});
			return;
		}

		// Get bot info
		try {
			const me = await this.callApi<{ username: string; first_name: string }>("getMe", {});
			this.logger.info({
				service: SERVICE_NAME,
				method: "start",
				message: `Telegram bot started: @${me.username} (${me.first_name})`,
			});
		} catch (err) {
			this.logger.error({
				service: SERVICE_NAME,
				method: "start",
				message: `Failed to connect to Telegram: ${err instanceof Error ? err.message : "unknown"}`,
			});
			return;
		}

		// Delete pending updates (avoid replaying old commands)
		await this.callApi("deleteWebhook", { drop_pending_updates: true }).catch(() => {});

		this.running = true;
		this.pollLoop();
	};

	stop = () => {
		this.running = false;
		this.logger.info({ service: SERVICE_NAME, method: "stop", message: "Telegram bot stopped" });
	};

	private pollLoop = async () => {
		while (this.running) {
			try {
				const updates = await this.callApi<unknown[]>("getUpdates", {
						offset: this.offset,
						timeout: this.config.pollTimeout,
						allowed_updates: ["message", "callback_query"],
					});

					if (!Array.isArray(updates)) continue;

					for (const update of updates as Record<string, unknown>[]) {
						this.offset = (update.update_id as number) + 1;

						const msg = update.message as { chat: { id: number }; text: string } | undefined;
						if (msg?.text) {
							await this.handleMessage(msg);
						}
					}
			} catch (err) {
				this.logger.warn({
					service: SERVICE_NAME,
					method: "pollLoop",
					message: `Poll error: ${err instanceof Error ? err.message : "unknown"}`,
				});
				// Backoff on error
				await new Promise((r) => setTimeout(r, 5000));
			}
		}
	};

	private handleMessage = async (msg: {
		chat: { id: number };
		from?: { first_name?: string };
		text: string;
	}) => {
		const chatId = String(msg.chat.id);

		// Auth check
		if (this.config.allowedChatIds.length > 0 && !this.config.allowedChatIds.includes(chatId)) {
			this.logger.warn({
				service: SERVICE_NAME,
				method: "handleMessage",
				message: `Unauthorized chat_id: ${chatId}`,
			});
			return;
		}

		if (!this.teamId) {
			this.logger.warn({
				service: SERVICE_NAME,
				method: "handleMessage",
				message: "teamId not set, skipping message",
			});
			return;
		}

		const result = await this.commands.handle(msg.text, chatId, this.teamId);
		if (!result) return;

		await this.sendMessage(chatId, result.text);
	};

	private sendMessage = async (chatId: string, text: string) => {
		try {
			await this.callApi("sendMessage", {
				chat_id: chatId,
				text,
				parse_mode: "HTML",
				disable_web_page_preview: true,
			});
		} catch (err) {
			this.logger.warn({
				service: SERVICE_NAME,
				method: "sendMessage",
				message: `Failed to send: ${err instanceof Error ? err.message : "unknown"}`,
			});
		}
	};

	private callApi = async <T = unknown>(method: string, params: Record<string, unknown>): Promise<T> => {
		const url = `https://api.telegram.org/bot${this.config.botToken}/${method}`;
		const resp = await got.post(url, {
			json: params,
			timeout: { request: (this.config.pollTimeout + 10) * 1000 },
			retry: { limit: 2 },
		});
		const body = JSON.parse(resp.body);
		if (!body.ok) {
			throw new Error(`Telegram API error: ${body.description ?? "unknown"}`);
		}
		return body.result;
	};
}
