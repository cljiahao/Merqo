import type { MetricsResult } from "@/lib/metrics-client";

export type HealthStatus = "reporting" | "lagging" | "down";

/** A metrics call slower than this (ms) is degraded, though still succeeding. */
export const LAGGING_MS = 2000;
/** Data older than this (ms) means the kit stopped reporting recently. */
export const FRESHNESS_MS = 15 * 60_000;

/**
 * Classify a kit's health from its last metrics fetch. `now` is passed in (epoch
 * ms) rather than read from the clock so the function is pure and testable.
 */
export function classifyHealth(
  result: MetricsResult,
  now: number,
): HealthStatus {
  if (!result.ok) return "down";
  // Latency at or over the threshold is already degraded; freshness only trips once data is strictly older than the window.
  if (result.durationMs >= LAGGING_MS) return "lagging";
  const generatedMs = Date.parse(result.data.generated_at);
  if (Number.isNaN(generatedMs)) return "lagging";
  if (now - generatedMs > FRESHNESS_MS) return "lagging";
  return "reporting";
}
