// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import ErrorBoundary from "@/app/error";

describe("ErrorBoundary", () => {
  it("shows the branded error message and logs the caught error", () => {
    const error = Object.assign(new Error("boom"), { digest: "abc123" });
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    render(<ErrorBoundary error={error} reset={vi.fn()} />);

    expect(screen.getByText(/that didn't load/i)).toBeInTheDocument();
    expect(consoleError).toHaveBeenCalledWith("Unhandled error", error);

    consoleError.mockRestore();
  });

  it("calls reset when Try again is clicked", async () => {
    const reset = vi.fn();
    const user = userEvent.setup();
    vi.spyOn(console, "error").mockImplementation(() => {});

    render(<ErrorBoundary error={new Error("boom")} reset={reset} />);
    await user.click(screen.getByRole("button", { name: /try again/i }));

    expect(reset).toHaveBeenCalledOnce();
  });
});
