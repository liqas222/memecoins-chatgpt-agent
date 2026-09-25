import { NextResponse } from "next/server";
import { searchDex } from "@/lib/market";
import { runAgent } from "@/lib/agent";
import { getSupabaseAdmin } from "../../../lib/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const query = String(body.query || "").trim();
    if (!query || query.length > 180) return NextResponse.json({ error: "Enter a valid ticker or contract address." }, { status: 400 });

    const market = await searchDex(query);
    if (!market.length) return NextResponse.json({ error: "No DexScreener pairs found. Try the exact contract address." }, { status: 404 });

    const report = await runAgent(query, market);
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { error } = await supabase.from("analyses").insert({ query, report, market_snapshot: market });
      if (error) console.error("Supabase insert failed", error.message);
    }
    return NextResponse.json({ report, market });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unexpected error" }, { status: 500 });
  }
}
