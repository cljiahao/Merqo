// @vitest-environment jsdom
import { expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProductHealthCard } from "./product-health-card";
import type { MetricsResult } from "@/lib/metrics-client";
const now = 1700000000000;
const result: MetricsResult = {
  ok: true,
  product: "qkit",
  durationMs: 200,
  data: {
    product: "qkit",
    generated_at: new Date(now).toISOString(),
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
it("shows reporting metrics and freshness diagnostics", () => {
  render(<ProductHealthCard name="Queue" result={result} now={now} />);
  expect(screen.getByText("Reporting")).toBeInTheDocument();
  expect(screen.getByText("200 ms")).toBeInTheDocument();
  expect(screen.getByText("$10")).toBeInTheDocument();
});
it("keeps latency visible for a lagging product", () => {
  render(
    <ProductHealthCard
      name="Queue"
      result={{ ...result, durationMs: 2200 }}
      now={now}
    />,
  );
  expect(screen.getByText("Lagging")).toBeInTheDocument();
  expect(screen.getByText("2200 ms")).toBeInTheDocument();
});
it("shows down status and latency without invented business figures", () => {
  render(
    <ProductHealthCard
      name="Queue"
      result={{
        ok: false,
        product: "qkit",
        durationMs: 5000,
        reason: "unreachable",
      }}
      now={now}
    />,
  );
  expect(screen.getByText("Down")).toBeInTheDocument();
  expect(screen.getByText("5000 ms")).toBeInTheDocument();
  expect(screen.queryByText("$10")).not.toBeInTheDocument();
  expect(screen.getAllByText("—")).toHaveLength(4);
});
