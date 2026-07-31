// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { VendorMetricList } from "@/app/dashboard/(app)/vendor-metric-list";

const now = Date.parse("2026-07-26T12:00:00Z");

describe("VendorMetricList", () => {
  it("shows a plain not-connected message when the kit hasn't wired up metrics", () => {
    render(<VendorMetricList result={{ ok: false, slug: "qkit" }} now={now} />);
    expect(
      screen.getByText("Stats aren't connected here yet."),
    ).toBeInTheDocument();
  });

  it("shows the same not-connected message when the payload has zero metrics", () => {
    render(
      <VendorMetricList
        result={{
          ok: true,
          slug: "qkit",
          data: {
            product: "qkit",
            generated_at: "2026-07-26T11:58:00Z",
            metrics: [],
          },
        }}
        now={now}
      />,
    );
    expect(
      screen.getByText("Stats aren't connected here yet."),
    ).toBeInTheDocument();
  });

  it("renders the headline metric, its hint, supporting chips, and freshness", () => {
    render(
      <VendorMetricList
        result={{
          ok: true,
          slug: "qkit",
          data: {
            product: "qkit",
            generated_at: "2026-07-26T11:58:00Z",
            metrics: [
              {
                key: "orders_7d",
                label: "Orders (7d)",
                value: "42",
                hint: "up from 30 last week",
              },
              { key: "avg_wait", label: "Avg wait", value: "6 min" },
            ],
          },
        }}
        now={now}
      />,
    );
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("Orders (7d)")).toBeInTheDocument();
    expect(screen.getByText("up from 30 last week")).toBeInTheDocument();
    expect(screen.getByText("Avg wait")).toBeInTheDocument();
    expect(screen.getByText("6 min")).toBeInTheDocument();
    expect(screen.getByText("As of 2m ago")).toBeInTheDocument();
  });

  it("caps supporting chips at three beyond the headline", () => {
    render(
      <VendorMetricList
        result={{
          ok: true,
          slug: "qkit",
          data: {
            product: "qkit",
            generated_at: "2026-07-26T11:58:00Z",
            metrics: [
              { key: "a", label: "Headline", value: "1" },
              { key: "b", label: "Second", value: "2" },
              { key: "c", label: "Third", value: "3" },
              { key: "d", label: "Fourth", value: "4" },
              { key: "e", label: "Fifth", value: "5" },
            ],
          },
        }}
        now={now}
      />,
    );
    expect(screen.getByText("Second")).toBeInTheDocument();
    expect(screen.getByText("Third")).toBeInTheDocument();
    expect(screen.getByText("Fourth")).toBeInTheDocument();
    expect(screen.queryByText("Fifth")).not.toBeInTheDocument();
  });
});
