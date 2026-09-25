/**
 * Shared HTTP layer for every external provider.
 *
 * One unreachable provider must never take the scanner down, so everything
 * here returns a result object instead of throwing, and each host gets its own
 * minimum spacing between calls.
 */

export type FetchResult<T> =
  | { ok: true; data: T; source: string; fetchedAt: string }
  | { ok: false; error: string; source: string; fetchedAt: string };

const lastCallAt = new Map<string, number>();

/** Minimum milliseconds between two calls to the same host. */
const HOST_SPACING_MS: Record<string, number> = {
  "api.dexscreener.com": 250,
  default: 200,
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function respectRateLimit(host: string) {
  const spacing = HOST_SPACING_MS[host] ?? HOST_SPACING_MS.default;
  const last = lastCallAt.get(host) ?? 0;
  const wait = last + spacing - Date.now();
  if (wait > 0) await sleep(wait);
  lastCallAt.set(host, Date.now());
}

export type FetchOptions = {
  source: string;
  timeoutMs?: number;
  retries?: number;
  headers?: Record<string, string>;
  method?: string;
  body?: string;
};

export async function fetchJson<T>(url: string, opts: FetchOptions): Promise<FetchResult<T>> {
  const { source, timeoutMs = 12_000, retries = 2 } = opts;
  const host = (() => {
    try {
      return new URL(url).host;
    } catch {
      return "default";
    }
  })();

  let lastError = "unknown error";
  for (let attempt = 0; attempt <= retries; attempt++) {
    await respectRateLimit(host);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: opts.method ?? "GET",
        headers: { Accept: "application/json", ...(opts.headers ?? {}) },
        body: opts.body,
        cache: "no-store",
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.status === 429 || res.status >= 500) {
        // Worth another try; anything else is our fault and will not improve.
        lastError = `HTTP ${res.status}`;
        if (attempt < retries) {
          await sleep(500 * Math.pow(2, attempt));
          continue;
        }
        break;
      }
      if (!res.ok) {
        lastError = `HTTP ${res.status}`;
        break;
      }
      return { ok: true, data: (await res.json()) as T, source, fetchedAt: new Date().toISOString() };
    } catch (err) {
      clearTimeout(timer);
      lastError = err instanceof Error ? err.message : String(err);
      if (attempt < retries) await sleep(500 * Math.pow(2, attempt));
    }
  }
  return { ok: false, error: lastError, source, fetchedAt: new Date().toISOString() };
}

export function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export function ratio(a: number | null, b: number | null): number | null {
  if (a === null || b === null || b === 0) return null;
  const r = a / b;
  return Number.isFinite(r) ? r : null;
}
