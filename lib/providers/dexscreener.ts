/**
 * DexScreener provider.
 *
 * The one data source that needs no API key, which makes it the backbone of
 * Phase 1: discovery, market data and the social links a token advertises.
 * Replaces the old lib/market.ts, whose mapping is kept intact here.
 */
import { fetchJson, num, ratio, type FetchResult } from "./http";
import type { DiscoverySource, MarketSnapshot, Token } from "../types";

const BASE = "https://api.dexscreener.com";
export const SOURCE = "dexscreener";

type DexPairRaw = {
  chainId?: string;
  dexId?: string;
  pairAddress?: string;
  url?: string;
  pairCreatedAt?: number;
  baseToken?: { address?: string; name?: string; symbol?: string };
  quoteToken?: { symbol?: string };
  priceUsd?: string;
  marketCap?: number;
  fdv?: number;
  liquidity?: { usd?: number };
  volume?: { m5?: number; h1?: number; h6?: number; h24?: number };
  priceChange?: { m5?: number; h1?: number; h6?: number; h24?: number };
  txns?: Record<string, { buys?: number; sells?: number }>;
  info?: {
    imageUrl?: string;
    websites?: { url?: string }[];
    socials?: { type?: string; platform?: string; url?: string; handle?: string }[];
  };
};

export type DexPair = { token: Token; market: MarketSnapshot };

/** The shape the old /api/analyze route passes to the AI. Kept for compatibility. */
export type LegacyDexPair = {
  chain: string | null;
  dex: string | null;
  pair_address: string | null;
  url: string | null;
  base_name: string | null;
  base_symbol: string | null;
  base_address: string | null;
  quote_symbol: string | null;
  price_usd: string | null;
  market_cap: number | null;
  fdv: number | null;
  liquidity_usd: number | null;
  volume_h1: number | null;
  volume_h6: number | null;
  volume_h24: number | null;
  buys_h1: number | null;
  sells_h1: number | null;
  change_m5_pct: number | null;
  change_h1_pct: number | null;
  change_h6_pct: number | null;
  change_h24_pct: number | null;
  pair_age_hours: number | null;
};

function socialLink(raw: DexPairRaw, kind: string): string | null {
  const s = raw.info?.socials?.find(
    (x) => (x.type ?? x.platform ?? "").toLowerCase() === kind,
  );
  return s?.url ?? null;
}

function mapPair(raw: DexPairRaw, source: DiscoverySource, now: Date): DexPair | null {
  const contract = raw.baseToken?.address;
  const chain = raw.chainId;
  if (!contract || chain !== "solana") return null; // V1 is Solana only

  const createdMs = num(raw.pairCreatedAt);
  const ageHours = createdMs !== null ? (now.getTime() - createdMs) / 3_600_000 : null;

  const txH1 = raw.txns?.h1 ?? {};
  const txH24 = raw.txns?.h24 ?? {};
  const buysH1 = num(txH1.buys);
  const sellsH1 = num(txH1.sells);
  const buysH24 = num(txH24.buys);
  const sellsH24 = num(txH24.sells);

  const liquidityUsd = num(raw.liquidity?.usd);
  const marketCap = num(raw.marketCap) ?? num(raw.fdv);
  const volumeH24 = num(raw.volume?.h24);

  const token: Token = {
    id: `solana:${contract}`,
    chain: "solana",
    contract,
    symbol: raw.baseToken?.symbol ?? null,
    name: raw.baseToken?.name ?? null,
    pairAddress: raw.pairAddress ?? null,
    dex: raw.dexId ?? null,
    pairCreatedAt: createdMs !== null ? new Date(createdMs).toISOString() : null,
    discoveredAt: now.toISOString(),
    discoverySource: source,
    imageUrl: raw.info?.imageUrl ?? null,
    website: raw.info?.websites?.[0]?.url ?? null,
    twitter: socialLink(raw, "twitter"),
    telegram: socialLink(raw, "telegram"),
  };

  const market: MarketSnapshot = {
    tokenId: token.id,
    capturedAt: now.toISOString(),
    source: SOURCE,
    priceUsd: num(raw.priceUsd),
    marketCap,
    fdv: num(raw.fdv),
    liquidityUsd,
    volumeM5: num(raw.volume?.m5),
    volumeH1: num(raw.volume?.h1),
    volumeH6: num(raw.volume?.h6),
    volumeH24: volumeH24,
    changeM5Pct: num(raw.priceChange?.m5),
    changeH1Pct: num(raw.priceChange?.h1),
    changeH6Pct: num(raw.priceChange?.h6),
    changeH24Pct: num(raw.priceChange?.h24),
    buysH1,
    sellsH1,
    buysH24,
    sellsH24,
    txnsH1: buysH1 !== null && sellsH1 !== null ? buysH1 + sellsH1 : null,
    txnsH24: buysH24 !== null && sellsH24 !== null ? buysH24 + sellsH24 : null,
    pairAgeHours: ageHours !== null ? Math.round(ageHours * 100) / 100 : null,
    volumeToLiquidity: ratio(volumeH24, liquidityUsd),
    liquidityToMcap: ratio(liquidityUsd, marketCap),
    buyRatioH1:
      buysH1 !== null && sellsH1 !== null && buysH1 + sellsH1 > 0
        ? buysH1 / (buysH1 + sellsH1)
        : null,
  };

  return { token, market };
}

function pairsFrom(
  result: FetchResult<{ pairs?: DexPairRaw[] } | DexPairRaw[]>,
  source: DiscoverySource,
): DexPair[] {
  if (!result.ok) return [];
  const raw = Array.isArray(result.data) ? result.data : (result.data.pairs ?? []);
  const now = new Date();
  return raw.map((p) => mapPair(p, source, now)).filter((p): p is DexPair => p !== null);
}

/** Free-text search: ticker, name or contract address. */
export async function search(query: string, limit = 12): Promise<DexPair[]> {
  const res = await fetchJson<{ pairs?: DexPairRaw[] }>(
    `${BASE}/latest/dex/search?q=${encodeURIComponent(query)}`,
    { source: SOURCE },
  );
  return pairsFrom(res, "dexscreener:search").slice(0, limit);
}

/** Everything DexScreener knows about one token address. */
export async function byContract(contract: string): Promise<DexPair[]> {
  const res = await fetchJson<{ pairs?: DexPairRaw[] }>(
    `${BASE}/token-pairs/v1/solana/${encodeURIComponent(contract)}`,
    { source: SOURCE },
  );
  const pairs = pairsFrom(res, "dexscreener:search");
  if (pairs.length) return pairs;
  // Older endpoint, still the reliable fallback for a bare address.
  return search(contract, 12);
}

type BoostRaw = { chainId?: string; tokenAddress?: string };

/**
 * Tokens whose teams paid for visibility. Not a quality signal in itself —
 * it is simply a live list of tokens actively seeking attention, which is a
 * reasonable pool to scan.
 */
export async function boosted(): Promise<string[]> {
  const res = await fetchJson<BoostRaw[]>(`${BASE}/token-boosts/latest/v1`, { source: SOURCE });
  if (!res.ok || !Array.isArray(res.data)) return [];
  return res.data
    .filter((b) => b.chainId === "solana" && b.tokenAddress)
    .map((b) => b.tokenAddress as string);
}

/** Newly listed token profiles. */
export async function profiles(): Promise<string[]> {
  const res = await fetchJson<BoostRaw[]>(`${BASE}/token-profiles/latest/v1`, { source: SOURCE });
  if (!res.ok || !Array.isArray(res.data)) return [];
  return res.data
    .filter((b) => b.chainId === "solana" && b.tokenAddress)
    .map((b) => b.tokenAddress as string);
}

/** The flat shape the AI research prompt has always used. */
export function toLegacyShape(p: DexPair): LegacyDexPair {
  const { token: t, market: m } = p;
  return {
    chain: t.chain,
    dex: t.dex,
    pair_address: t.pairAddress,
    url: t.pairAddress ? `https://dexscreener.com/solana/${t.pairAddress}` : null,
    base_name: t.name,
    base_symbol: t.symbol,
    base_address: t.contract,
    quote_symbol: null,
    price_usd: m.priceUsd !== null ? String(m.priceUsd) : null,
    market_cap: m.marketCap,
    fdv: m.fdv,
    liquidity_usd: m.liquidityUsd,
    volume_h1: m.volumeH1,
    volume_h6: m.volumeH6,
    volume_h24: m.volumeH24,
    buys_h1: m.buysH1,
    sells_h1: m.sellsH1,
    change_m5_pct: m.changeM5Pct,
    change_h1_pct: m.changeH1Pct,
    change_h6_pct: m.changeH6Pct,
    change_h24_pct: m.changeH24Pct,
    pair_age_hours: m.pairAgeHours,
  };
}
