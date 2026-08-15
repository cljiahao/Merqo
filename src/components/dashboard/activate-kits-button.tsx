"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { activateKitsAction } from "@/app/actions/activate-kits";
import { Button } from "@/components/ui/button";
import { KITS } from "@/lib/kits";
import type { ProvisionResult } from "@/lib/vendor-sync";

type ButtonVariant = React.ComponentProps<typeof Button>["variant"];
type ButtonSize = React.ComponentProps<typeof Button>["size"];

/** Merges a new activation batch into the running per-kit results, keyed by
 *  slug so a retry replaces its kit's prior entry instead of duplicating it. */
function mergeResults(
  prev: ProvisionResult[] | null,
  incoming: ProvisionResult[],
): ProvisionResult[] {
  const bySlug = new Map((prev ?? []).map((r) => [r.slug, r]));
  for (const r of incoming) bySlug.set(r.slug, r);
  return Array.from(bySlug.values());
}

/** Bulk ("Activate all my kits", multiple slugs) or single-kit ("Add
 *  {kit}", one slug) activation button — same component, driven entirely
 *  by `slugs`, never a hardcoded count. Renders per-kit failure/retry and
 *  per-kit needs-setup affordances rather than one aggregate message — a
 *  partial failure (or a kit that only reached needs_setup) must never
 *  look like a full success or a page-level error. `variant`/`size`
 *  default to the `<Button>` defaults (primary) so the bulk CTA reads as
 *  primary out of the box; call sites that want the smaller secondary
 *  per-kit look (matching `JoinWaitlistButton`) pass `variant="secondary"
 *  size="sm"` explicitly. */
export function ActivateKitsButton({
  slugs,
  label,
  variant,
  size,
}: {
  slugs: string[];
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [results, setResults] = useState<ProvisionResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function activate(targetSlugs: string[]) {
    startTransition(async () => {
      const res = await activateKitsAction(targetSlugs);
      if (res.success) {
        setError(null);
        setResults((prev) => mergeResults(prev, res.results));
        const byTargetSlug = new Map(res.results.map((r) => [r.slug, r]));
        const allSucceeded = targetSlugs.every(
          (slug) => byTargetSlug.get(slug)?.ok === true,
        );
        if (allSucceeded) {
          const anyNeedsSetup = targetSlugs.some((slug) => {
            const r = byTargetSlug.get(slug);
            return r?.ok === true && r.needsSetup === true;
          });
          if (!anyNeedsSetup) {
            toast.success(`Activated ${targetSlugs.join(", ")}`);
          }
          router.refresh();
        }
      } else {
        setError(res.error);
      }
    });
  }

  const failed = (results ?? []).filter((r) => !r.ok);
  const needsSetup = (results ?? []).filter(
    (r): r is Extract<ProvisionResult, { ok: true }> =>
      r.ok && r.needsSetup === true,
  );

  return (
    <div>
      <Button
        type="button"
        variant={variant}
        size={size}
        onClick={() => activate(slugs)}
        disabled={pending}
      >
        {pending ? "Activating…" : label}
      </Button>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
      {failed.length > 0 && (
        <ul className="mt-2 space-y-1">
          {failed.map((r) => (
            <li key={r.slug} className="text-xs text-destructive">
              Couldn&apos;t activate {r.slug} —{" "}
              <button
                type="button"
                onClick={() => activate([r.slug])}
                disabled={pending}
                className="font-medium underline disabled:opacity-60"
                aria-label={`Retry ${r.slug}`}
              >
                Retry {r.slug}
              </button>
            </li>
          ))}
        </ul>
      )}
      {needsSetup.length > 0 && (
        <ul className="mt-2 space-y-1">
          {needsSetup.map((r) => {
            const kit = KITS.find((k) => k.slug === r.slug);
            return (
              <li key={r.slug} className="text-xs text-muted-foreground">
                {kit?.name ?? r.slug} added — payment setup still needed.{" "}
                {kit?.href && (
                  <a
                    href={`${kit.href}/dashboard/config`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-foreground underline"
                  >
                    Finish payment setup
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
