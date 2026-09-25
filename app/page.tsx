"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import StorageBanner from "@/components/StorageBanner";
import * as f from "@/components/format";
import type { ScanRunReport, TokenView } from "@/lib/types";

type Status = {
  storage: { persistent: boolean; message: string };
  lastRun: ScanRunReport | null;
  scannedToday: number;
  openOpportunities: number;
  topOpportunities: TokenView[];
  activePaperTrades: number;
  providers: Record<string, { configured: boolean; note: string }>;
  cronProtected: boolean;
  thresholds: { opportunity: number; paperTrade: number };
};

export default function OverviewPage() {
  const [s, setS] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/status", { cache: "no-store" })
      .then((r) => r.json())
      .then(setS)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="page">
      <h1>Overview</h1>
      <p className="lede">
        Autonomous Solana memecoin research. The system discovers tokens, filters them, scores
        them and records what it believed at the time. It never places a real trade.
      </p>

      {loading && <div className="empty">Loading…</div>}
      {!loading && s && (
        <>
          <StorageBanner storage={s.storage} />

          <div className="grid k4" style={{ marginBottom: 14 }}>
            <div className="card">
              <div className="bd stat">
                <div className="label">Tokens seen (24h)</div>
                <div className="value">{s.scannedToday}</div>
              </div>
            </div>
            <div className="card">
              <div className="bd stat">
                <div className="label">Opportunities</div>
                <div className="value">{s.openOpportunities}</div>
                <div className="note">score ≥ {s.thresholds.opportunity}</div>
              </div>
            </div>
            <div className="card">
              <div className="bd stat">
                <div className="label">Paper trades</div>
                <div className="value dim">—</div>
                <div className="note">phase 2</div>
              </div>
            </div>
            <div className="card">
              <div className="bd stat">
                <div className="label">Last scan</div>
                <div className="value" style={{ fontSize: 18 }}>
                  {s.lastRun ? f.ago(s.lastRun.finishedAt) : "never"}
                </div>
                <div className="note">
                  {s.lastRun ? `${s.lastRun.scored} scored in ${s.lastRun.durationMs}ms` : "run one from the scanner"}
                </div>
              </div>
            </div>
          </div>

          <div className="grid k2">
            <div className="card">
              <div className="hd">
                <h2>Highest scoring right now</h2>
                <Link href="/opportunities" className="sub">
                  all →
                </Link>
              </div>
              <div className="bd" style={{ padding: 0 }}>
                {s.topOpportunities.length === 0 ? (
                  <div className="empty">
                    Nothing above the threshold yet. Run a scan from the Scanner page.
                  </div>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>Token</th>
                        <th>MCap</th>
                        <th>Liquidity</th>
                        <th>Risk</th>
                        <th>Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.topOpportunities.map((v) => (
                        <tr key={v.token.id}>
                          <td>
                            <Link href={`/token/${v.token.contract}`}>
                              <strong>{v.token.symbol ?? "?"}</strong>
                            </Link>
                          </td>
                          <td className="num">{f.usd(v.market?.marketCap)}</td>
                          <td className="num">{f.usd(v.market?.liquidityUsd)}</td>
                          <td>
                            <span className={`pill ${f.riskClass(v.risk?.riskScore)}`}>
                              {v.risk?.riskScore ?? "—"}
                            </span>
                          </td>
                          <td>
                            <span className={`pill ${f.scoreClass(v.score?.overallScore)}`}>
                              {v.score?.overallScore ?? "—"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className="card">
              <div className="hd">
                <h2>System</h2>
              </div>
              <div className="bd">
                {Object.entries(s.providers).map(([name, p]) => (
                  <div className="kv" key={name}>
                    <span className="k">
                      {name} <span className="dim">· {p.note}</span>
                    </span>
                    <span className="v" style={{ color: p.configured ? "var(--green)" : "var(--dim)" }}>
                      {p.configured ? "configured" : "not configured"}
                    </span>
                  </div>
                ))}
                <div className="kv">
                  <span className="k">cron endpoint</span>
                  <span className="v" style={{ color: s.cronProtected ? "var(--green)" : "var(--amber)" }}>
                    {s.cronProtected ? "protected" : "CRON_SECRET not set"}
                  </span>
                </div>
                {s.lastRun && s.lastRun.errors.length > 0 && (
                  <div className="kv">
                    <span className="k">last run errors</span>
                    <span className="v" style={{ color: "var(--amber)" }}>{s.lastRun.errors.length}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
