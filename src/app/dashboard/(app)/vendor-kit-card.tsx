import type { KitTile } from "@/lib/vendor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function VendorKitCard({ tile }: { tile: KitTile }) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-lg font-bold">{tile.name}</h3>
        <Badge variant="success">Live</Badge>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{tile.tagline}</p>
      {tile.href && (
        <Button asChild size="sm" className="mt-4">
          <a href={tile.href} target="_blank" rel="noreferrer">
            Open {tile.name}
          </a>
        </Button>
      )}
    </div>
  );
}
