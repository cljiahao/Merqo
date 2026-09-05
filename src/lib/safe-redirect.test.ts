import { describe, it, expect } from "vitest";
import { safeRedirectPath } from "./safe-redirect";

describe("safeRedirectPath", () => {
  it("preserves a legitimate relative path with no control characters", () => {
    expect(safeRedirectPath("/admin", "/dashboard")).toBe("/admin");
  });

  it("falls back on a literal absolute URL", () => {
    expect(safeRedirectPath("https://evil.example", "/dashboard")).toBe(
      "/dashboard",
    );
  });

  it("falls back on a literal protocol-relative prefix", () => {
    expect(safeRedirectPath("//evil.example", "/dashboard")).toBe("/dashboard");
    expect(safeRedirectPath("/\\evil.example", "/dashboard")).toBe(
      "/dashboard",
    );
  });

  it("rejects an embedded TAB/LF/CR that URL parsing would strip into a protocol-relative URL", () => {
    expect(safeRedirectPath("/\t/evil.example", "/dashboard")).toBe(
      "/dashboard",
    );
    expect(safeRedirectPath("/\n/evil.example", "/dashboard")).toBe(
      "/dashboard",
    );
    expect(safeRedirectPath("/\r/evil.example", "/dashboard")).toBe(
      "/dashboard",
    );
  });

  it("closes the real bypass: the fallback never resolves off-origin via URL", () => {
    // This is the exact mechanism the re-reviewer used to prove the bypass:
    // Node's URL class strips embedded control characters during parsing,
    // silently turning "/\t/evil.example" into "//evil.example" — a
    // protocol-relative URL that resolves off-origin.
    const bypassAttempt = "/\t/evil.example";
    const rejected = new URL(bypassAttempt, "https://merqo.example/legal");
    expect(rejected.hostname).toBe("evil.example");

    const safe = safeRedirectPath(bypassAttempt, "/dashboard");
    expect(safe).toBe("/dashboard");
    const resolved = new URL(safe, "https://merqo.example/legal");
    expect(resolved.hostname).toBe("merqo.example");
  });
});
