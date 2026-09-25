/**
 * OpenAI provider — the AI research agent.
 *
 * The model never produces numbers. It receives the data our own services
 * collected and does the part code cannot do: narrative, catalyst, conflicting
 * claims, what would change the picture. Anything it cannot verify it must
 * mark as unavailable rather than fill in.
 *
 * Runs server-side only, and is always optional: without a key or credits the
 * scanner, the scoring and the dashboard all keep working.
 */
import OpenAI from "openai";
import type { LegacyDexPair } from "./dexscreener";

export const DEFAULT_MODEL = "gpt-5.5";

export type ResearchReport = {
  summary: string;
  narrative: string;
  catalysts: string[];
  bullFactors: string[];
  riskFactors: string[];
  unverifiedClaims: string[];
  researchConfidence: number; // 0-100
  researchNotes: string;
};

export type ResearchResult =
  | { ok: true; report: ResearchReport; raw: string; model: string }
  | { ok: false; reason: "not_configured" | "api_error" | "bad_format"; message: string };

export function isConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

const SYSTEM = `You are a research agent for crypto and memecoins.
Research and paper-trade planning only. Never claim certainty and never place a real trade.

You are given market data that has already been collected by deterministic services.
NEVER invent or restate numbers that are not in that data. If something is not
provided — holder concentration, contract permissions, taxes, locked liquidity,
insider wallets, dev ownership — treat it as unavailable and list it under
unverifiedClaims. Do not estimate it.

Your job is the part code cannot do:
- what the project claims to be, and what the token's narrative is
- what is currently drawing attention to it, if anything
- which public claims are unverifiable
- where the data contradicts itself
- what would change your view

Respond with JSON only, matching exactly this shape:
{
  "summary": string,
  "narrative": string,
  "catalysts": string[],
  "bullFactors": string[],
  "riskFactors": string[],
  "unverifiedClaims": string[],
  "researchConfidence": number,
  "researchNotes": string
}
researchConfidence is 0-100 and reflects how much verifiable information you
found, not how bullish you are.`;

export function parseReport(raw: string): ResearchReport | null {
  const text = (raw || "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const d = JSON.parse(text.slice(start, end + 1));
    const arr = (v: unknown): string[] =>
      Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
    if (typeof d.summary !== "string" || !d.summary.trim()) return null;
    const confidence = Number(d.researchConfidence);
    return {
      summary: d.summary,
      narrative: typeof d.narrative === "string" ? d.narrative : "",
      catalysts: arr(d.catalysts),
      bullFactors: arr(d.bullFactors),
      riskFactors: arr(d.riskFactors),
      unverifiedClaims: arr(d.unverifiedClaims),
      researchConfidence: Number.isFinite(confidence)
        ? Math.max(0, Math.min(100, Math.round(confidence)))
        : 0,
      researchNotes: typeof d.researchNotes === "string" ? d.researchNotes : "",
    };
  } catch {
    return null;
  }
}

async function callModel(query: string, market: LegacyDexPair[], model: string): Promise<string> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.responses.create({
    model,
    instructions: SYSTEM,
    input:
      `Analyze this token/search query: ${query}\n\n` +
      `Collected market data (this is the only market data that exists — do not add to it):\n` +
      JSON.stringify(market, null, 2),
    tools: [{ type: "web_search" }],
  });
  return response.output_text;
}

/** Structured research. Never throws — the caller degrades gracefully. */
export async function research(query: string, market: LegacyDexPair[]): Promise<ResearchResult> {
  if (!isConfigured()) {
    return { ok: false, reason: "not_configured", message: "OPENAI_API_KEY is not set." };
  }
  const model = process.env.OPENAI_MODEL || DEFAULT_MODEL;
  let raw: string;
  try {
    raw = await callModel(query, market, model);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[openai] research failed: ${message}`);
    return { ok: false, reason: "api_error", message };
  }
  const report = parseReport(raw);
  if (!report) {
    return { ok: false, reason: "bad_format", message: "The model did not return valid JSON." };
  }
  return { ok: true, report, raw, model };
}

/** Free-text analysis, as the original /api/analyze route has always used it. */
export async function runAgent(query: string, market: LegacyDexPair[]): Promise<string> {
  if (!isConfigured()) throw new Error("OPENAI_API_KEY is not configured.");
  return callModel(query, market, process.env.OPENAI_MODEL || DEFAULT_MODEL);
}
