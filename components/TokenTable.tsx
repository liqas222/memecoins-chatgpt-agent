"use client";

import Link from "next/link";
import { useState } from "react";
import type { TokenView } from "@/lib/types";
import * as f from "./format";

type Col = {
  key: string;
  label: string;
  get: (v: TokenView) => number | null;
  render: (v: TokenView) => React.ReactNode;
};

const COLS: Col[] = [
  { key: "age", label: "Age", get: (v) => v.market?.pairAgeHours ?? null,
    render: (v) => <span className="num">{f.age(v.market?.pairAgeHours)}</span> },
  { key: "mcap", label: "MCap", get: (v) => v.market?.marketCap ?? null,
    render: (v) => <span className="num">{f.usd(v.market?.marketCap)}</span> },
  { key: "liq", label: "Liquidity", get: (v) => v.market?.liquidityUsd ?? null,
    render: (v) => <span className="num">{f.usd(v.market?.liquidityUsd)}</span> },
  { key: "vol", label: "Vol 24h", get: (v) => v.market?.volumeH24 ?? null,
    render: (v) => <span className="num">{f.usd(v.market?.volumeH24)}</span> },
  { key: "buys", label: "Buys/Sells 1h", get: (v) => v.market?.buyRatioH1 ?? null,
    render: (v) => (
      <span className="num">
        {f.count(v.market?.buysH1)} / {f.count(v.market?.sellsH1)}
      </span>
    ) },
  { key: "h1", label: "1h", get: (v) => v.market?.changeH1Pct ?? null,
    render: (v) => <span className={`num ${f.changeClass(v.market?.changeH1Pct)}`}>{f.pct(v.market?.changeH1Pct)}</span> },
  { key: "h24", label: "24h", get: (v) => v.market?.changeH24Pct ?? null,
    render: (v) => <span className={`num ${f.changeClass(v.market?.changeH24Pct)}`}>{f.pct(v.market?.changeH24Pct)}</span> },
  { key: "risk", label: "Risk", get: (v) => v.risk?.riskScore ?? null,
    render: (v) =>
      v.risk ? <span className={`pill ${f.riskClass(v.risk.riskScore)}`}>{v.risk.riskScore}</span> : <span className="dim">—</span> },
  { key: "score", label: "Score", get: (v) => v.score?.overallScore ?? null,
    render: (v) =>
      v.score ? <span className={`pill ${f.scoreClass(v.score.overallScore)}`}>{v.score.overallScore}</span> : <span className="dim">—</span> },
];

export default function TokenTable({ tokens }: { tokens: TokenView[] }) {
  const [sortKey, setSortKey] = useState("score");
  const [asc, setAsc] = useState(false);

  if (!tokens.length) {
    return <div className="empty">No tokens yet. Run a scan to populate this table.</div>;
  }

  const col = COLS.find((c) => c.key === sortKey);
  const sorted = [...tokens].sort((a, b) => {
    const av = col?.get(a) ?? -Infinity;
    const bv = col?.get(b) ?? -Infinity;
    return asc ? av - bv : bv - av;
  });

  const toggle = (key: string) => {
    if (key === sortKey) setAsc(!asc);
    else {
      setSortKey(key);
      setAsc(false);
    }
  };

  return (
    <div className="scroll">
      <table>
        <thead>
          <tr>
            <th>Token</th>
            {COLS.map((c) => (
              <th key={c.key} className="sortable" onClick={() => toggle(c.key)}>
                {c.label}
                {sortKey === c.key ? (asc ? " ↑" : " ↓") : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((v) => (
            <tr key={v.token.id}>
              <td>
                <Link href={`/token/${v.token.contract}`}>
                  <strong>{v.token.symbol ?? "?"}</strong>{" "}
                  <span className="dim">{(v.token.name ?? "").slice(0, 22)}</span>
                </Link>
              </td>
              {COLS.map((c) => (
                <td key={c.key}>{c.render(v)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
