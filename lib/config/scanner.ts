/**
 * Every threshold and weight the scanner uses, in one place.
 *
 * Nothing here is optimized. These are starting values, and the point of
 * storing every score alongside its weights version is to find out later
 * which of them were wrong.
 */

export const WEIGHTS_VERSION = "v1";

/** Rejects the obvious garbage before anything expensive runs. */
export type ScannerFilters = {
  minLiquidityUsd: number;
  maxLiquidityUsd: number | null;
  minVolumeH24Usd: number;
  minTxnsH24: number;
  minBuysH1: number;
  minMarketCapUsd: number;
  maxMarketCapUsd: number | null;
  maxPairAgeHours: number;
  minPairAgeMinutes: number;
  /** Liquidity must be at least this share of market cap. */
  minLiquidityToMcap: number;
  /** 24h volume above this multiple of liquidity looks like wash trading. */
  maxVolumeToLiquidity: number;
  /** Below this share of buys in 1h the flow is one-directional selling. */
  minBuyRatioH1: number;
  /** Tickers we never want to see. */
  blockedSymbols: string[];
};

export const DEFAULT_FILTERS: ScannerFilters = {
  minLiquidityUsd: 15_000,
  maxLiquidityUsd: null,
  minVolumeH24Usd: 25_000,
  minTxnsH24: 100,
  minBuysH1: 5,
  minMarketCapUsd: 30_000,
  maxMarketCapUsd: 50_000_000,
  maxPairAgeHours: 24 * 14,
  minPairAgeMinutes: 10,
  minLiquidityToMcap: 0.02,
  maxVolumeToLiquidity: 60,
  minBuyRatioH1: 0.25,
  blockedSymbols: [],
};

/** Maximum points each category can contribute. They add up to 100. */
export const SCORE_WEIGHTS = {
  marketStructure: 25,
  momentum: 20,
  liquidity: 15,
  social: 15,
  onchain: 15,
  catalyst: 10,
} as const;

/**
 * Categories with no data source yet (social, on-chain, catalyst arrive in
 * later phases). Their points are left unawarded rather than guessed, and the
 * score is renormalised over the categories we can actually measure — so a
 * Phase 1 score of 70 is not silently capped at 60.
 */
export const RENORMALISE_OVER_AVAILABLE = true;

/** How risk is turned into a deduction from the score. */
export const RISK_PENALTY = {
  /** Points removed at riskScore = 100. */
  maxPenalty: 40,
  /** Risk below this is treated as noise. */
  ignoreBelow: 15,
  /** A single critical flag alone costs this many points. */
  criticalFlagPenalty: 25,
};

/** What counts as worth surfacing, and what the paper engine may act on. */
export const THRESHOLDS = {
  /** Shown on /opportunities. */
  opportunity: 65,
  /** A paper trade may be opened (Phase 2). */
  paperTrade: 75,
  /** Only above this does a token go to the AI, which costs money. */
  aiResearch: 70,
  /** Above this risk score nothing is surfaced, whatever the score. */
  maxRiskScore: 80,
};

/** Keeps a scan inside serverless limits and inside provider rate limits. */
export const SCAN_LIMITS = {
  /** Candidates pulled from discovery before filtering. */
  maxDiscovered: 300,
  /** Tokens that may go through enrichment in one run. */
  maxEnriched: 60,
  /** Tokens that may be sent to the AI in one run. */
  maxAiResearch: 5,
  /** Hard stop so a serverless function never runs past its limit. */
  maxRunMs: 50_000,
};

/**
 * Search terms used to discover tokens through DexScreener's public search.
 * Not elegant, but it needs no API key and returns live Solana pairs.
 */
export const DISCOVERY_QUERIES = ["SOL", "pump", "WSOL", "USDC", "bonk"];

export type ScannerConfig = {
  filters: ScannerFilters;
  weights: typeof SCORE_WEIGHTS;
  thresholds: typeof THRESHOLDS;
  limits: typeof SCAN_LIMITS;
  weightsVersion: string;
};

export function getScannerConfig(): ScannerConfig {
  return {
    filters: DEFAULT_FILTERS,
    weights: SCORE_WEIGHTS,
    thresholds: THRESHOLDS,
    limits: SCAN_LIMITS,
    weightsVersion: WEIGHTS_VERSION,
  };
}
