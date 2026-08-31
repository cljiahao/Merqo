import type { Kit } from "@/lib/kits";
import { KIT_PREVIEWS } from "./kit-previews";

/** One discovery-bucket card — used for all three of /dashboard's
 *  "Explore more kits" subsections (Ready to add / Coming soon / Planned).
 *  The `cta` slot is omitted entirely for planned kits (no real action
 *  exists for them yet).
 *  The feature-bullet line is always in the DOM (not conditionally
 *  rendered) — only its opacity is hover-gated, so it stays available to
 *  screen readers and to touch/keyboard users who never trigger :hover. */
export function KitDiscoveryCard({
  kit,
  cta,
}: {
  kit: Kit;
  cta?: React.ReactNode;
}) {
  const Preview = KIT_PREVIEWS[kit.slug];

  return (
    // secondary treatment — a pitch for a kit the vendor doesn't have yet,
    // not their own live kit, so it stays flat rather than competing for attention
    <div className="group rounded-xl border bg-secondary/30 p-5">
      {Preview && (
        <div className="mb-4">
          <Preview />
        </div>
      )}
      <h3 className="font-display text-lg font-bold">{kit.name}</h3>
      <p className="mt-1.5 text-sm text-muted-foreground">{kit.description}</p>
      <p className="mt-2 text-xs text-muted-foreground opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        {kit.features[0]}
      </p>
      {cta && <div className="mt-4">{cta}</div>}
    </div>
  );
}
