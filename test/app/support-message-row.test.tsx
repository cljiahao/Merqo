// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SupportMessageRow } from "@/app/admin/support-message-row";
import type { OpenSupportMessage } from "@/lib/support";

vi.mock("@/app/admin/actions", () => ({
  resolveSupportMessageAction: vi.fn(),
}));

const BASE: OpenSupportMessage = {
  id: "m1",
  email: "vendor@example.com",
  kit_slug: "paykit",
  category: "payment",
  body: "My QR isn't generating.",
  created_at: "2026-07-23T00:00:00.000Z",
};

describe("SupportMessageRow", () => {
  it("renders the kit slug, category, and body for a kit-specific message", () => {
    render(<SupportMessageRow message={BASE} />);
    expect(screen.getByText("vendor@example.com")).toBeInTheDocument();
    expect(screen.getByText("paykit", { exact: false })).toBeInTheDocument();
    expect(
      screen.getByText(/payment — my qr isn't generating\./i),
    ).toBeInTheDocument();
  });

  it("renders 'merqo' for a hub-level message with a null kit_slug", () => {
    render(<SupportMessageRow message={{ ...BASE, kit_slug: null }} />);
    expect(screen.getByText("merqo", { exact: false })).toBeInTheDocument();
  });

  it("renders 'Unknown' when the email couldn't be resolved", () => {
    render(<SupportMessageRow message={{ ...BASE, email: null }} />);
    expect(screen.getByText("Unknown")).toBeInTheDocument();
  });
});
