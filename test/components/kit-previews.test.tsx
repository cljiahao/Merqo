// test/components/kit-previews.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { KIT_PREVIEWS } from "@/components/dashboard/kit-previews";

describe("KIT_PREVIEWS", () => {
  it("has a preview for qkit and loopkit only", () => {
    expect(Object.keys(KIT_PREVIEWS).sort()).toEqual(["loopkit", "qkit"]);
  });

  it("renders the qkit preview without throwing", () => {
    const Preview = KIT_PREVIEWS.qkit;
    const { container } = render(<Preview />);
    expect(container.textContent).toContain("Now serving");
  });

  it("renders the loopkit preview without throwing", () => {
    const Preview = KIT_PREVIEWS.loopkit;
    const { container } = render(<Preview />);
    // 8 stamp circles, 3 filled — assert the filled count specifically, since
    // that's the one detail that makes this read as a real stamp card.
    expect(container.querySelectorAll('[data-filled="true"]')).toHaveLength(3);
    expect(container.querySelectorAll('[data-filled="false"]')).toHaveLength(5);
  });
});
