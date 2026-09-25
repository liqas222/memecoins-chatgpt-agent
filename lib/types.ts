/**
 * Shared shapes for the whole scanner.
 *
 * Two rules run through all of this:
 * - Missing data is `null`, never `0`. A token with no holder count is not a
 *   token with zero holders, and the scoring must be able to tell them apart.
 * - Every value that came from outside carries where it came from and when.
 */

export type Chain = "solana";

/** Whether a piece of data can still be trusted. */
export type Freshness = "live" | "stale" | "missing";

export type Sourced<T> = {
  value: T | null;
  source: string;
  fetchedAt: string; // ISO
  freshness: Freshness;
};

export type DiscoverySource =
  | "dexscreener:search"
  | "dexscreener:boosted"
  | "dexscreener:profiles"
  | "pumpfun:new"
  | "pumpfun:migrating"
  | "manual";

/** A token we have seen. Identity is chain + contract address. */
export type Token = {
  id: string; // `${chain}:${contract}`
  chain: Chain;
  contract: string;
  symbol: string | null;
  name: string | null;
  pairAddress: string | null;
  dex: string | null;
  pairCreatedAt: string | null; // ISO
  discoveredAt: string; // ISO
  discoverySource: DiscoverySource;
  imageUrl: string | null;
  website: string | null;
  twitter: string | null;
  telegram: string | null;
};

/** One point in time of a token's market. Stored as a series, never overwritten. */
export type MarketSnapshot = {
  tokenId: string;
  capturedAt: string; // ISO
  source: string;
  priceUsd: number | null;
  marketCap: number | null;
  fdv: number | null;
  liquidityUsd: number | null;
  volumeM5: number | null;
  volumeH1: number | null;
  volumeH6: number | null;
  volumeH24: number | null;
  changeM5Pct: number | null;
  changeH1Pct: number | null;
  changeH6Pct: number | null;
  changeH24Pct: number | null;
  buysH1: number | null;
  sellsH1: number | null;
  buysH24: number | null;
  sellsH24: number | null;
  txnsH1: number | null;
  txnsH24: number | null;
  pairAgeHours: number | null;
  /** volume 24h / liquidity — how hard the pool is being turned over */
  volumeToLiquidity: number | null;
  /** liquidity / market cap — how much of the value can actually be exited */
  liquidityToMcap: number | null;
  /** buys / (buys + sells) over 1h, 0..1 */
  buyRatioH1: number | null;
};

export type RiskSeverity = "low" | "medium" | "high" | "critical";

export type RiskFlag = {
  code: string;
  severity: RiskSeverity;
  description: string;
};

export type RiskAssessment = {
  tokenId: string;
  assessedAt: string;
  /** 0 = little detected structural risk, 100 = extreme */
  riskScore: number;
  flags: RiskFlag[];
  /** Checks we could not run because the data was missing. */
  unavailableChecks: string[];
};

export type ScoreComponents = {
  marketStructure: number;
  momentum: number;
  liquidity: number;
  social: number;
  onchain: number;
  catalyst: number;
  riskPenalty: number;
};

export type Score = {
  tokenId: string;
  scoredAt: string;
  /** Internal research ranking, 0-100. NOT a probability of profit. */
  overallScore: number;
  components: ScoreComponents;
  /** Which component inputs were missing, so a score can be read honestly. */
  missingInputs: string[];
  /** Version of the weight config that produced this, so old scores stay readable. */
  weightsVersion: string;
};

export type FilterRejection = {
  tokenId: string;
  rule: string;
  detail: string;
};

export type ScanRunReport = {
  id: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  discovered: number;
  deduplicated: number;
  rejectedByFilters: number;
  rejections: FilterRejection[];
  enriched: number;
  scored: number;
  opportunities: number;
  aiResearched: number;
  paperTradesOpened: number;
  errors: string[];
  storageMode: StorageMode;
};

export type StorageMode = "supabase" | "memory";

/** A token with everything we currently know about it. */
export type TokenView = {
  token: Token;
  market: MarketSnapshot | null;
  risk: RiskAssessment | null;
  score: Score | null;
};
