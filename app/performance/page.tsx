export default function PerformancePage() {
  return (
    <main className="page">
      <h1>Performance</h1>
      <p className="lede">
        Whether a research score of 85 actually performs better than one of 65 — measured across
        closed paper trades, grouped by score band, market cap, liquidity, token age and source.
      </p>
      <div className="card">
        <div className="bd">
          <p style={{ marginBottom: 10 }}>Not implemented yet — this is phase 2.</p>
          <p className="muted" style={{ fontSize: 13 }}>
            There is deliberately nothing here rather than placeholder statistics. Win rates
            computed from a handful of trades are noise, and displaying them would make the system
            look like it knows something it does not. This page appears once closed paper trades
            exist to compute it from.
          </p>
        </div>
      </div>
    </main>
  );
}
