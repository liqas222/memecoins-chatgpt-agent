export type DexPair = {
  chain: string | null; dex: string | null; pair_address: string | null; url: string | null;
  base_name: string | null; base_symbol: string | null; base_address: string | null; quote_symbol: string | null;
  price_usd: string | null; market_cap: number | null; fdv: number | null; liquidity_usd: number | null;
  volume_h1: number | null; volume_h6: number | null; volume_h24: number | null;
  buys_h1: number | null; sells_h1: number | null; change_m5_pct: number | null; change_h1_pct: number | null;
  change_h6_pct: number | null; change_h24_pct: number | null; pair_age_hours: number | null;
};

export async function searchDex(query: string, limit = 12): Promise<DexPair[]> {
  const url = new URL("https://api.dexscreener.com/latest/dex/search");
  url.searchParams.set("q", query);
  const res = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
  if (!res.ok) throw new Error(`DexScreener error: ${res.status}`);
  const json = await res.json();
  return (json.pairs ?? []).slice(0, limit).map((p: any) => {
    const created = p.pairCreatedAt ? Number(p.pairCreatedAt) : null;
    return {
      chain:p.chainId ?? null, dex:p.dexId ?? null, pair_address:p.pairAddress ?? null, url:p.url ?? null,
      base_name:p.baseToken?.name ?? null, base_symbol:p.baseToken?.symbol ?? null, base_address:p.baseToken?.address ?? null,
      quote_symbol:p.quoteToken?.symbol ?? null, price_usd:p.priceUsd ?? null, market_cap:p.marketCap ?? null, fdv:p.fdv ?? null,
      liquidity_usd:p.liquidity?.usd ?? null, volume_h1:p.volume?.h1 ?? null, volume_h6:p.volume?.h6 ?? null, volume_h24:p.volume?.h24 ?? null,
      buys_h1:p.txns?.h1?.buys ?? null, sells_h1:p.txns?.h1?.sells ?? null, change_m5_pct:p.priceChange?.m5 ?? null,
      change_h1_pct:p.priceChange?.h1 ?? null, change_h6_pct:p.priceChange?.h6 ?? null, change_h24_pct:p.priceChange?.h24 ?? null,
      pair_age_hours:created ? Math.round(((Date.now()-created)/3600000)*100)/100 : null,
    };
  });
}
