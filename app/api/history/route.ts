import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function GET() {
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ items: [] });
  const { data, error } = await supabase.from("analyses").select("id,query,report,created_at").order("created_at", { ascending:false }).limit(20);
  if (error) return NextResponse.json({ error:error.message }, { status:500 });
  return NextResponse.json({ items:data ?? [] });
}
