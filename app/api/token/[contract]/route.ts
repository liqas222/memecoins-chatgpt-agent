/**
 * Full intelligence for one token. Falls back to a live DexScreener lookup for
 * a contract the scanner has not stored, so any address can be inspected.
 */
import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import * as dex from "@/lib/providers/dexscreener";
import { assessRisk } from "@/lib/engine/risk";
import { scoreToken } from "@/lib/engine/scoring";
import type { TokenView } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ contract: string }> }) {
  const { contract } = await ctx.params;
  const tokenId = contract.includes(":") ? contract : `solana:${contract}`;
  const store = getStore();

  const stored = await store.getToken(tokenId);
  if (stored?.score) {
    return NextResponse.json({
      ...stored,
      scoreHistory: await store.getScoreHistory(tokenId),
      live: false,
    });
  }

  const address = tokenId.split(":")[1];
  const pairs = await dex.byContract(address);
  if (!pairs.length) return NextResponse.json({ error: "Token not found." }, { status: 404 });

  const best = pairs.reduce((a, b) =>
    (b.market.liquidityUsd ?? 0) > (a.market.liquidityUsd ?? 0) ? b : a,
  );
  const risk = assessRisk(best.token, best.market);
  const score = scoreToken(best.token, best.market, risk);
  const view: TokenView = { token: best.token, market: best.market, risk, score };

  return NextResponse.json({ ...view, scoreHistory: [score], live: true });
}
