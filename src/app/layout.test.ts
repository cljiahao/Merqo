import { describe, it, expect, vi } from "vitest";
import type { ReactElement } from "react";

vi.mock("next/font/google", () => ({
  Geist: () => ({ variable: "--font-geist-sans" }),
  Geist_Mono: () => ({ variable: "--font-geist-mono" }),
  Fraunces: () => ({ variable: "--font-fraunces" }),
}));

const { metadata, default: RootLayout } = await import("./layout");

describe("root layout metadata", () => {
  it("sets the browser-tab title", () => {
    expect(metadata.title).toEqual({
      default: "Merqo | Hub For Small-Business Kits",
      template: "%s · Merqo",
    });
  });
});

describe("RootLayout", () => {
  it("wraps children in a system-default, class-attribute next-themes ThemeProvider", () => {
    const html = RootLayout({
      children: "child",
    }) as ReactElement<{
      suppressHydrationWarning?: boolean;
      children: ReactElement<{ children: ReactElement }>;
    }>;
    expect(html.props.suppressHydrationWarning).toBe(true);

    const body = html.props.children;
    const themeProvider = body.props.children as ReactElement<{
      attribute: string;
      defaultTheme: string;
      enableSystem: boolean;
      disableTransitionOnChange: boolean;
      children: ReactElement<{ children: unknown }>;
    }>;
    expect(themeProvider.props).toMatchObject({
      attribute: "class",
      defaultTheme: "system",
      enableSystem: true,
      disableTransitionOnChange: true,
    });

    const providers = themeProvider.props.children;
    expect(providers.props.children).toBe("child");
  });
});
