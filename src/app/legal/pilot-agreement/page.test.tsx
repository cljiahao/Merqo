// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PilotAgreementPage from "./page";

describe("PilotAgreementPage", () => {
  it("renders the Pilot/UAT Agreement via LegalDocument", () => {
    render(<PilotAgreementPage />);
    expect(screen.getByText("What this pilot is")).toBeInTheDocument();
  });
});
