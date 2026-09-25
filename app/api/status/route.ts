/** What the dashboard header needs: storage mode, last run, today's counts. */
import { NextResponse } from "next/server";
import { getStore, storageStatus } from "@/lib/db";
import { getScannerConfig } from "@/lib/config/scanner";
import { isConfigured as openaiConfigured } from "@/lib/providers/openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const store = getStore();
  const since = new Date(Date.now() - 24 * 3_600_000).toISOString();
  const cfg = getScannerConfig();

  const [lastRun, scannedToday, opportunities] = await Promise.all([
    store.latestScanRun(),
    store.countTokensSince(since),
    store.listTokens({ minScore: cfg.thresholds.opportunity, limit: 100 }),
  ]);

  return NextResponse.json({
    storage: storageStatus(),
    lastRun,
    scannedToday,
    openOpportunities: opportunities.length,
    topOpportunities: opportunities.slice(0, 5),
    activePaperTrades: 0,
    providers: {
      dexscreener: { configured: true, note: "public, no key required" },
      openai: { configured: openaiConfigured(), note: "AI research" },
      helius: { configured: Boolean(process.env.HELIUS_API_KEY), note: "on-chain (phase 3)" },
      birdeye: { configured: Boolean(process.env.BIRDEYE_API_KEY), note: "on-chain (phase 3)" },
      x: { configured: Boolean(process.env.X_BEARER_TOKEN), note: "social (phase 4)" },
    },
    cronProtected: Boolean(process.env.CRON_SECRET),
    thresholds: cfg.thresholds,
  });
}
