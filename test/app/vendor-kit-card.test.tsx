// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { VendorKitCard } from "@/app/dashboard/(app)/vendor-kit-card";

describe("VendorKitCard", () => {
  it("applies the hover-lift treatment to the card root", () => {
    render(
      <VendorKitCard
        tile={{
          slug: "qkit",
          name: "qkit",
          tagline: "Take orders and run your queue.",
          href: "https://qkit-sg.vercel.app",
          plan: "free",
        }}
      />,
    );
    const card = screen.getByText("qkit").closest("div")?.parentElement;
    expect(card?.className).toContain("hover:-translate-y-0.5");
    expect(card?.className).toContain("hover:shadow-md");
  });
});
