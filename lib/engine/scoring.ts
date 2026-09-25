/**
 * Opportunity scoring.
 *
 * The number this produces is a research ranking, not a probability of profit.
 * Its only real purpose is to be testable: every score is stored with its
 * components and the weights version that produced it, so that once enough
 * paper trades have closed we can ask whether 85s actually did better than 65s.
 *
 * Categories with no data source in this phase (social, on-chain, catalyst)
 * award no points and are listed in `missingInputs`. The total is then
 * renormalised over the categories we could measure, so a Phase 1 score is
 * comparable with itself rather than silently capped.
 */
import { RENORMALISE_OVER_AVAILABLE, RISK_PENALTY, SCORE_WEIGHTS, WEIGHTS_VERSION } from "../config/scanner";
import type { MarketSnapshot, RiskAssessment, Score, ScoreComponents, Token } from "../types";

/** Maps a value onto 0..1 with a floor and a ceiling. */
function band(v: number | null, lo: number, hi: number): number | null {
  if (v === null) return null;
  if (hi === lo) return 0;
  return Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
}

/** Rewards being near `ideal` and falls off in both directions. */
function peak(v: number | null, ideal: number, tolerance: number): number | null {
  if (v === null) return null;
  return Math.max(0, 1 - Math.abs(v - ideal) / tolerance);
}

function avg(parts: (number | null)[]): number | null {
  const known = parts.filter((p): p is number => p !== null);
  if (!known.length) return null;
  return known.reduce((a, b) => a + b, 0) / known.length;
}

export function scoreToken(
  token: Token,
  m: MarketSnapshot,
  risk: RiskAssessment,
): Score {
  const missing: string[] = [];

  // ── Market structure: is this a real, tradeable market? ──
  const marketStructure01 = avg([
    band(m.marketCap, 30_000, 3_000_000),
    band(m.txnsH24, 100, 3_000),
    // A pair between a few hours and a few days old: past the launch chaos,
    // not yet forgotten.
    peak(m.pairAgeHours, 36, 120),
  ]);
  if (marketStructure01 === null) missing.push("marketStructure");

  // ── Momentum: is attention arriving now? ──
  const momentum01 = avg([
    band(m.changeH1Pct, 0, 60),
    band(m.changeH6Pct, 0, 150),
    // Recent volume outpacing the daily average means it is heating up.
    m.volumeH1 !== null && m.volumeH24 !== null && m.volumeH24 > 0
      ? band((m.volumeH1 * 24) / m.volumeH24, 0.8, 4)
      : null,
    band(m.buyRatioH1, 0.45, 0.7),
  ]);
  if (momentum01 === null) missing.push("momentum");

  // ── Liquidity quality: could a position actually be exited? ──
  const liquidity01 = avg([
    band(m.liquidityUsd, 15_000, 400_000),
    band(m.liquidityToMcap, 0.02, 0.25),
    // Healthy turnover, not wash trading.
    peak(m.volumeToLiquidity, 6, 25),
  ]);
  if (liquidity01 === null) missing.push("liquidity");

  // ── Not measurable yet ──
  missing.push("social", "onchain", "catalyst");

  const components: ScoreComponents = {
    marketStructure: (marketStructure01 ?? 0) * SCORE_WEIGHTS.marketStructure,
    momentum: (momentum01 ?? 0) * SCORE_WEIGHTS.momentum,
    liquidity: (liquidity01 ?? 0) * SCORE_WEIGHTS.liquidity,
    social: 0,
    onchain: 0,
    catalyst: 0,
    riskPenalty: 0,
  };

  const availableWeight =
    (marketStructure01 !== null ? SCORE_WEIGHTS.marketStructure : 0) +
    (momentum01 !== null ? SCORE_WEIGHTS.momentum : 0) +
    (liquidity01 !== null ? SCORE_WEIGHTS.liquidity : 0);

  const earned = components.marketStructure + components.momentum + components.liquidity;
  let base = 0;
  if (availableWeight > 0) {
    base = RENORMALISE_OVER_AVAILABLE ? (earned / availableWeight) * 100 : earned;
  }

  // ── Risk deduction ──
  let penalty = 0;
  if (risk.riskScore > RISK_PENALTY.ignoreBelow) {
    const over = (risk.riskScore - RISK_PENALTY.ignoreBelow) / (100 - RISK_PENALTY.ignoreBelow);
    penalty = over * RISK_PENALTY.maxPenalty;
  }
  if (risk.flags.some((f) => f.severity === "critical")) {
    penalty = Math.max(penalty, RISK_PENALTY.criticalFlagPenalty);
  }
  components.riskPenalty = Math.round(penalty * 10) / 10;

  const overall = Math.max(0, Math.min(100, Math.round(base - penalty)));

  return {
    tokenId: token.id,
    scoredAt: new Date().toISOString(),
    overallScore: overall,
    components: {
      marketStructure: Math.round(components.marketStructure * 10) / 10,
      momentum: Math.round(components.momentum * 10) / 10,
      liquidity: Math.round(components.liquidity * 10) / 10,
      social: 0,
      onchain: 0,
      catalyst: 0,
      riskPenalty: components.riskPenalty,
    },
    missingInputs: missing,
    weightsVersion: WEIGHTS_VERSION,
  };
}
