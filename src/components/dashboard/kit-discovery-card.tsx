import type { Kit } from "@/lib/kits";
import { KIT_PREVIEWS } from "./kit-previews";

/** One discovery-bucket card — used for all three of /dashboard's
 *  "Explore more kits" subsections (Ready to add / Coming soon / Planned)
 *  and the single featured card on /dashboard/pending. The `cta` slot is
 *  omitted entirely for planned kits (no real action exists for them yet).
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
    <div className="group rounded-xl border bg-card p-5 shadow-[0_0_0_1px_rgba(0,0,0,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
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
