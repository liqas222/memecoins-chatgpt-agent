"use client";

import { useEffect, useState } from "react";
import StorageBanner from "@/components/StorageBanner";
import TokenTable from "@/components/TokenTable";
import type { TokenView } from "@/lib/types";

export default function OpportunitiesPage() {
  const [tokens, setTokens] = useState<TokenView[]>([]);
  const [storage, setStorage] = useState<{ persistent: boolean; message: string } | null>(null);
  const [threshold, setThreshold] = useState(65);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetch("/api/status", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/tokens?limit=200", { cache: "no-store" }).then((r) => r.json()),
    ])
      .then(([status, data]) => {
        if (cancelled) return;
        setThreshold(status?.thresholds?.opportunity ?? 65);
        setTokens(data.tokens ?? []);
        setStorage(data.storage ?? null);
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const ranked = tokens.filter((t) => (t.score?.overallScore ?? 0) >= threshold);

  return (
    <main className="page">
      <h1>Opportunities</h1>
      <p className="lede">
        Tokens currently ranked at or above research score {threshold}. This is a ranking of how
        interesting the setup looks to the scoring model — not a recommendation, not a prediction,
        and not a buy list. Whether a high score actually leads anywhere is exactly what the paper
        trading in phase 2 is meant to find out.
      </p>
      <StorageBanner storage={storage} />

      <div className="card">
        <div className="hd">
          <h2>Ranked by research score</h2>
          <span className="sub">{ranked.length} above threshold</span>
        </div>
        <div className="bd" style={{ padding: 0 }}>
          {loading ? (
            <div className="empty">Loading…</div>
          ) : ranked.length === 0 ? (
            <div className="empty">
              Nothing above {threshold} right now. That is a normal result — most tokens should
              not clear this bar.
            </div>
          ) : (
            <TokenTable tokens={ranked} />
          )}
        </div>
      </div>
    </main>
  );
}
