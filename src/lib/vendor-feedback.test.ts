import { describe, it, expect } from "vitest";
import {
  groupVendorFeedbackByKit,
  type VendorFeedbackRow,
} from "./vendor-feedback";

function row(overrides: Partial<VendorFeedbackRow>): VendorFeedbackRow {
  return {
    id: "1",
    kit_slug: "loopkit",
    nps: 9,
    message: null,
    created_at: "2026-07-23T00:00:00Z",
    ...overrides,
  };
}

describe("groupVendorFeedbackByKit", () => {
  it("groups rows by kit_slug, preserving each row's order within its group", () => {
    const rows = [
      row({ id: "1", kit_slug: "paykit" }),
      row({ id: "2", kit_slug: "loopkit" }),
      row({ id: "3", kit_slug: "loopkit" }),
    ];
    const grouped = groupVendorFeedbackByKit(rows);
    expect(grouped.get("loopkit")?.map((r) => r.id)).toEqual(["2", "3"]);
    expect(grouped.get("paykit")?.map((r) => r.id)).toEqual(["1"]);
  });

  it("orders kit groups alphabetically regardless of input order", () => {
    const rows = [
      row({ id: "1", kit_slug: "stockkit" }),
      row({ id: "2", kit_slug: "loopkit" }),
      row({ id: "3", kit_slug: "paykit" }),
    ];
    const grouped = groupVendorFeedbackByKit(rows);
    expect([...grouped.keys()]).toEqual(["loopkit", "paykit", "stockkit"]);
  });

  it("returns an empty map for no rows", () => {
    expect(groupVendorFeedbackByKit([]).size).toBe(0);
  });
});
