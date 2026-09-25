/**
 * In-memory store for running without Supabase.
 *
 * Module-level state, so it survives between requests on a warm serverless
 * instance and vanishes with it. Good enough to make the dashboard useful on a
 * first deploy; not a database, and the UI says so.
 */
import type {
  MarketSnapshot,
  RiskAssessment,
  ScanRunReport,
  Score,
  Token,
  TokenView,
} from "../types";
import type { Store } from "./index";

type Row = {
  token: Token;
  market: MarketSnapshot | null;
  risk: RiskAssessment | null;
  score: Score | null;
  scores: Score[];
  snapshots: MarketSnapshot[];
};

const MAX_TOKENS = 2_000;
const MAX_SERIES = 50;

const tokens = new Map<string, Row>();
let lastRun: ScanRunReport | null = null;

function row(id: string): Row | undefined {
  return tokens.get(id);
}

export function memoryStore(): Store {
  return {
    mode: "memory",

    async upsertToken(token) {
      const existing = tokens.get(token.id);
      if (existing) {
        // Keep the original discovery time — when we first saw it matters.
        existing.token = { ...token, discoveredAt: existing.token.discoveredAt,
                           discoverySource: existing.token.discoverySource };
        return;
      }
      if (tokens.size >= MAX_TOKENS) {
        const oldest = tokens.keys().next().value;
        if (oldest) tokens.delete(oldest);
      }
      tokens.set(token.id, { token, market: null, risk: null, score: null, scores: [], snapshots: [] });
    },

    async saveMarketSnapshot(snapshot) {
      const r = row(snapshot.tokenId);
      if (!r) return;
      r.market = snapshot;
      r.snapshots.push(snapshot);
      if (r.snapshots.length > MAX_SERIES) r.snapshots.shift();
    },

    async saveRisk(risk) {
      const r = row(risk.tokenId);
      if (r) r.risk = risk;
    },

    async saveScore(score) {
      const r = row(score.tokenId);
      if (!r) return;
      r.score = score;
      r.scores.push(score);
      if (r.scores.length > MAX_SERIES) r.scores.shift();
    },

    async saveScanRun(run) {
      lastRun = run;
    },

    async listTokens(opts) {
      const min = opts?.minScore ?? 0;
      const out = [...tokens.values()]
        .filter((r) => (r.score?.overallScore ?? -1) >= min)
        .map<TokenView>((r) => ({ token: r.token, market: r.market, risk: r.risk, score: r.score }))
        .sort((a, b) => (b.score?.overallScore ?? 0) - (a.score?.overallScore ?? 0));
      return opts?.limit ? out.slice(0, opts.limit) : out;
    },

    async getToken(tokenId) {
      const r = row(tokenId);
      return r ? { token: r.token, market: r.market, risk: r.risk, score: r.score } : null;
    },

    async getScoreHistory(tokenId) {
      return row(tokenId)?.scores ?? [];
    },

    async latestScanRun() {
      return lastRun;
    },

    async countTokensSince(iso) {
      const since = Date.parse(iso);
      return [...tokens.values()].filter((r) => Date.parse(r.token.discoveredAt) >= since).length;
    },
  };
}
