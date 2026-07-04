import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { metricsPayloadSchema } from "@/lib/metrics-schema";

// NOTE: hand-authored to match the locked contract (plan Global Constraints).
// When qkit's real endpoint is wired, replace this with a captured live response:
//   curl -s -H "Authorization: Bearer $MERQO_METRICS_SECRET" <qkit>/api/merqo/metrics
const sample = JSON.parse(
  readFileSync(fileURLToPath(new URL("./qkit-metrics.sample.json", import.meta.url)), "utf8"),
);

describe("qkit /api/merqo/metrics contract", () => {
  it("qkit's payload satisfies merqo's consumer schema", () => {
    const parsed = metricsPayloadSchema.safeParse(sample);
    expect(parsed.success, JSON.stringify(parsed.error?.format())).toBe(true);
  });
  it("declares product qkit", () => {
    expect(sample.product).toBe("qkit");
  });
});
