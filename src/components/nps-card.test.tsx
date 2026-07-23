// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { NpsCard } from "./nps-card";

describe("NpsCard", () => {
  it("shows a dash and zero responses when there are no scores", () => {
    render(<NpsCard title="Test kit" scores={[]} />);
    expect(screen.getByText("-")).toBeInTheDocument();
    expect(screen.getByText("0 responses")).toBeInTheDocument();
  });

  it("computes and shows the NPS score for a mix of scores", () => {
    render(<NpsCard title="Test kit" scores={[10, 10, 0]} />);
    expect(screen.getByText("33")).toBeInTheDocument();
    expect(screen.getByText("3 responses")).toBeInTheDocument();
    expect(screen.getByText("1 detractors")).toBeInTheDocument();
  });

  it("shows the given title", () => {
    render(<NpsCard title="loopkit" scores={[9]} />);
    expect(screen.getByText("loopkit")).toBeInTheDocument();
  });

  it("renders the passives bar segment and label when a score falls in the passive range", () => {
    render(<NpsCard title="Test kit" scores={[10, 8, 0]} />);
    expect(screen.getByText("1 passive")).toBeInTheDocument();
    expect(screen.getByText("1 detractors")).toBeInTheDocument();
    expect(screen.getByText("1 promoters")).toBeInTheDocument();
  });
});
