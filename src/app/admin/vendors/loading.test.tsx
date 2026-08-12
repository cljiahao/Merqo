// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import VendorsLoading from "./loading";

describe("VendorsLoading", () => {
  it("renders a max-w-7xl skeleton matching the real page's content width", () => {
    const { container } = render(<VendorsLoading />);
    expect(container.querySelector("main.max-w-7xl")).toBeInTheDocument();
  });
});
