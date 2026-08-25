// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Users } from "lucide-react";
import { StatCard } from "./stat-card";

describe("StatCard", () => {
  it("renders label and value", () => {
    render(<StatCard label="Active vendors" value="42" />);
    expect(screen.getByText("Active vendors")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("renders the icon when provided", () => {
    const { container } = render(
      <StatCard label="Active vendors" value="42" icon={Users} />,
    );
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders an up trend with the accent color", () => {
    render(
      <StatCard
        label="Revenue"
        value="$1,200"
        trend={{ pct: 12, direction: "up" }}
      />,
    );
    const pill = screen.getByText("12%").closest("span");
    expect(pill).toHaveClass("text-primary");
  });

  it("renders a down trend with the destructive color", () => {
    render(
      <StatCard
        label="Revenue"
        value="$1,200"
        trend={{ pct: 8, direction: "down" }}
      />,
    );
    const pill = screen.getByText("8%").closest("span");
    expect(pill).toHaveClass("text-destructive");
  });

  it("renders a flat trend with the muted color, no arrow icon", () => {
    render(
      <StatCard
        label="Revenue"
        value="$1,200"
        trend={{ pct: 0, direction: "flat" }}
      />,
    );
    const pill = screen.getByText("0%").closest("span");
    expect(pill).toHaveClass("text-muted-foreground");
  });

  it("renders nothing trend-related when trend.pct is null", () => {
    render(
      <StatCard
        label="Revenue"
        value="$1,200"
        trend={{ pct: null, direction: "flat" }}
      />,
    );
    expect(screen.queryByText("%", { exact: false })).not.toBeInTheDocument();
  });

  it("applies the accent color to the value when accent is set", () => {
    render(<StatCard label="Revenue" value="$1,200" accent />);
    expect(screen.getByText("$1,200")).toHaveClass("text-primary");
  });
});
