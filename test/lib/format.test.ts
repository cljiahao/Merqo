import { describe, it, expect } from "vitest";
import { computeTrend } from "@/lib/format";

describe("computeTrend", () => {
  it("reports an increase", () => {
    expect(computeTrend(120, 100)).toEqual({ direction: "up", pct: 20 });
  });

  it("reports a decrease", () => {
    expect(computeTrend(80, 100)).toEqual({ direction: "down", pct: 20 });
  });

  it("reports flat when unchanged and nonzero", () => {
    expect(computeTrend(50, 50)).toEqual({ direction: "flat", pct: 0 });
  });

  it("reports flat with a null pct when both are zero", () => {
    expect(computeTrend(0, 0)).toEqual({ direction: "flat", pct: null });
  });

  it("reports up with a null pct when previous is zero but current is not", () => {
    expect(computeTrend(5, 0)).toEqual({ direction: "up", pct: null });
  });
});
