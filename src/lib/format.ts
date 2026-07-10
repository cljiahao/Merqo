/** Cents → a plain "$1,234" string. Shared by the team overview + product cards. */
export const money = (cents: number) => `$${(cents / 100).toLocaleString()}`;

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
