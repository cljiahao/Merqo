import { describe, it, expect } from "vitest";
import { computeTrend, timeAgo } from "@/lib/format";

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

describe("timeAgo", () => {
  const now = Date.parse("2026-07-26T12:00:00Z");

  it("floors under a minute to 'just now'", () => {
    expect(timeAgo("2026-07-26T11:59:31Z", now)).toBe("just now");
  });

  it("reports whole minutes", () => {
    expect(timeAgo("2026-07-26T11:57:00Z", now)).toBe("3m ago");
  });

  it("reports whole hours once past 60 minutes", () => {
    expect(timeAgo("2026-07-26T09:30:00Z", now)).toBe("2h ago");
  });

  it("reports whole days once past 24 hours", () => {
    expect(timeAgo("2026-07-23T12:00:00Z", now)).toBe("3d ago");
  });

  it("floors a future timestamp (clock skew) to 'just now'", () => {
    expect(timeAgo("2026-07-26T12:05:00Z", now)).toBe("just now");
  });

  it("returns an em dash for an unparseable timestamp", () => {
    expect(timeAgo("not-a-date", now)).toBe("—");
  });
});
