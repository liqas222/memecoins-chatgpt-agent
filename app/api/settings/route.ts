/** The live scanner configuration, so the settings page shows what is actually running. */
import { NextResponse } from "next/server";
import { getScannerConfig, RISK_PENALTY, DISCOVERY_QUERIES } from "@/lib/config/scanner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const cfg = getScannerConfig();
  return NextResponse.json({
    ...cfg,
    riskPenalty: RISK_PENALTY,
    discoveryQueries: DISCOVERY_QUERIES,
    editable: false,
    note: "Configuration lives in lib/config/scanner.ts and is read-only in the UI for now. Editing it from here needs persistent storage (phase 2).",
  });
}
