import type { ReactElement } from "react";

// Merqo's own mark, approximated from the OKLCH theme tokens as
// concrete hex — ImageResponse needs literal CSS colors.
export const BRAND_PINE = "#2f6b57";
export const BRAND_GOLD = "#d9a94a";

/**
 * Merqo's "q" app mark for ImageResponse-generated icons. Merqo's display
 * font is Fraunces (shared family face, see
 * docs/business/2026-08-13-typography-family-standard.md), a serif, so this
 * uses the same Georgia stand-in as qkit.
 */
export function brandIcon(size: number): ReactElement {
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: BRAND_PINE,
        color: BRAND_GOLD,
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontWeight: 700,
        fontSize: size * 0.62,
        lineHeight: 1,
        borderRadius: size * 0.22,
      }}
    >
      q
    </div>
  );
}
