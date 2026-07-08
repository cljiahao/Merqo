import { KITS } from "@/lib/kits";
import { cn } from "@/lib/utils";

const ORDER = KITS.map((k) => ({ slug: k.slug, status: k.status }));

export function Timeline() {
  return (
    <div className="mt-6 px-1">
      <div className="relative flex items-start justify-between">
        <div className="absolute inset-x-2 top-[5px] h-px bg-border" />
        {ORDER.map((k) => (
          <div
            key={k.slug}
            className="relative flex flex-col items-center gap-1.5"
          >
            <span
              className={cn(
                "size-2.5 rounded-full ring-4 ring-card",
                k.status === "live"
                  ? "bg-gold"
                  : k.status === "coming"
                    ? "bg-primary"
                    : "bg-border",
              )}
            />
            <span
              className={cn(
                "font-mono text-[10px]",
                k.status === "live"
                  ? "font-semibold text-foreground"
                  : "text-muted-foreground",
              )}
            >
              {k.slug}
            </span>
            {k.status === "live" && (
              <span className="text-[9px] text-muted-foreground">now</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
