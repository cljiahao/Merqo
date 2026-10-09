import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  context: vi.fn(),
  active: vi.fn(),
  products: vi.fn(),
  upgrade: vi.fn(),
  downgrade: vi.fn(),
}));
vi.mock("@/lib/vendor", () => ({
  loadVendorContext: mocks.context,
  hasActiveLinkFor: mocks.active,
}));
vi.mock("@/lib/products", () => ({ listLiveProducts: mocks.products }));
vi.mock("@/lib/upgrade-request", () => ({ requestKitUpgrade: mocks.upgrade }));
vi.mock("@/lib/downgrade-request", () => ({
  requestKitDowngrade: mocks.downgrade,
}));
import { requestUpgrade } from "@/app/actions/upgrade";
import { requestDowngrade } from "@/app/actions/downgrade";
const kit = { slug: "qkit" };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.context.mockResolvedValue({
    user: { email: "vendor@example.com" },
    links: [],
  });
  mocks.active.mockReturnValue(true);
  mocks.products.mockResolvedValue([kit]);
  mocks.upgrade.mockResolvedValue({ success: true });
  mocks.downgrade.mockResolvedValue({ success: true });
});
for (const [name, action, sender] of [
  ["upgrade", requestUpgrade, mocks.upgrade],
  ["downgrade", requestDowngrade, mocks.downgrade],
] as const) {
  it(`${name} rejects signed-out callers`, async () => {
    mocks.context.mockResolvedValue({ user: null, links: [] });
    expect(await action("qkit")).toMatchObject({ success: false });
    expect(sender).not.toHaveBeenCalled();
  });
  it(`${name} rejects users without an email`, async () => {
    mocks.context.mockResolvedValue({ user: {}, links: [] });
    expect(await action("qkit")).toMatchObject({ success: false });
  });
  it(`${name} rejects a kit without active access`, async () => {
    mocks.active.mockReturnValue(false);
    expect(await action("qkit")).toMatchObject({ success: false });
    expect(mocks.products).not.toHaveBeenCalled();
  });
  it(`${name} rejects an unregistered kit`, async () => {
    mocks.products.mockResolvedValue([{ slug: "loopkit" }]);
    expect(await action("qkit")).toMatchObject({ success: false });
    expect(sender).not.toHaveBeenCalled();
  });
  it(`${name} uses the signed-in identity`, async () => {
    expect(await action("qkit")).toEqual({ success: true });
    expect(sender).toHaveBeenCalledWith(kit, "vendor@example.com");
  });
  it(`${name} returns a recoverable failure on context outage`, async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.context.mockRejectedValue(new Error("outage"));
    expect(await action("qkit")).toMatchObject({ success: false });
    log.mockRestore();
  });
}
