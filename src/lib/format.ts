/** Cents → a plain "$1,234" string. Shared by the team overview + product tiles. */
export const money = (cents: number) => `$${(cents / 100).toLocaleString()}`;

/** A coarse "how long ago" for a trust signal like "Synced 3m ago" — a vendor
 *  doesn't need second-level precision. `now` is passed in (epoch ms) rather
 *  than read from the clock, same convention as health.ts's classifyHealth,
 *  so this stays pure and testable. Clock skew (a future timestamp) floors
 *  at "just now" rather than showing a negative duration. */
export function timeAgo(iso: string, now: number): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "—";
  const diffMs = now - then;
  if (diffMs < 60_000) return "just now";
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export type Trend = { direction: "up" | "down" | "flat"; pct: number | null };

/** Week-over-week (or any current-vs-previous) comparison. `pct` is null
 *  when `previous` is 0 — a percentage change from zero is undefined, and
 *  callers should omit the trend display in that case rather than show a
 *  meaningless number. */
export function computeTrend(current: number, previous: number): Trend {
  if (previous === 0) {
    return { direction: current === 0 ? "flat" : "up", pct: null };
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct > 0) return { direction: "up", pct };
  if (pct < 0) return { direction: "down", pct: Math.abs(pct) };
  return { direction: "flat", pct: 0 };
}
