import { describe, it, expect, vi } from "vitest";

vi.mock("next/font/google", () => ({
  Geist: () => ({ variable: "--font-geist-sans" }),
  Geist_Mono: () => ({ variable: "--font-geist-mono" }),
  Big_Shoulders: () => ({ variable: "--font-big-shoulders" }),
}));

const { metadata } = await import("./layout");

describe("root layout metadata", () => {
  it("sets the browser-tab title", () => {
    expect(metadata.title).toEqual({
      default: "Merqo | Hub For Small-Business Kits",
      template: "%s · Merqo",
    });
  });
});
