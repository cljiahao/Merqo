import { describe, it, expect, vi, afterEach } from "vitest";
import { requestKitDowngrade } from "@/lib/downgrade-request";

const kit = {
  app_url: "https://qkit-sg.vercel.app",
  metrics_secret: "s",
};

afterEach(() => vi.restoreAllMocks());

describe("requestKitDowngrade", () => {
  it("posts to the kit's downgrade-request endpoint with the bearer and email", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ success: true }), { status: 200 }),
      );
    const r = await requestKitDowngrade(kit, "a@x.com");
    expect(r).toEqual({ success: true });
    const [url, init] = fetchSpy.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe(
      "https://qkit-sg.vercel.app/api/merqo/downgrade-request",
    );
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer s",
    );
    expect(JSON.parse(init.body as string)).toEqual({ email: "a@x.com" });
  });

  it("returns success:false on a 401", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { status: 401 }),
    );
    const r = await requestKitDowngrade(kit, "a@x.com");
    expect(r.success).toBe(false);
  });

  it("returns success:false on a 404 (no matching vendor)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ success: false, error: "No matching vendor" }),
        {
          status: 404,
        },
      ),
    );
    const r = await requestKitDowngrade(kit, "a@x.com");
    expect(r.success).toBe(false);
  });

  it("returns success:false when fetch throws (kit unreachable)", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("ECONNREFUSED"));
    const r = await requestKitDowngrade(kit, "a@x.com");
    expect(r.success).toBe(false);
  });

  it("returns success:false when the 200 body isn't valid JSON", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("<html>502</html>", { status: 200 }),
    );
    const r = await requestKitDowngrade(kit, "a@x.com");
    expect(r.success).toBe(false);
  });

  it("returns success:false when the kit has no app_url or metrics_secret (never calls fetch)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const r = await requestKitDowngrade(
      { app_url: null, metrics_secret: null },
      "a@x.com",
    );
    expect(r.success).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
