export default function PaperTradesPage() {
  return (
    <main className="page">
      <h1>Paper trades</h1>
      <p className="lede">
        Simulated positions opened automatically when a token clears the paper-trade threshold,
        then tracked to a stop or a target. No real money and no wallet signing is involved at any
        point.
      </p>
      <div className="card">
        <div className="bd">
          <p style={{ marginBottom: 10 }}>Not implemented yet — this is phase 2.</p>
          <p className="muted" style={{ fontSize: 13 }}>
            It needs persistent storage first: a paper trade is only worth anything if its entry,
            its stop and the information available at that moment survive past one serverless
            invocation. Showing an empty table here would be less honest than saying so.
          </p>
        </div>
      </div>
    </main>
  );
}
