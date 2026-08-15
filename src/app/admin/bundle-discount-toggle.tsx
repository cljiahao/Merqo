"use client";

import { toast } from "sonner";
import { useAsyncAction } from "@/hooks/use-async-action";
import { Switch } from "@/components/ui/switch";
import { setBundleDiscountEnabledAction } from "./actions";

/** Founding-price lever: the 15/25/30% cross-kit bundle discount ships
 * off by default (no data yet on whether it's needed to drive multi-kit
 * attach) - this flips it on when the ecosystem is ready. No kit reads
 * this flag yet; the discount math itself is separate, Phase 3-gated
 * work. See docs/superpowers/specs/2026-08-16-bundle-discount-toggle-design.md. */
export function BundleDiscountToggle({ enabled }: { enabled: boolean }) {
  const { pending, run } = useAsyncAction();

  function onCheckedChange(next: boolean) {
    if (pending) return;
    run(async () => {
      const res = await setBundleDiscountEnabledAction(next);
      if (res.success) {
        toast.success(
          next ? "Bundle discount enabled" : "Bundle discount disabled",
        );
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border bg-card p-4">
      <div>
        <p className="text-sm font-medium">Cross-kit bundle discount</p>
        <p className="text-sm text-muted-foreground">
          {enabled
            ? "On — vendors get 15/25/30% off at 2/3/4 active kits."
            : "Off — vendors pay full price per kit."}
        </p>
      </div>
      <Switch
        checked={enabled}
        disabled={pending}
        onCheckedChange={onCheckedChange}
        aria-label="Cross-kit bundle discount"
      />
    </div>
  );
}
