// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProductCard } from "@/app/team/product-card";
import type { MetricsResult } from "@/lib/metrics-client";

const okResult: MetricsResult = {
  ok: true,
  product: "qkit",
  data: {
    product: "qkit",
    generated_at: "t",
    revenue_cents_30d: 1000,
    revenue_cents_all: 5000,
    gmv_cents_30d: 2000,
    active_vendors: 3,
    orders_7d: 5,
    orders_prev_7d: 4,
    signups_7d: 2,
    pro_vendors: 1,
    total_vendors: 7,
    pending_upgrade_requests: 4,
    funnel: { signed_up: 7, with_booth: 4, with_order: 3, pro: 1 },
  },
};

describe("ProductCard", () => {
  it("renders live metrics for an ok result", () => {
    render(<ProductCard name="Queue" result={okResult} />);
    expect(screen.getByText("Queue")).toBeInTheDocument();
    // revenue_cents_30d 1000 renders as $10
    expect(screen.getByText("$10")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("renders a degraded Unavailable state and no metric rows when the product is down", () => {
    render(
      <ProductCard
        name="Queue"
        result={{ ok: false, product: "qkit", reason: "unreachable" }}
      />,
    );
    expect(screen.getByText("Unavailable")).toBeInTheDocument();
    expect(screen.queryByText("Revenue (30d)")).not.toBeInTheDocument();
  });

  it("labels an auth failure distinctly", () => {
    render(
      <ProductCard
        name="Queue"
        result={{ ok: false, product: "qkit", reason: "auth" }}
      />,
    );
    expect(screen.getByText("Auth error")).toBeInTheDocument();
  });
});
