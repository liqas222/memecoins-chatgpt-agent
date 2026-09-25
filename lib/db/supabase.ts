/**
 * Supabase-backed store.
 *
 * Snapshots, risk assessments and scores are append-only: we want to know what
 * the system believed at the moment it believed it, not just its latest
 * opinion. Only the `tokens` row is updated in place.
 *
 * A failed write is logged and swallowed. Losing a snapshot is bad; taking the
 * whole scanner down because one insert failed is worse.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  MarketSnapshot,
  RiskAssessment,
  ScanRunReport,
  Score,
  Token,
  TokenView,
} from "../types";
import type { Store } from "./index";

/* eslint-disable @typescript-eslint/no-explicit-any */

function warn(what: string, error: unknown) {
  const msg = error instanceof Error ? error.message : String(error);
  console.error(`[store] ${what} failed: ${msg}`);
}

function toToken(r: any): Token {
  return {
    id: r.id,
    chain: r.chain,
    contract: r.contract,
    symbol: r.symbol,
    name: r.name,
    pairAddress: r.pair_address,
    dex: r.dex,
    pairCreatedAt: r.pair_created_at,
    discoveredAt: r.discovered_at,
    discoverySource: r.discovery_source,
    imageUrl: r.image_url,
    website: r.website,
    twitter: r.twitter,
    telegram: r.telegram,
  };
}

function toMarket(r: any): MarketSnapshot | null {
  if (!r) return null;
  return {
    tokenId: r.token_id,
    capturedAt: r.captured_at,
    source: r.source,
    priceUsd: r.price_usd,
    marketCap: r.market_cap,
    fdv: r.fdv,
    liquidityUsd: r.liquidity_usd,
    volumeM5: r.volume_m5,
    volumeH1: r.volume_h1,
    volumeH6: r.volume_h6,
    volumeH24: r.volume_h24,
    changeM5Pct: r.change_m5_pct,
    changeH1Pct: r.change_h1_pct,
    changeH6Pct: r.change_h6_pct,
    changeH24Pct: r.change_h24_pct,
    buysH1: r.buys_h1,
    sellsH1: r.sells_h1,
    buysH24: r.buys_h24,
    sellsH24: r.sells_h24,
    txnsH1: r.txns_h1,
    txnsH24: r.txns_h24,
    pairAgeHours: r.pair_age_hours,
    volumeToLiquidity: r.volume_to_liquidity,
    liquidityToMcap: r.liquidity_to_mcap,
    buyRatioH1: r.buy_ratio_h1,
  };
}

function toRisk(r: any): RiskAssessment | null {
  if (!r) return null;
  return {
    tokenId: r.token_id,
    assessedAt: r.assessed_at,
    riskScore: r.risk_score,
    flags: r.flags ?? [],
    unavailableChecks: r.unavailable_checks ?? [],
  };
}

function toScore(r: any): Score | null {
  if (!r) return null;
  return {
    tokenId: r.token_id,
    scoredAt: r.scored_at,
    overallScore: r.overall_score,
    components: r.components,
    missingInputs: r.missing_inputs ?? [],
    weightsVersion: r.weights_version,
  };
}

export function supabaseStore(db: SupabaseClient): Store {
  /** Latest row per token from an append-only table, in one query. */
  async function latestBy<T>(
    table: string,
    tokenIds: string[],
    orderColumn: string,
    map: (r: any) => T | null,
  ): Promise<Map<string, T>> {
    const out = new Map<string, T>();
    if (!tokenIds.length) return out;
    const { data, error } = await db
      .from(table)
      .select("*")
      .in("token_id", tokenIds)
      .order(orderColumn, { ascending: false });
    if (error) {
      warn(`read ${table}`, error);
      return out;
    }
    for (const r of data ?? []) {
      if (!out.has(r.token_id)) {
        const mapped = map(r);
        if (mapped) out.set(r.token_id, mapped);
      }
    }
    return out;
  }

  async function assemble(tokenRows: any[]): Promise<TokenView[]> {
    const ids = tokenRows.map((r) => r.id);
    const [markets, risks, scores] = await Promise.all([
      latestBy("token_snapshots", ids, "captured_at", toMarket),
      latestBy("risk_assessments", ids, "assessed_at", toRisk),
      latestBy("score_history", ids, "scored_at", toScore),
    ]);
    return tokenRows.map((r) => ({
      token: toToken(r),
      market: markets.get(r.id) ?? null,
      risk: risks.get(r.id) ?? null,
      score: scores.get(r.id) ?? null,
    }));
  }

  return {
    mode: "supabase",

    async upsertToken(t) {
      const { error } = await db.from("tokens").upsert(
        {
          id: t.id,
          chain: t.chain,
          contract: t.contract,
          symbol: t.symbol,
          name: t.name,
          pair_address: t.pairAddress,
          dex: t.dex,
          pair_created_at: t.pairCreatedAt,
          discovered_at: t.discoveredAt,
          discovery_source: t.discoverySource,
          image_url: t.imageUrl,
          website: t.website,
          twitter: t.twitter,
          telegram: t.telegram,
        },
        // discovered_at must survive: when we first saw a token is data.
        { onConflict: "id", ignoreDuplicates: false },
      );
      if (error) warn("upsert token", error);
    },

    async saveMarketSnapshot(m) {
      const { error } = await db.from("token_snapshots").insert({
        token_id: m.tokenId,
        captured_at: m.capturedAt,
        source: m.source,
        price_usd: m.priceUsd,
        market_cap: m.marketCap,
        fdv: m.fdv,
        liquidity_usd: m.liquidityUsd,
        volume_m5: m.volumeM5,
        volume_h1: m.volumeH1,
        volume_h6: m.volumeH6,
        volume_h24: m.volumeH24,
        change_m5_pct: m.changeM5Pct,
        change_h1_pct: m.changeH1Pct,
        change_h6_pct: m.changeH6Pct,
        change_h24_pct: m.changeH24Pct,
        buys_h1: m.buysH1,
        sells_h1: m.sellsH1,
        buys_h24: m.buysH24,
        sells_h24: m.sellsH24,
        txns_h1: m.txnsH1,
        txns_h24: m.txnsH24,
        pair_age_hours: m.pairAgeHours,
        volume_to_liquidity: m.volumeToLiquidity,
        liquidity_to_mcap: m.liquidityToMcap,
        buy_ratio_h1: m.buyRatioH1,
      });
      if (error) warn("insert snapshot", error);
    },

    async saveRisk(r) {
      const { error } = await db.from("risk_assessments").insert({
        token_id: r.tokenId,
        assessed_at: r.assessedAt,
        risk_score: r.riskScore,
        flags: r.flags,
        unavailable_checks: r.unavailableChecks,
      });
      if (error) warn("insert risk", error);
    },

    async saveScore(s) {
      const { error } = await db.from("score_history").insert({
        token_id: s.tokenId,
        scored_at: s.scoredAt,
        overall_score: s.overallScore,
        components: s.components,
        missing_inputs: s.missingInputs,
        weights_version: s.weightsVersion,
      });
      if (error) warn("insert score", error);
    },

    async saveScanRun(run) {
      const { error } = await db.from("scanner_runs").insert({
        id: run.id,
        started_at: run.startedAt,
        finished_at: run.finishedAt,
        duration_ms: run.durationMs,
        discovered: run.discovered,
        deduplicated: run.deduplicated,
        rejected_by_filters: run.rejectedByFilters,
        enriched: run.enriched,
        scored: run.scored,
        opportunities: run.opportunities,
        ai_researched: run.aiResearched,
        paper_trades_opened: run.paperTradesOpened,
        errors: run.errors,
        storage_mode: run.storageMode,
      });
      if (error) warn("insert scan run", error);
    },

    async listTokens(opts) {
      const limit = opts?.limit ?? 200;
      const { data, error } = await db
        .from("tokens")
        .select("*")
        .order("discovered_at", { ascending: false })
        .limit(Math.min(limit * 3, 600));
      if (error) {
        warn("list tokens", error);
        return [];
      }
      const views = await assemble(data ?? []);
      const min = opts?.minScore ?? 0;
      return views
        .filter((v) => (v.score?.overallScore ?? -1) >= min)
        .sort((a, b) => (b.score?.overallScore ?? 0) - (a.score?.overallScore ?? 0))
        .slice(0, limit);
    },

    async getToken(tokenId) {
      const { data, error } = await db.from("tokens").select("*").eq("id", tokenId).maybeSingle();
      if (error || !data) {
        if (error) warn("get token", error);
        return null;
      }
      return (await assemble([data]))[0] ?? null;
    },

    async getScoreHistory(tokenId) {
      const { data, error } = await db
        .from("score_history")
        .select("*")
        .eq("token_id", tokenId)
        .order("scored_at", { ascending: true })
        .limit(200);
      if (error) {
        warn("score history", error);
        return [];
      }
      return (data ?? []).map(toScore).filter((s): s is Score => s !== null);
    },

    async latestScanRun() {
      const { data, error } = await db
        .from("scanner_runs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error || !data) return null;
      return {
        id: data.id,
        startedAt: data.started_at,
        finishedAt: data.finished_at,
        durationMs: data.duration_ms,
        discovered: data.discovered,
        deduplicated: data.deduplicated,
        rejectedByFilters: data.rejected_by_filters,
        rejections: [],
        enriched: data.enriched,
        scored: data.scored,
        opportunities: data.opportunities,
        aiResearched: data.ai_researched,
        paperTradesOpened: data.paper_trades_opened,
        errors: data.errors ?? [],
        storageMode: data.storage_mode,
      };
    },

    async countTokensSince(iso) {
      const { count, error } = await db
        .from("tokens")
        .select("id", { count: "exact", head: true })
        .gte("discovered_at", iso);
      if (error) {
        warn("count tokens", error);
        return 0;
      }
      return count ?? 0;
    },
  };
}
