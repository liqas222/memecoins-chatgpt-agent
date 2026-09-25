/**
 * Storage abstraction.
 *
 * Supabase when it is configured, an in-memory store when it is not. The point
 * is that a missing database degrades the product rather than breaking the
 * deployment: the scanner still runs, the dashboard still renders, and the UI
 * says plainly that nothing is being kept.
 *
 * The memory store lives for as long as one serverless instance stays warm.
 * That is genuinely not persistence, and nothing in the UI pretends otherwise.
 */
import type {
  MarketSnapshot,
  RiskAssessment,
  ScanRunReport,
  Score,
  StorageMode,
  Token,
  TokenView,
} from "../types";
import { getSupabaseAdmin } from "../supabase-admin";
import { memoryStore } from "./memory";
import { supabaseStore } from "./supabase";

export interface Store {
  readonly mode: StorageMode;
  upsertToken(token: Token): Promise<void>;
  saveMarketSnapshot(snapshot: MarketSnapshot): Promise<void>;
  saveRisk(risk: RiskAssessment): Promise<void>;
  saveScore(score: Score): Promise<void>;
  saveScanRun(run: ScanRunReport): Promise<void>;
  /** Latest known state per token, highest score first. */
  listTokens(opts?: { minScore?: number; limit?: number }): Promise<TokenView[]>;
  getToken(tokenId: string): Promise<TokenView | null>;
  /** Score history for one token, oldest first. */
  getScoreHistory(tokenId: string): Promise<Score[]>;
  latestScanRun(): Promise<ScanRunReport | null>;
  countTokensSince(iso: string): Promise<number>;
}

let cached: Store | null = null;

export function getStore(): Store {
  if (cached) return cached;
  const supabase = getSupabaseAdmin();
  cached = supabase ? supabaseStore(supabase) : memoryStore();
  return cached;
}

export function storageMode(): StorageMode {
  return getStore().mode;
}

/** For the dashboard warning banner. */
export function storageStatus(): { mode: StorageMode; persistent: boolean; message: string } {
  const mode = storageMode();
  return mode === "supabase"
    ? { mode, persistent: true, message: "Persistent database connected." }
    : {
        mode,
        persistent: false,
        message:
          "Persistent database not configured. Scans run and display normally, but nothing is kept — history, paper trades and performance statistics need Supabase.",
      };
}
