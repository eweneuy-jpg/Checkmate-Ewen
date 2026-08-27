/**
 * Agent Aria — AI analysis service.
 *
 * Calls an OpenAI-compatible /chat/completions endpoint to produce a
 * structured root-cause report from the alert context + SSH diagnostics.
 *
 * Uses `got` (already a dependency) for HTTP, no new deps.
 */
import got from "got";
import type { AriaConfig } from "./aria.config.js";
import type { ILogger } from "@/utils/logger.js";

const SERVICE_NAME = "AriaAnalyzer";

const SYSTEM_PROMPT = `Kamu adalah Site Reliability Engineer (SRE) dan network engineer senior.
Tugasmu: analisa alert monitoring + hasil diagnosa SSH, buat report terstruktur.

Format WAJIB (HTML untuk Telegram):

<b>🔍 Analisa</b>
- [1-3 poin penyebab paling mungkin, berdasarkan data SSH]
- [Sebut nama proses/command spesifik jika ada]

<b>⚠️ Dampak</b>
- [Dampak ke layanan/produksi]
- [Risiko jika tidak ditangani]

<b>🔧 Investigasi</b>
- [Ringkasan apa yang ditemukan via SSH: proses, resource, log]

<b>💡 Rekomendasi Solusi</b>
- [Langkah konkret: command kill/fix/config]
- [Preventif: apa yang perlu ditambah untuk mencegah recurring]

Aturan:
- Bahasa Indonesia, formal tapi concise
- Berdasarkan data SSH output, jangan spekulasi
- Jika data tidak cukup, bilang "data tidak cukup"
- Maksimal 1500 karakter total`;

export interface AlertContext {
	monitorName: string;
	monitorType: string;
	severity: string;
	host: string;
	url: string;
	statusChangeCode: string;
	summary: string;
	description: string;
	alertType: string;
	thresholds?: string;
}

export const buildUserPrompt = (ctx: AlertContext, diagOutput: string): string => {
	const lines = [
		`ALERT INFO`,
		`Name: ${ctx.monitorName}`,
		`Type: ${ctx.monitorType}`,
		`Severity: ${ctx.severity}`,
		`Host: ${ctx.host}`,
		`URL: ${ctx.url}`,
		`Status Change: ${ctx.statusChangeCode}`,
		`Summary: ${ctx.summary}`,
		`Description: ${ctx.description}`,
		`Alert Category: ${ctx.alertType}`,
	];
	if (ctx.thresholds) lines.push(`Thresholds: ${ctx.thresholds}`);
	lines.push("", `SSH DIAGNOSTICS OUTPUT (host: ${ctx.host})`, "```", diagOutput.slice(0, 8000), "```");
	return lines.join("\n");
};

export const analyzeWithAI = async (
	cfg: AriaConfig,
	logger: ILogger,
	ctx: AlertContext,
	diagOutput: string,
): Promise<string> => {
	if (!cfg.aiApiKey) {
		logger.warn({
			service: SERVICE_NAME,
			method: "analyzeWithAI",
			message: "ARIA_AI_API_KEY not set — skipping AI analysis",
		});
		return "⚠️ AI analysis skipped — ARIA_AI_API_KEY not set";
	}

	const userPrompt = buildUserPrompt(ctx, diagOutput);

	try {
		const resp = await got.post(`${cfg.aiBaseUrl.replace(/\/+$/, "")}/chat/completions`, {
			json: {
				model: cfg.aiModel,
				messages: [
					{ role: "system", content: SYSTEM_PROMPT },
					{ role: "user", content: userPrompt },
				],
				max_tokens: cfg.aiMaxTokens,
				temperature: cfg.aiTemperature,
			},
			timeout: { request: 60_000 },
			retry: { limit: 0 },
			headers: { Authorization: `Bearer ${cfg.aiApiKey}` },
		});

		const data = JSON.parse(resp.body);
		const content = data?.choices?.[0]?.message?.content;
		if (!content) {
			logger.warn({
				service: SERVICE_NAME,
				method: "analyzeWithAI",
				message: "AI returned empty response",
			});
			return "⚠️ AI returned empty response";
		}
		return content;
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		logger.error({
			service: SERVICE_NAME,
			method: "analyzeWithAI",
			message: `AI analysis failed: ${msg}`,
		});
		return `⚠️ AI analysis error: ${msg}`;
	}
};
