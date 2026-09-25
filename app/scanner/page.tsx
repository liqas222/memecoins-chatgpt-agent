"use client";

import { useCallback, useEffect, useState } from "react";
import StorageBanner from "@/components/StorageBanner";
import TokenTable from "@/components/TokenTable";
import * as f from "@/components/format";
import type { ScanRunReport, TokenView } from "@/lib/types";

export default function ScannerPage() {
  const [tokens, setTokens] = useState<TokenView[]>([]);
  const [storage, setStorage] = useState<{ persistent: boolean; message: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [lastReport, setLastReport] = useState<ScanRunReport | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/tokens?limit=200", { cache: "no-store" });
      const d = await res.json();
      setTokens(d.tokens ?? []);
      setStorage(d.storage ?? null);
    } catch {
      setError("Could not load tokens.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function scan() {
    setScanning(true);
    setError("");
    try {
      const res = await fetch("/api/scan", { method: "POST" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Scan failed");
      setLastReport(d);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  }

  return (
    <main className="page">
      <h1>Scanner</h1>
      <p className="lede">
        Every token the scanner has looked at, with its deterministic risk assessment and
        opportunity score. Sort by any column. The score is a research ranking, not a prediction.
      </p>
      <StorageBanner storage={storage} />

      <div className="card">
        <div className="hd">
          <h2>Tokens {tokens.length ? `(${tokens.length})` : ""}</h2>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {lastReport && (
              <span className="sub">
                {lastReport.discovered} found · {lastReport.rejectedByFilters} filtered ·{" "}
                {lastReport.scored} scored · {lastReport.durationMs}ms
              </span>
            )}
            <button className="btn" onClick={scan} disabled={scanning}>
              {scanning ? "Scanning…" : "Run scan"}
            </button>
          </div>
        </div>
        <div className="bd" style={{ padding: 0 }}>
          {error && <div className="empty" style={{ color: "var(--red)" }}>{error}</div>}
          {loading ? <div className="empty">Loading…</div> : <TokenTable tokens={tokens} />}
        </div>
      </div>

      {lastReport && lastReport.rejections.length > 0 && (
        <div className="card" style={{ marginTop: 14 }}>
          <div className="hd">
            <h2>Why tokens were rejected</h2>
            <span className="sub">last run · {f.ago(lastReport.finishedAt)}</span>
          </div>
          <div className="bd">
            {Object.entries(
              lastReport.rejections.reduce<Record<string, number>>((acc, r) => {
                acc[r.rule] = (acc[r.rule] ?? 0) + 1;
                return acc;
              }, {}),
            )
              .sort((a, b) => b[1] - a[1])
              .map(([rule, n]) => (
                <div className="kv" key={rule}>
                  <span className="k">{rule}</span>
                  <span className="v">{n}</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </main>
  );
}
