import type { Kit } from "@/lib/kits";
import { KIT_PREVIEWS } from "./kit-previews";

/** Shares discovery-card content across buckets; planned kits omit the CTA
 * because they have no available action. */
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
      <p className="mt-2 text-xs text-muted-foreground">{kit.features[0]}</p>
      {cta && <div className="mt-4">{cta}</div>}
    </div>
  );
}
