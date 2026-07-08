// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@/app/actions/waitlist", () => ({
  joinKitWaitlist: vi.fn(),
  WAITLIST_IDLE: { status: "idle" },
}));

import { KitStacker } from "@/components/landing/kit-stacker/kit-stacker";

describe("KitStacker", () => {
  it("starts with only qkit stacked, but qkit is removable like any kit", () => {
    render(<KitStacker />);
    expect(screen.getByText(/Your stack has 1 kit:/)).toHaveTextContent(
      /Queue/,
    );
    // no flagship: qkit's toggle is a normal, enabled button
    expect(
      screen.getByRole("button", { name: /Remove qkit from the stack/i }),
    ).toBeEnabled();
  });

  it("adds a kit and surfaces its connection when a module is clicked", () => {
    render(<KitStacker />);
    fireEvent.click(
      screen.getByRole("button", { name: /Add loopkit to the stack/i }),
    );
    expect(screen.getByText(/Your stack has 2 kits:/)).toBeInTheDocument();
    // the relationship shows in the a11y summary and the block tower
    expect(
      screen.getAllByText(/Finished orders earn loyalty points/i).length,
    ).toBeGreaterThan(0);
  });

  it("stacks every kit with Stack all", () => {
    render(<KitStacker />);
    fireEvent.click(screen.getByRole("button", { name: "Stack all" }));
    expect(screen.getByText(/Your stack has 6 kits:/)).toBeInTheDocument();
  });

  it("removes qkit itself, since no kit is a required flagship", () => {
    render(<KitStacker />);
    fireEvent.click(
      screen.getByRole("button", { name: /Remove qkit from the stack/i }),
    );
    expect(screen.getByText(/Your stack has 0 kits:/)).toBeInTheDocument();
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
