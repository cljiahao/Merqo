import { describe, it, expect } from "vitest";
import { npsBreakdown } from "@/lib/nps";

describe("npsBreakdown", () => {
  it("returns a null score for no responses", () => {
    expect(npsBreakdown([])).toEqual({
      total: 0,
      promoters: 0,
      passives: 0,
      detractors: 0,
      score: null,
    });
  });

  it("scores 100 when every response is a promoter", () => {
    expect(npsBreakdown([9, 10, 9]).score).toBe(100);
  });

  it("scores -100 when every response is a detractor", () => {
    expect(npsBreakdown([0, 3, 6]).score).toBe(-100);
  });

  it("computes a mixed score correctly", () => {
    const r = npsBreakdown([9, 10, 7, 2]);
    expect(r).toEqual({
      total: 4,
      promoters: 2,
      passives: 1,
      detractors: 1,
      score: 25,
    });
  });

  it("skips out-of-range or non-finite scores", () => {
    expect(npsBreakdown([11, -1, NaN, 8]).total).toBe(1);
  });
});
