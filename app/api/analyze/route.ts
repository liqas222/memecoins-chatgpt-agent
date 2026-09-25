/**
 * Free-text analysis of a single token, as it has always worked: paste a
 * ticker or contract, get a research write-up. The scanner path is separate
 * (/api/scan) and does not go through here.
 */
import { NextResponse } from "next/server";
import * as dex from "@/lib/providers/dexscreener";
import * as ai from "@/lib/providers/openai";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const query = String(body.query || "").trim();
    if (!query || query.length > 180) {
      return NextResponse.json({ error: "Enter a valid ticker or contract address." }, { status: 400 });
    }

    const pairs = await dex.search(query);
    if (!pairs.length) {
      return NextResponse.json(
        { error: "No DexScreener pairs found. Try the exact contract address." },
        { status: 404 },
      );
    }
    const market = pairs.map(dex.toLegacyShape);

    if (!ai.isConfigured()) {
      return NextResponse.json(
        { error: "AI research unavailable — OPENAI_API_KEY is not configured.", market },
        { status: 503 },
      );
    }

    let report: string;
    try {
      report = await ai.runAgent(query, market);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unexpected error";
      return NextResponse.json({ error: `AI research unavailable: ${message}`, market }, { status: 502 });
    }

    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { error } = await supabase
        .from("analyses")
        .insert({ query, report, market_snapshot: market });
      if (error) console.error("Supabase insert failed", error.message);
    }
    return NextResponse.json({ report, market });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected error" },
      { status: 500 },
    );
  }
}
