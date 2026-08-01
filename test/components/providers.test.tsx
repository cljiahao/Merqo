// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Providers } from "@/components/providers";

describe("Providers", () => {
  it("renders children within the tooltip provider", () => {
    render(
      <Providers>
        <p>content</p>
      </Providers>,
    );
    expect(screen.getByText("content")).toBeInTheDocument();
  });
});
