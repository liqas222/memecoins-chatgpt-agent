/**
 * Everything the scanner currently knows, highest score first.
 *
 * Without a database the store is empty on a cold instance, so the first read
 * triggers a scan. That is what makes the dashboard useful on a fresh deploy
 * instead of showing an empty table with no explanation.
 */
import { NextResponse } from "next/server";
import { getStore, storageStatus } from "@/lib/db";
import { runScan } from "@/lib/engine/scan";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

let autoScanAt = 0;
const AUTO_SCAN_COOLDOWN_MS = 120_000;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const minScore = Number(url.searchParams.get("minScore") ?? "0") || 0;
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "100") || 100, 300);

  const store = getStore();
  let tokens = await store.listTokens({ minScore, limit });
  let autoScanned = false;

  if (!tokens.length && Date.now() - autoScanAt > AUTO_SCAN_COOLDOWN_MS) {
    autoScanAt = Date.now();
    try {
      await runScan();
      tokens = await store.listTokens({ minScore, limit });
      autoScanned = true;
    } catch (err) {
      console.error("[tokens] auto-scan failed", err);
    }
  }

  return NextResponse.json({ tokens, storage: storageStatus(), autoScanned });
}
