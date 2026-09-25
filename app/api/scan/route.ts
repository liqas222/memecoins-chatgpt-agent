/**
 * Runs one scanner pass.
 *
 * Protected by CRON_SECRET: the scan hits several providers and is the kind of
 * endpoint that must not be free for anyone to hammer. Vercel Cron sends the
 * secret as a Bearer token; a manual call can pass ?secret=.
 *
 * If CRON_SECRET is unset the endpoint stays open, so a first deploy works
 * before the user has configured anything — and the response says so.
 */
import { NextResponse } from "next/server";
import { runScan } from "@/lib/engine/scan";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

function authorize(req: Request): { ok: true; unprotected: boolean } | { ok: false } {
  const secret = process.env.CRON_SECRET;
  if (!secret) return { ok: true, unprotected: true };
  const header = req.headers.get("authorization");
  const url = new URL(req.url);
  const given = header?.replace(/^Bearer\s+/i, "") ?? url.searchParams.get("secret");
  return given === secret ? { ok: true, unprotected: false } : { ok: false };
}

async function handle(req: Request) {
  const auth = authorize(req);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const report = await runScan();
    return NextResponse.json({
      ...report,
      warning: auth.unprotected
        ? "CRON_SECRET is not set — this endpoint is currently open to anyone."
        : undefined,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[scan] run failed", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
