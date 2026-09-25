/**
 * Deterministic pre-filter.
 *
 * This runs before anything expensive. Its job is to throw away the obvious
 * garbage cheaply, so that on-chain lookups and the AI only ever see a handful
 * of candidates.
 *
 * A missing value never rejects a token. We cannot tell a token with no
 * liquidity from a token whose liquidity we failed to read, and rejecting on
 * that would quietly bias the dataset.
 */
import type { ScannerFilters } from "../config/scanner";
import type { FilterRejection, MarketSnapshot, Token } from "../types";

export type FilterResult =
  | { pass: true }
  | { pass: false; rejection: Omit<FilterRejection, "tokenId"> };

function fmt(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function applyFilters(
  token: Token,
  m: MarketSnapshot,
  f: ScannerFilters,
): FilterResult {
  const reject = (rule: string, detail: string): FilterResult => ({
    pass: false,
    rejection: { rule, detail },
  });

  if (token.symbol && f.blockedSymbols.includes(token.symbol.toUpperCase())) {
    return reject("BLOCKED_SYMBOL", `${token.symbol} is on the block list`);
  }
  if (m.liquidityUsd !== null && m.liquidityUsd < f.minLiquidityUsd) {
    return reject("LOW_LIQUIDITY", `$${fmt(m.liquidityUsd)} < $${fmt(f.minLiquidityUsd)}`);
  }
  if (f.maxLiquidityUsd !== null && m.liquidityUsd !== null && m.liquidityUsd > f.maxLiquidityUsd) {
    return reject("LIQUIDITY_TOO_HIGH", `$${fmt(m.liquidityUsd)} > $${fmt(f.maxLiquidityUsd)}`);
  }
  if (m.volumeH24 !== null && m.volumeH24 < f.minVolumeH24Usd) {
    return reject("LOW_VOLUME", `$${fmt(m.volumeH24)} 24h < $${fmt(f.minVolumeH24Usd)}`);
  }
  if (m.txnsH24 !== null && m.txnsH24 < f.minTxnsH24) {
    return reject("FEW_TRANSACTIONS", `${m.txnsH24} in 24h < ${f.minTxnsH24}`);
  }
  if (m.buysH1 !== null && m.buysH1 < f.minBuysH1) {
    return reject("FEW_BUYS", `${m.buysH1} buys in 1h < ${f.minBuysH1}`);
  }
  if (m.marketCap !== null && m.marketCap < f.minMarketCapUsd) {
    return reject("MCAP_TOO_LOW", `$${fmt(m.marketCap)} < $${fmt(f.minMarketCapUsd)}`);
  }
  if (f.maxMarketCapUsd !== null && m.marketCap !== null && m.marketCap > f.maxMarketCapUsd) {
    return reject("MCAP_TOO_HIGH", `$${fmt(m.marketCap)} > $${fmt(f.maxMarketCapUsd)}`);
  }
  if (m.pairAgeHours !== null && m.pairAgeHours > f.maxPairAgeHours) {
    return reject("TOO_OLD", `${fmt(m.pairAgeHours)}h > ${f.maxPairAgeHours}h`);
  }
  if (m.pairAgeHours !== null && m.pairAgeHours * 60 < f.minPairAgeMinutes) {
    return reject("TOO_YOUNG", `${fmt(m.pairAgeHours * 60)}min < ${f.minPairAgeMinutes}min`);
  }
  if (m.liquidityToMcap !== null && m.liquidityToMcap < f.minLiquidityToMcap) {
    return reject(
      "THIN_RELATIVE_LIQUIDITY",
      `liquidity is ${(m.liquidityToMcap * 100).toFixed(1)}% of mcap < ${(f.minLiquidityToMcap * 100).toFixed(1)}%`,
    );
  }
  if (m.volumeToLiquidity !== null && m.volumeToLiquidity > f.maxVolumeToLiquidity) {
    return reject(
      "IMPLAUSIBLE_TURNOVER",
      `24h volume is ${fmt(m.volumeToLiquidity)}x liquidity > ${f.maxVolumeToLiquidity}x`,
    );
  }
  if (m.buyRatioH1 !== null && m.buyRatioH1 < f.minBuyRatioH1) {
    return reject(
      "SELL_PRESSURE",
      `only ${(m.buyRatioH1 * 100).toFixed(0)}% of 1h trades are buys < ${(f.minBuyRatioH1 * 100).toFixed(0)}%`,
    );
  }
  return { pass: true };
}
