import type { KitTile } from "@/lib/vendor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UpgradeButton } from "./upgrade-button";
import { DowngradeButton } from "./downgrade-button";

export function VendorKitCard({ tile }: { tile: KitTile }) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-lg font-bold">{tile.name}</h3>
        <div className="flex items-center gap-1.5">
          {tile.plan === "pro" && <Badge variant="gold">Pro</Badge>}
          {tile.plan === "free" && <Badge variant="muted">Free</Badge>}
          <Badge variant="success">Live</Badge>
        </div>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{tile.tagline}</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {tile.href && (
          <Button asChild size="sm">
            <a href={`${tile.href}/dashboard`} target="_blank" rel="noreferrer">
              Open {tile.name}
            </a>
          </Button>
        )}
        {tile.plan === "free" && <UpgradeButton slug={tile.slug} />}
        {tile.plan === "pro" && <DowngradeButton slug={tile.slug} />}
      </div>
    </div>
  );
}
