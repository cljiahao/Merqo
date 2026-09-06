// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import EndCustomerNoticePage from "./page";

describe("EndCustomerNoticePage", () => {
  it("renders the end-customer notice via LegalDocument", () => {
    render(<EndCustomerNoticePage />);
    expect(screen.getByText("Who Merqo is")).toBeInTheDocument();
  });
});
