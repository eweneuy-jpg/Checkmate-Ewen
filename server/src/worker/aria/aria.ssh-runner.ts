/**
 * Agent Aria — SSH diagnostic runner.
 *
 * Reuses the existing `IRouterCommandRunner` abstraction from BgpProvider /
 * SshCommandProvider so tests can inject a mock.  In production we use the
 * real `SshRouterCommandRunner` (ssh2) that's already in the codebase.
 */
import type { IRouterCommandRunner } from "@/service/network/sshRunner.js";
import { ILogger } from "@/utils/logger.js";

const SERVICE_NAME = "AriaSshRunner";

/** Run a list of shell commands on a remote host, return combined output. */
export const runDiagnosticCommands = async (
	runner: IRouterCommandRunner,
	logger: ILogger,
	host: string,
	port: number,
	username: string,
	password: string,
	commands: string[],
	commandTimeoutMs: number,
): Promise<string> => {
	if (!host) {
		return "[aria] No host/instance in alert — SSH skipped";
	}

	const script = commands.join("; \n");
	try {
		logger.debug({
			service: SERVICE_NAME,
			method: "runDiagnosticCommands",
			message: `SSH ${username}@${host}:${port} — ${commands.length} commands`,
		});

		const output = await runner.exec(host, port, username, password, script);
		return output || "[aria] SSH returned no output";
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		logger.warn({
			service: SERVICE_NAME,
			method: "runDiagnosticCommands",
			message: `SSH to ${host} failed: ${msg}`,
		});
		return `[aria] SSH error: ${msg}`;
	}
};
