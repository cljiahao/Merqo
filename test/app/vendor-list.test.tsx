// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@/app/admin/vendors/actions", () => ({
  grantKitAction: vi.fn(),
  revokeKitAction: vi.fn(),
}));

import { VendorList } from "@/app/admin/vendors/vendor-list";

const grants = [
  {
    email: "alice@x.sg",
    kits: [{ slug: "qkit", name: "qkit", status: "active" as const }],
  },
  {
    email: "bob@x.sg",
    kits: [{ slug: "loopkit", name: "loopkit", status: "waitlist" as const }],
  },
];
const products = [
  { slug: "qkit", name: "qkit" },
  { slug: "loopkit", name: "loopkit" },
];

describe("VendorList", () => {
  it("renders every vendor with no filters applied", () => {
    render(<VendorList grants={grants} products={products} />);
    expect(screen.getByText("alice@x.sg")).toBeInTheDocument();
    expect(screen.getByText("bob@x.sg")).toBeInTheDocument();
  });

  it("narrows the list as the search box is typed into", () => {
    render(<VendorList grants={grants} products={products} />);
    fireEvent.change(screen.getByPlaceholderText("Search by email…"), {
      target: { value: "alice" },
    });
    expect(screen.getByText("alice@x.sg")).toBeInTheDocument();
    expect(screen.queryByText("bob@x.sg")).not.toBeInTheDocument();
  });

  it("shows a no-match message when filters exclude everyone", () => {
    render(<VendorList grants={grants} products={products} />);
    fireEvent.change(screen.getByPlaceholderText("Search by email…"), {
      target: { value: "nobody" },
    });
    expect(
      screen.getByText("No vendors match these filters."),
    ).toBeInTheDocument();
  });

  it("shows the empty-list message when there are no grants at all", () => {
    render(<VendorList grants={[]} products={products} />);
    expect(screen.getByText("No vendor links yet.")).toBeInTheDocument();
  });
});
