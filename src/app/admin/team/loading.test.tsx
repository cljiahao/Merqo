// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import TeamLoading from "./loading";

describe("TeamLoading", () => {
  it("renders a max-w-7xl skeleton matching the real page's content width", () => {
    const { container } = render(<TeamLoading />);
    expect(container.querySelector("main.max-w-7xl")).toBeInTheDocument();
  });
});
