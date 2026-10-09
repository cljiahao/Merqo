import { cn } from "@/lib/utils";

/** The Merqo wordmark. The `q` carries the brand's origin (qkit / queue), so it
 *  gets the gold accent — the one recurring brand signal. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "font-display text-lg font-extrabold tracking-tight lowercase",
        className,
      )}
    >
      mer<span className="text-gold">q</span>o
    </span>
  );
}
