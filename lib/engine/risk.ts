/**
 * Deterministic risk checks, run before any AI sees the token.
 *
 * Phase 1 works from market data alone. The checks that need on-chain access —
 * mint and freeze authority, holder concentration, dev wallet behaviour, LP
 * lock status — are declared as unavailable rather than guessed, so the gap is
 * visible in the UI instead of reading as "no risk found". Phase 3 fills them.
 */
import type { MarketSnapshot, RiskAssessment, RiskFlag, Token } from "../types";

/** Checks that need a provider we do not have yet. */
export const ONCHAIN_CHECKS = [
  "MINT_AUTHORITY_ACTIVE",
  "FREEZE_AUTHORITY_ACTIVE",
  "HIGH_HOLDER_CONCENTRATION",
  "DEV_WALLET_HOLDINGS",
  "DEV_WALLET_SELLING",
  "LP_NOT_BURNED_OR_LOCKED",
  "SNIPER_CLUSTER",
  "HONEYPOT_TRANSFER_RESTRICTION",
];

const SEVERITY_WEIGHT = { low: 5, medium: 12, high: 22, critical: 35 } as const;

export function assessRisk(token: Token, m: MarketSnapshot): RiskAssessment {
  const flags: RiskFlag[] = [];
  const add = (code: string, severity: RiskFlag["severity"], description: string) =>
    flags.push({ code, severity, description });

  if (m.liquidityUsd !== null) {
    if (m.liquidityUsd < 5_000) {
      add("CRITICAL_LOW_LIQUIDITY", "critical",
        `Only $${Math.round(m.liquidityUsd).toLocaleString("en-US")} of liquidity — an exit moves the price against you.`);
    } else if (m.liquidityUsd < 20_000) {
      add("LOW_LIQUIDITY", "high",
        `$${Math.round(m.liquidityUsd).toLocaleString("en-US")} of liquidity is thin for anything but a small position.`);
    }
  }

  if (m.liquidityToMcap !== null && m.liquidityToMcap < 0.03) {
    add("THIN_RELATIVE_LIQUIDITY", "high",
      `Liquidity is ${(m.liquidityToMcap * 100).toFixed(1)}% of market cap. Most of the notional value cannot be sold.`);
  }

  if (m.volumeToLiquidity !== null && m.volumeToLiquidity > 30) {
    add("SUSPICIOUS_TURNOVER", m.volumeToLiquidity > 80 ? "critical" : "high",
      `24h volume is ${m.volumeToLiquidity.toFixed(0)}x the pool. That pattern is consistent with wash trading.`);
  }

  if (m.pairAgeHours !== null) {
    if (m.pairAgeHours < 1) {
      add("EXTREMELY_YOUNG", "high", `The pair is ${Math.round(m.pairAgeHours * 60)} minutes old. Almost nothing about it is established.`);
    } else if (m.pairAgeHours < 24) {
      add("YOUNG_PAIR", "medium", `The pair is ${m.pairAgeHours.toFixed(1)} hours old.`);
    }
  }

  if (m.buyRatioH1 !== null && m.buyRatioH1 < 0.35 && (m.txnsH1 ?? 0) >= 20) {
    add("SELL_IMBALANCE", "high",
      `Only ${(m.buyRatioH1 * 100).toFixed(0)}% of the last hour's trades were buys — holders are leaving.`);
  }

  if (m.changeH1Pct !== null && m.changeH1Pct > 300) {
    add("VERTICAL_PRICE_SPIKE", "high",
      `Up ${m.changeH1Pct.toFixed(0)}% in an hour. Entering after a move like this means buying someone else's exit.`);
  }
  if (m.changeH24Pct !== null && m.changeH24Pct < -70) {
    add("COLLAPSING", "high", `Down ${Math.abs(m.changeH24Pct).toFixed(0)}% over 24h.`);
  }

  if (m.marketCap !== null && m.liquidityUsd !== null && m.marketCap > 5_000_000 && m.liquidityUsd < 50_000) {
    add("MCAP_LIQUIDITY_MISMATCH", "critical",
      "A multi-million market cap resting on a very small pool. The quoted valuation is not realisable.");
  }

  if (!token.website && !token.twitter && !token.telegram) {
    add("NO_PUBLIC_PRESENCE", "low", "No website, X account or Telegram advertised on the listing.");
  }

  if (token.symbol && /^[A-Z0-9]{1,2}$/.test(token.symbol)) {
    add("SUSPICIOUS_TICKER", "low", `Ticker "${token.symbol}" is short enough to be impersonating something else.`);
  }

  // Score: severity-weighted, saturating, so five medium flags cannot
  // out-weigh one critical one.
  const raw = flags.reduce((sum, f) => sum + SEVERITY_WEIGHT[f.severity], 0);
  const hasCritical = flags.some((f) => f.severity === "critical");
  let riskScore = Math.min(100, Math.round(raw));
  if (hasCritical) riskScore = Math.max(riskScore, 70);

  // Absent data is itself a risk, just a much smaller one than a found problem.
  const unavailable = [...ONCHAIN_CHECKS];
  if (m.liquidityUsd === null) unavailable.push("LIQUIDITY_UNKNOWN");
  if (m.marketCap === null) unavailable.push("MARKET_CAP_UNKNOWN");

  return {
    tokenId: token.id,
    assessedAt: new Date().toISOString(),
    riskScore,
    flags,
    unavailableChecks: unavailable,
  };
}
