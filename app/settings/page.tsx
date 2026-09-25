"use client";

import { useEffect, useState } from "react";

type Settings = {
  filters: Record<string, unknown>;
  weights: Record<string, number>;
  thresholds: Record<string, number>;
  limits: Record<string, number>;
  riskPenalty: Record<string, number>;
  discoveryQueries: string[];
  weightsVersion: string;
  note: string;
};

function Block({ title, data }: { title: string; data: Record<string, unknown> }) {
  return (
    <div className="card">
      <div className="hd"><h2>{title}</h2></div>
      <div className="bd">
        {Object.entries(data).map(([k, v]) => (
          <div className="kv" key={k}>
            <span className="k">{k}</span>
            <span className="v">{v === null ? "unset" : Array.isArray(v) ? (v.length ? v.join(", ") : "none") : String(v)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [s, setS] = useState<Settings | null>(null);

  useEffect(() => {
    fetch("/api/settings", { cache: "no-store" }).then((r) => r.json()).then(setS).catch(() => {});
  }, []);

  if (!s) return <main className="page"><div className="empty">Loading…</div></main>;

  return (
    <main className="page">
      <h1>Settings</h1>
      <p className="lede">
        The thresholds and weights the scanner is running right now. None of these numbers are
        optimized — they are starting values, and every score is stored with its weights version
        ({s.weightsVersion}) so they can be evaluated against real outcomes later.
      </p>
      <div className="banner">{s.note}</div>

      <div className="grid k2">
        <Block title="Filters" data={s.filters} />
        <div style={{ display: "grid", gap: 14 }}>
          <Block title="Score weights (max points)" data={s.weights} />
          <Block title="Thresholds" data={s.thresholds} />
        </div>
      </div>
      <div className="grid k2" style={{ marginTop: 14 }}>
        <Block title="Risk penalty" data={s.riskPenalty} />
        <Block title="Run limits" data={{ ...s.limits, discoveryQueries: s.discoveryQueries }} />
      </div>
    </main>
  );
}
