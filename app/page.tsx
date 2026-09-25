"use client";

import { FormEvent, useEffect, useState } from "react";

type HistoryItem = { id: string; query: string; report: string; created_at: string };

export default function Home() {
  const [query, setQuery] = useState("");
  const [report, setReport] = useState("Enter a ticker or, preferably, a contract address.");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadHistory() {
    const res = await fetch("/api/history", { cache: "no-store" });
    if (res.ok) setHistory((await res.json()).items ?? []);
  }

  useEffect(() => { loadHistory(); }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed");
      setReport(data.report);
      await loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally { setLoading(false); }
  }

  return <main>
    <section className="hero">
      <div className="badge">Research + paper trades only</div>
      <h1>Trading Research Agent</h1>
      <p className="sub">Live DEX data + AI web research + persistent research history. Built for fast memecoin/crypto setup analysis without executing real trades.</p>
    </section>

    <section className="panel">
      <form className="form" onSubmit={submit}>
        <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Paste Solana contract address or ticker…" />
        <button disabled={loading}>{loading ? "Researching…" : "Analyze"}</button>
      </form>
      {error && <p className="error">{error}</p>}
    </section>

    <div className="grid">
      <section className="panel">
        <p className="small">LATEST REPORT</p>
        <pre>{report}</pre>
      </section>
      <aside className="panel">
        <p className="small">RESEARCH JOURNAL</p>
        <div className="history">
          {history.length === 0 && <p className="small">Supabase history will appear here after your first saved analysis.</p>}
          {history.map(item => <button key={item.id} onClick={()=>setReport(item.report)}>{item.query}<span>{new Date(item.created_at).toLocaleString()}</span></button>)}
        </div>
      </aside>
    </div>
  </main>;
}
