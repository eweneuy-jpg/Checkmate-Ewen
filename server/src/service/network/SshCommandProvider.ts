import RE2 from "re2";
import jmespath from "jmespath";
import { SshCommandStatusPayload } from "@/types/network.js";
import { IStatusProvider } from "./IStatusProvider.js";
import { MonitorType, Monitor } from "@/domain/monitors/monitor.type.js";
import { MonitorStatusResponse } from "@/types/network.js";
import { NETWORK_ERROR } from "@/types/network.js";
import { IRouterCommandRunner } from "./sshRunner.js";

const SERVICE_NAME = "SshCommandProvider";
/** Pangkas output CLI agar payload DB tidak membengkak. */
const OUTPUT_PREVIEW_MAX = 2000;

export interface SshEvalResult {
	matched: boolean;
	extracted?: unknown;
	message: string;
}

/**
 * Evaluasi output CLI terhadap ekspektasi monitor.
 * - contains:      output harus memuat string (mis. "is up" pada `show int`)
 * - not-contains:  output TIDAK boleh memuat string (mis. "CRC", "down")
 * - regex:         RE2 pattern harus match (aman dari ReDoS)
 * - json-path:     output di-parse JSON lalu diekstrak via JMESPath
 *                  (untuk perangkat yang support `| json` seperti NX-OS)
 */
export function evaluateSshOutput(monitor: Monitor, output: string): SshEvalResult {
	const method = monitor.sshMatchMethod ?? "contains";
	const expected = monitor.sshExpectedValue ?? "";

	switch (method) {
		case "contains": {
			const matched = output.includes(expected);
			return {
				matched,
				message: matched
					? `Output memuat "${expected}"`
					: `Output TIDAK memuat "${expected}"`,
			};
		}
		case "not-contains": {
			const matched = !output.includes(expected);
			return {
				matched,
				message: matched
					? `Output bersih dari "${expected}"`
					: `Output mengandung string terlarang "${expected}"`,
			};
		}
		case "regex": {
			let matched = false;
			try {
				matched = new RE2(expected, "m").test(output);
			} catch {
				return { matched: false, message: `Regex tidak valid: ${expected}` };
			}
			return {
				matched,
				message: matched ? `Pattern /${expected}/ match` : `Pattern /${expected}/ tidak match`,
			};
		}
		case "json-path": {
			let parsed: unknown;
			try {
				parsed = JSON.parse(output);
			} catch {
				return { matched: false, message: "Output bukan JSON valid — perangkat support `| json`?" };
			}
			let extracted: unknown;
			try {
				extracted = jmespath.search(parsed, expected);
			} catch {
				return { matched: false, message: `JSON path tidak valid: ${expected}` };
			}
			const matched = extracted !== null && extracted !== undefined && extracted !== false;
			return {
				matched,
				extracted,
				message: matched
					? `Path "${expected}" → ${JSON.stringify(extracted)}`
					: `Path "${expected}" tidak menghasilkan nilai`,
			};
		}
	}
}

export class SshCommandProvider implements IStatusProvider<SshCommandStatusPayload> {
	readonly type = "ssh-command";

	constructor(private runner: IRouterCommandRunner) {}

	supports(type: MonitorType): boolean {
		return type === "ssh-command";
	}

	async handle(monitor: Monitor): Promise<MonitorStatusResponse<SshCommandStatusPayload>> {
		const started = Date.now();
		const basePayload: SshCommandStatusPayload = {
			host: monitor.url ?? "",
			command: monitor.sshCommand ?? "",
			matchMethod: monitor.sshMatchMethod ?? "contains",
			matched: false,
			outputPreview: "",
			exitOk: false,
		};

		try {
			const host = monitor.url;
			if (!host) throw new Error("URL (host perangkat) wajib diisi untuk monitor ssh-command");
			if (!monitor.sshCommand) throw new Error("sshCommand wajib diisi untuk monitor ssh-command");
			if (!monitor.sshUsername || !monitor.sshPassword) {
				throw new Error("Kredensial SSH (sshUsername/sshPassword) wajib diisi");
			}

			const output = await this.runner.exec(
				host,
				monitor.sshPort ?? 22,
				monitor.sshUsername,
				monitor.sshPassword,
				monitor.sshCommand
			);

			const result = evaluateSshOutput(monitor, output);
			const payload: SshCommandStatusPayload = {
				...basePayload,
				matched: result.matched,
				extracted: result.extracted,
				outputPreview: output.slice(0, OUTPUT_PREVIEW_MAX),
				exitOk: true,
			};

			return {
				monitorId: monitor.id,
				teamId: monitor.teamId,
				type: "ssh-command",
				status: result.matched,
				code: result.matched ? 200 : NETWORK_ERROR,
				message: result.message,
				responseTime: Date.now() - started,
				payload,
			};
		} catch (error) {
			return {
				monitorId: monitor.id,
				teamId: monitor.teamId,
				type: "ssh-command",
				status: false,
				code: NETWORK_ERROR,
				message: error instanceof Error ? error.message : String(error),
				responseTime: Date.now() - started,
				payload: basePayload,
			};
		}
	}
}
