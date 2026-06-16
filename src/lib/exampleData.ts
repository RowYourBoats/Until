/**
 * Demo-data date rebasing.
 *
 * The bundled `data-example/*` seed is authored around a fixed "today" (SEED_ANCHOR).
 * The app filters the scratchpad/habits on the visitor's real calendar date, so without
 * rebasing the demo's "Today" would always be empty and event horizons would drift into
 * the past. When we fall back to the example snapshot (i.e. on the read-only demo), we
 * shift every date-shaped value by (today − anchor) days so the seed always lands on the
 * visitor's today and never goes stale.
 *
 * This runs ONLY on the example-data path — real local `data/*` is served verbatim.
 *
 * Keep SEED_ANCHOR in sync with the dates the seed files are written around.
 */
export const SEED_ANCHOR = "2026-06-16";

const DAY_MS = 86400000;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const ISO_TS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?$/;

function anchorOffsetDays(): number {
  const now = new Date();
  const todayUTC = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const [y, m, d] = SEED_ANCHOR.split("-").map(Number);
  const anchorUTC = Date.UTC(y, m - 1, d);
  return Math.round((todayUTC - anchorUTC) / DAY_MS);
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function shiftDateOnly(value: string, days: number): string {
  const [y, m, d] = value.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d) + days * DAY_MS);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

function shiftTimestamp(value: string, days: number): string {
  return new Date(new Date(value).getTime() + days * DAY_MS).toISOString();
}

function walk(node: unknown, days: number): unknown {
  if (typeof node === "string") {
    if (DATE_ONLY.test(node)) return shiftDateOnly(node, days);
    if (ISO_TS.test(node)) return shiftTimestamp(node, days);
    return node;
  }
  if (Array.isArray(node)) return node.map((n) => walk(n, days));
  if (node && typeof node === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node)) out[k] = walk(v, days);
    return out;
  }
  return node;
}

/** Shift every date-shaped string in the parsed seed by (today − SEED_ANCHOR) days. */
export function rebaseExampleDates<T>(data: T): T {
  const days = anchorOffsetDays();
  if (days === 0) return data;
  return walk(data, days) as T;
}
