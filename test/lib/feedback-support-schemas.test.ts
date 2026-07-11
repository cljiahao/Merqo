import { describe, it, expect } from "vitest";
import {
  supportMessageSchema,
  feedbackSchema,
  SUPPORT_CATEGORY_LABELS,
} from "@/lib/feedback-support-schemas";

describe("supportMessageSchema", () => {
  it("accepts a valid category and body", () => {
    const r = supportMessageSchema.safeParse({
      category: "billing",
      body: "Help",
    });
    expect(r.success).toBe(true);
  });

  it("rejects an empty body", () => {
    const r = supportMessageSchema.safeParse({
      category: "billing",
      body: "",
    });
    expect(r.success).toBe(false);
  });

  it("rejects an unknown category", () => {
    const r = supportMessageSchema.safeParse({
      category: "nope",
      body: "Help",
    });
    expect(r.success).toBe(false);
  });

  it("rejects a body over 2000 characters", () => {
    const r = supportMessageSchema.safeParse({
      category: "billing",
      body: "a".repeat(2001),
    });
    expect(r.success).toBe(false);
  });
});

describe("feedbackSchema", () => {
  it("accepts a valid nps with no message", () => {
    expect(feedbackSchema.safeParse({ nps: 8 }).success).toBe(true);
  });

  it("accepts an nps with a message", () => {
    expect(
      feedbackSchema.safeParse({ nps: 8, message: "Great!" }).success,
    ).toBe(true);
  });

  it("rejects an nps below 0", () => {
    expect(feedbackSchema.safeParse({ nps: -1 }).success).toBe(false);
  });

  it("rejects an nps above 10", () => {
    expect(feedbackSchema.safeParse({ nps: 11 }).success).toBe(false);
  });

  it("rejects a non-integer nps", () => {
    expect(feedbackSchema.safeParse({ nps: 5.5 }).success).toBe(false);
  });
});

describe("SUPPORT_CATEGORY_LABELS", () => {
  it("has a label for every category in the schema", () => {
    expect(Object.keys(SUPPORT_CATEGORY_LABELS).sort()).toEqual(
      ["billing", "other", "team", "vendor_access"].sort(),
    );
  });
});
