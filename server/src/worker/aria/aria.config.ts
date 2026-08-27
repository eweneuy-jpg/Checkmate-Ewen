/**
 * Agent Aria — configuration type.
 *
 * When ARIA_ENABLED is unset/false, the reactor is a no-op and adds zero
 * overhead to the check pipeline.  All tuning lives in env vars so it can
 * be changed without a redeploy of the config file.
 */
export interface AriaConfig {
	/** Master switch. When false the reactor returns immediately. */
	enabled: boolean;

	/** OpenAI-compatible chat completions endpoint. */
	aiBaseUrl: string;
	/** Model name sent to the provider. */
	aiModel: string;
	/** Bearer token for the AI provider. */
	aiApiKey: string;
	/** Max response tokens. */
	aiMaxTokens: number;
	/** Sampling temperature. */
	aiTemperature: number;

	/**
	 * SSH key path for diagnostic SSH sessions.
	 * If empty, password auth from monitor config is used.
	 */
	sshKeyPath: string;
	/** Default SSH user when monitor has no credentials. */
	sshDefaultUser: string;
	/** SSH connect timeout (ms). */
	sshConnectTimeout: number;
	/** Per-command execution timeout (ms). */
	sshCommandTimeout: number;

	/**
	 * Only trigger AI investigation when the alert severity matches one of
	 * these labels.  Lowercase, matched against monitor status / threshold
	 * breach type.  Default: ["down", "critical"].
	 */
	triggerOn: string[];
}

const DEFAULT_TRIGGER_ON = ["down", "critical"];

export const parseAriaConfig = (env: NodeJS.ProcessEnv = process.env): AriaConfig => {
	const bool = (v: string | undefined, def: boolean): boolean =>
		v === undefined ? def : v === "true" || v === "1";
	const num = (v: string | undefined, def: number): number =>
		v === undefined ? def : Number(v) || def;

	return {
		enabled: bool(env.ARIA_ENABLED, false),
		aiBaseUrl: env.ARIA_AI_BASE_URL || "https://api.openai.com/v1",
		aiModel: env.ARIA_AI_MODEL || "gpt-4o-mini",
		aiApiKey: env.ARIA_AI_API_KEY || "",
		aiMaxTokens: num(env.ARIA_AI_MAX_TOKENS, 1500),
		aiTemperature: num(env.ARIA_AI_TEMPERATURE, 2) / 10, // 2 => 0.2
		sshKeyPath: env.ARIA_SSH_KEY_PATH || "",
		sshDefaultUser: env.ARIA_SSH_DEFAULT_USER || "root",
		sshConnectTimeout: num(env.ARIA_SSH_CONNECT_TIMEOUT, 10_000),
		sshCommandTimeout: num(env.ARIA_SSH_COMMAND_TIMEOUT, 30_000),
		triggerOn: (env.ARIA_TRIGGER_ON || DEFAULT_TRIGGER_ON.join(","))
			.split(",")
			.map((s) => s.trim().toLowerCase())
			.filter(Boolean),
	};
};
