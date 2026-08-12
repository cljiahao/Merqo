// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import DashboardLoading from "./loading";

describe("DashboardLoading", () => {
  it("renders a max-w-7xl skeleton matching the real page's content width", () => {
    const { container } = render(<DashboardLoading />);
    expect(container.querySelector("div.max-w-7xl")).toBeInTheDocument();
  });
});
