"use client";

import { use, useEffect, useState } from "react";
import * as f from "@/components/format";
import type { RiskAssessment, MarketSnapshot, Score, Token } from "@/lib/types";

type Detail = {
  token: Token;
  market: MarketSnapshot | null;
  risk: RiskAssessment | null;
  score: Score | null;
  scoreHistory: Score[];
  live: boolean;
  error?: string;
};

const COMPONENT_LABELS: Record<string, string> = {
  marketStructure: "Market structure",
  momentum: "Momentum",
  liquidity: "Liquidity quality",
  social: "Social momentum",
  onchain: "On-chain / wallets",
  catalyst: "Narrative / catalyst",
};

const MAX_POINTS: Record<string, number> = {
  marketStructure: 25, momentum: 20, liquidity: 15, social: 15, onchain: 15, catalyst: 10,
};

export default function TokenPage({ params }: { params: Promise<{ contract: string }> }) {
  const { contract } = use(params);
  const [d, setD] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/token/${contract}`, { cache: "no-store" })
      .then((r) => r.json())
      .then(setD)
      .catch(() => setD(null))
      .finally(() => setLoading(false));
  }, [contract]);

  if (loading) return <main className="page"><div className="empty">Loading…</div></main>;
  if (!d || d.error) {
    return (
      <main className="page">
        <h1>Token not found</h1>
        <p className="lede">{d?.error ?? "No DexScreener data for this address."}</p>
      </main>
    );
  }

  const { token: t, market: m, risk, score } = d;

  return (
    <main className="page">
      <h1>
        {t.symbol ?? "?"} <span className="dim" style={{ fontWeight: 400 }}>{t.name ?? ""}</span>
      </h1>
      <p className="lede">
        <span className="num dim">{t.contract}</span>
        {t.dex ? ` · ${t.dex}` : ""}
        {d.live ? " · live lookup, not yet stored by the scanner" : ""}
      </p>

      <div className="grid k4" style={{ marginBottom: 14 }}>
        <div className="card"><div className="bd stat">
          <div className="label">Research score</div>
          <div className="value">{score?.overallScore ?? "—"}</div>
          <div className="note">not a probability of profit</div>
        </div></div>
        <div className="card"><div className="bd stat">
          <div className="label">Risk score</div>
          <div className="value">{risk?.riskScore ?? "—"}</div>
          <div className="note">{risk?.flags.length ?? 0} flags</div>
        </div></div>
        <div className="card"><div className="bd stat">
          <div className="label">Market cap</div>
          <div className="value" style={{ fontSize: 20 }}>{f.usd(m?.marketCap)}</div>
          <div className="note">liquidity {f.usd(m?.liquidityUsd)}</div>
        </div></div>
        <div className="card"><div className="bd stat">
          <div className="label">Pair age</div>
          <div className="value" style={{ fontSize: 20 }}>{f.age(m?.pairAgeHours)}</div>
          <div className="note">{m ? f.ago(m.capturedAt) : "—"}</div>
        </div></div>
      </div>

      <div className="grid k2">
        <div className="card">
          <div className="hd"><h2>Market</h2><span className="sub">{m?.source ?? "—"}</span></div>
          <div className="bd">
            <div className="kv"><span className="k">Price</span><span className="v">{f.price(m?.priceUsd)}</span></div>
            <div className="kv"><span className="k">FDV</span><span className="v">{f.usd(m?.fdv)}</span></div>
            <div className="kv"><span className="k">Volume 1h / 24h</span><span className="v">{f.usd(m?.volumeH1)} / {f.usd(m?.volumeH24)}</span></div>
            <div className="kv"><span className="k">Change 1h / 6h / 24h</span>
              <span className="v">
                <span className={f.changeClass(m?.changeH1Pct)}>{f.pct(m?.changeH1Pct)}</span>{" / "}
                <span className={f.changeClass(m?.changeH6Pct)}>{f.pct(m?.changeH6Pct)}</span>{" / "}
                <span className={f.changeClass(m?.changeH24Pct)}>{f.pct(m?.changeH24Pct)}</span>
              </span>
            </div>
            <div className="kv"><span className="k">Buys / sells 1h</span><span className="v">{f.count(m?.buysH1)} / {f.count(m?.sellsH1)}</span></div>
            <div className="kv"><span className="k">Buy share 1h</span><span className="v">{m?.buyRatioH1 != null ? `${(m.buyRatioH1 * 100).toFixed(0)}%` : "—"}</span></div>
            <div className="kv"><span className="k">Volume / liquidity</span><span className="v">{f.ratio(m?.volumeToLiquidity)}</span></div>
            <div className="kv"><span className="k">Liquidity / mcap</span><span className="v">{m?.liquidityToMcap != null ? `${(m.liquidityToMcap * 100).toFixed(1)}%` : "—"}</span></div>
          </div>
        </div>

        <div className="card">
          <div className="hd"><h2>Score breakdown</h2><span className="sub">weights {score?.weightsVersion ?? "—"}</span></div>
          <div className="bd">
            {score ? (
              <>
                {Object.entries(COMPONENT_LABELS).map(([key, label]) => {
                  const got = (score.components as unknown as Record<string, number>)[key] ?? 0;
                  const max = MAX_POINTS[key];
                  const unavailable = score.missingInputs.includes(key);
                  return (
                    <div key={key} style={{ marginBottom: 11 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                        <span className={unavailable ? "dim" : "muted"}>
                          {label}
                          {unavailable && " · no data source yet"}
                        </span>
                        <span className="num">{unavailable ? "—" : `${got.toFixed(1)} / ${max}`}</span>
                      </div>
                      <div className="bar"><i style={{ width: `${max ? (got / max) * 100 : 0}%` }} /></div>
                    </div>
                  );
                })}
                <div className="kv" style={{ marginTop: 14 }}>
                  <span className="k">Risk penalty</span>
                  <span className="v down">−{score.components.riskPenalty}</span>
                </div>
                <div className="kv">
                  <span className="k">Overall</span>
                  <span className="v"><strong>{score.overallScore}</strong></span>
                </div>
                <p className="dim" style={{ fontSize: 11, marginTop: 10 }}>
                  Categories without a data source award no points, and the total is renormalised
                  over the categories that could be measured.
                </p>
              </>
            ) : (
              <div className="empty">Not scored.</div>
            )}
          </div>
        </div>
      </div>

      <div className="grid k2" style={{ marginTop: 14 }}>
        <div className="card">
          <div className="hd"><h2>Risk flags</h2><span className="sub">deterministic, no AI</span></div>
          <div className="bd">
            {!risk || risk.flags.length === 0 ? (
              <div className="empty">No flags raised by the checks that could run.</div>
            ) : (
              risk.flags.map((fl) => (
                <div className="flag" key={fl.code}>
                  <span className={`pill r-${fl.severity}`} style={{ alignSelf: "flex-start" }}>{fl.severity}</span>
                  <div>
                    <div className="code">{fl.code}</div>
                    <div className="desc">{fl.description}</div>
                  </div>
                </div>
              ))
            )}
            {risk && risk.unavailableChecks.length > 0 && (
              <p className="dim" style={{ fontSize: 11, marginTop: 12 }}>
                Not checked (needs an on-chain provider — phase 3):{" "}
                {risk.unavailableChecks.join(", ")}
              </p>
            )}
          </div>
        </div>

        <div className="card">
          <div className="hd"><h2>Links & AI research</h2></div>
          <div className="bd">
            <div className="kv"><span className="k">Website</span><span className="v">
              {t.website ? <a href={t.website} target="_blank" rel="noopener noreferrer" style={{ color: "var(--blue)" }}>open ↗</a> : "—"}
            </span></div>
            <div className="kv"><span className="k">X</span><span className="v">
              {t.twitter ? <a href={t.twitter} target="_blank" rel="noopener noreferrer" style={{ color: "var(--blue)" }}>open ↗</a> : "—"}
            </span></div>
            <div className="kv"><span className="k">Telegram</span><span className="v">
              {t.telegram ? <a href={t.telegram} target="_blank" rel="noopener noreferrer" style={{ color: "var(--blue)" }}>open ↗</a> : "—"}
            </span></div>
            <div className="kv"><span className="k">DexScreener</span><span className="v">
              {t.pairAddress ? <a href={`https://dexscreener.com/solana/${t.pairAddress}`} target="_blank" rel="noopener noreferrer" style={{ color: "var(--blue)" }}>open ↗</a> : "—"}
            </span></div>
            <div className="kv"><span className="k">Discovered</span><span className="v">{f.ago(t.discoveredAt)} · {t.discoverySource}</span></div>
            <p className="dim" style={{ fontSize: 12, marginTop: 14 }}>
              AI research runs on high-scoring candidates and is wired up in phase 5. Until then
              this panel stays empty rather than showing a generated guess.
            </p>
          </div>
        </div>
      </div>

      {d.scoreHistory.length > 1 && (
        <div className="card" style={{ marginTop: 14 }}>
          <div className="hd"><h2>Score history</h2><span className="sub">{d.scoreHistory.length} points</span></div>
          <div className="bd" style={{ padding: 0 }}>
            <table>
              <thead><tr><th>When</th><th>Score</th><th>Risk penalty</th><th>Weights</th></tr></thead>
              <tbody>
                {[...d.scoreHistory].reverse().map((s, i) => (
                  <tr key={`${s.scoredAt}-${i}`}>
                    <td className="num dim">{f.ago(s.scoredAt)}</td>
                    <td><span className={`pill ${f.scoreClass(s.overallScore)}`}>{s.overallScore}</span></td>
                    <td className="num down">−{s.components.riskPenalty}</td>
                    <td className="num dim">{s.weightsVersion}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}
