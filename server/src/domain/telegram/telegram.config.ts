/**
 * Telegram bot configuration — parsed from env vars.
 *
 * When TELEGRAM_BOT_TOKEN is unset, the bot module is a no-op.
 */
export interface TelegramBotConfig {
	enabled: boolean;
	botToken: string;
	/** Authorized chat IDs that can send commands. */
	allowedChatIds: string[];
	/** Polling timeout in seconds (long polling). */
	pollTimeout: number;
}

export const parseTelegramBotConfig = (): TelegramBotConfig => {
	const token = process.env.TELEGRAM_BOT_TOKEN ?? "";
	const chats = process.env.TELEGRAM_CHAT_IDS ?? "";
	const pollTimeout = parseInt(process.env.TELEGRAM_POLL_TIMEOUT ?? "30", 10);

	return {
		enabled: !!token,
		botToken: token,
		allowedChatIds: chats
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean),
		pollTimeout: Number.isNaN(pollTimeout) ? 30 : pollTimeout,
	};
};
