/** Display helpers. Missing data renders as "—", never as 0. */

export function usd(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `$${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1_000_000) return `$${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1_000) return `$${(n / 1e3).toFixed(1)}k`;
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: digits })}`;
}

export function price(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  if (n === 0) return "$0";
  if (n < 0.000001) return `$${n.toExponential(2)}`;
  if (n < 1) return `$${n.toPrecision(3)}`;
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

export function count(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toLocaleString("en-US");
}

export function pct(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(digits)}%`;
}

export function ratio(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return `${n.toFixed(digits)}x`;
}

export function age(hours: number | null | undefined): string {
  if (hours === null || hours === undefined || !Number.isFinite(hours)) return "—";
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 48) return `${hours.toFixed(1)}h`;
  return `${Math.round(hours / 24)}d`;
}

export function ago(iso: string | null | undefined): string {
  if (!iso) return "—";
  const ms = Date.now() - Date.parse(iso);
  if (!Number.isFinite(ms)) return "—";
  const min = Math.round(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.round(min / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function scoreClass(score: number | null | undefined): string {
  if (score === null || score === undefined) return "s-low";
  if (score >= 75) return "s-high";
  if (score >= 60) return "s-mid";
  return "s-low";
}

export function riskClass(risk: number | null | undefined): string {
  if (risk === null || risk === undefined) return "r-low";
  if (risk >= 70) return "r-critical";
  if (risk >= 45) return "r-high";
  if (risk >= 25) return "r-medium";
  return "r-low";
}

export function changeClass(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "dim";
  return n >= 0 ? "up" : "down";
}
