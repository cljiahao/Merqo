import { describe, it, expect } from "vitest";
import { qrSvg } from "./qr";

describe("qrSvg", () => {
  it("renders an SVG markup string for the given text", async () => {
    const svg = await qrSvg("https://t.me/MerqoNotifyBot?start=abc123");
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
  });
});
