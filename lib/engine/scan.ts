/**
 * One scanner run.
 *
 * The whole point of the pipeline is cost control: a thousand candidates in,
 * a handful out, and the expensive steps only ever see the survivors.
 *
 *   discover → dedupe → cheap filters → risk → score → opportunities
 *
 * The run is idempotent. Re-running it produces new snapshots and scores for
 * the same tokens, which is intended — that series is the dataset — but never
 * duplicate token rows.
 */
import { getScannerConfig } from "../config/scanner";
import { DISCOVERY_QUERIES } from "../config/scanner";
import * as dex from "../providers/dexscreener";
import { getStore } from "../db";
import { applyFilters } from "./filters";
import { assessRisk } from "./risk";
import { scoreToken } from "./scoring";
import type { FilterRejection, ScanRunReport } from "../types";

function runId(): string {
  return `scan_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Collect candidates from every discovery source, de-duplicated by contract.
 * A source that fails is recorded and skipped — never fatal.
 */
async function discover(errors: string[], max: number): Promise<dex.DexPair[]> {
  const found = new Map<string, dex.DexPair>();

  const add = (pairs: dex.DexPair[]) => {
    for (const p of pairs) {
      const existing = found.get(p.token.id);
      // Several pools can exist per token; keep the deepest one.
      if (!existing || (p.market.liquidityUsd ?? 0) > (existing.market.liquidityUsd ?? 0)) {
        found.set(p.token.id, p);
      }
    }
  };

  for (const q of DISCOVERY_QUERIES) {
    if (found.size >= max) break;
    try {
      add(await dex.search(q, 30));
    } catch (e) {
      errors.push(`discovery search "${q}": ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Tokens actively buying attention — a live pool worth looking at, not a
  // quality signal in itself.
  try {
    const addresses = [...new Set([...(await dex.boosted()), ...(await dex.profiles())])].slice(0, 25);
    for (const address of addresses) {
      if (found.size >= max) break;
      try {
        const pairs = await dex.byContract(address);
        add(pairs.slice(0, 1));
      } catch {
        // one dead address must not stop the sweep
      }
    }
  } catch (e) {
    errors.push(`discovery boosted/profiles: ${e instanceof Error ? e.message : String(e)}`);
  }

  return [...found.values()].slice(0, max);
}

export async function runScan(): Promise<ScanRunReport> {
  const cfg = getScannerConfig();
  const store = getStore();
  const startedAt = new Date();
  const deadline = startedAt.getTime() + cfg.limits.maxRunMs;
  const errors: string[] = [];
  const rejections: FilterRejection[] = [];

  const candidates = await discover(errors, cfg.limits.maxDiscovered);

  let enriched = 0;
  let scored = 0;
  let opportunities = 0;

  for (const { token, market } of candidates) {
    if (Date.now() > deadline) {
      errors.push("run stopped at the time limit — remaining candidates deferred to the next scan");
      break;
    }
    if (enriched >= cfg.limits.maxEnriched) break;

    const verdict = applyFilters(token, market, cfg.filters);
    if (!verdict.pass) {
      rejections.push({ tokenId: token.id, ...verdict.rejection });
      continue;
    }

    try {
      await store.upsertToken(token);
      await store.saveMarketSnapshot(market);
      enriched++;

      const risk = assessRisk(token, market);
      await store.saveRisk(risk);

      const score = scoreToken(token, market, risk);
      await store.saveScore(score);
      scored++;

      if (
        score.overallScore >= cfg.thresholds.opportunity &&
        risk.riskScore <= cfg.thresholds.maxRiskScore
      ) {
        opportunities++;
      }
    } catch (e) {
      errors.push(`${token.symbol ?? token.contract}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const finishedAt = new Date();
  const report: ScanRunReport = {
    id: runId(),
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    discovered: candidates.length,
    deduplicated: candidates.length,
    rejectedByFilters: rejections.length,
    rejections: rejections.slice(0, 50),
    enriched,
    scored,
    opportunities,
    aiResearched: 0, // Phase 5
    paperTradesOpened: 0, // Phase 2
    errors,
    storageMode: store.mode,
  };

  await store.saveScanRun(report);

  console.info(
    `[scan] ${report.id} discovered=${report.discovered} rejected=${report.rejectedByFilters} ` +
      `enriched=${report.enriched} scored=${report.scored} opportunities=${report.opportunities} ` +
      `errors=${report.errors.length} in ${report.durationMs}ms (storage=${report.storageMode})`,
  );

  return report;
}
