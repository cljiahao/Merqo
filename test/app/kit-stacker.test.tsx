// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@/app/actions/waitlist", () => ({
  joinKitWaitlist: vi.fn(),
  WAITLIST_IDLE: { status: "idle" },
}));

import { KitStacker } from "@/components/landing/kit-stacker/kit-stacker";

describe("KitStacker", () => {
  it("starts with only qkit and can't remove it", () => {
    render(<KitStacker />);
    expect(screen.getByText(/Your stack has 1 kit:/)).toHaveTextContent(
      /Queue/,
    );
    expect(
      screen.getByRole("button", { name: /always in your stack/i }),
    ).toBeDisabled();
  });

  it("adds a kit and surfaces its connection when a module is clicked", () => {
    render(<KitStacker />);
    fireEvent.click(
      screen.getByRole("button", { name: /Add loopkit to the stack/i }),
    );
    expect(screen.getByText(/Your stack has 2 kits:/)).toBeInTheDocument();
    expect(
      screen.getByText(/Finished orders earn loyalty points/i),
    ).toBeInTheDocument();
  });

  it("stacks every kit with Stack all", () => {
    render(<KitStacker />);
    fireEvent.click(screen.getByRole("button", { name: "Stack all" }));
    expect(screen.getByText(/Your stack has 5 kits:/)).toBeInTheDocument();
  });

  it("removes a kit when toggled off again", () => {
    render(<KitStacker />);
    fireEvent.click(
      screen.getByRole("button", { name: /Add shopkit to the stack/i }),
    );
    expect(screen.getByText(/Your stack has 2 kits:/)).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: /Remove shopkit from the stack/i }),
    );
    expect(screen.getByText(/Your stack has 1 kit:/)).toBeInTheDocument();
  });
});
