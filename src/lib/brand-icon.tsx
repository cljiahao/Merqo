import type { ReactElement } from "react";

// Merqo's own mark, approximated from the OKLCH theme tokens as
// concrete hex — ImageResponse needs literal CSS colors.
export const BRAND_PINE = "#2f6b57";
export const BRAND_GOLD = "#d9a94a";

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
        fontFamily: "system-ui, sans-serif",
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
