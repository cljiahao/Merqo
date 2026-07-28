"use client";

import { useState, useTransition } from "react";
import { activateKitsAction } from "@/app/actions/activate-kits";
import { Button } from "@/components/ui/button";
import type { ProvisionResult } from "@/lib/vendor-sync";

/** Bulk ("Activate all my kits", multiple slugs) or single-kit ("Add
 *  {kit}", one slug) activation button — same component, driven entirely
 *  by `slugs`, never a hardcoded count. Renders per-kit failure/retry
 *  affordances rather than one aggregate success/error message — a
 *  partial failure must never look like a page-level error. */
export function ActivateKitsButton({
  slugs,
  label,
}: {
  slugs: string[];
  label: string;
}) {
  const [pending, startTransition] = useTransition();
  const [results, setResults] = useState<ProvisionResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function activate(targetSlugs: string[]) {
    startTransition(async () => {
      const res = await activateKitsAction(targetSlugs);
      if (res.success) {
        setError(null);
        setResults((prev) => {
          const bySlug = new Map((prev ?? []).map((r) => [r.slug, r]));
          for (const r of res.results) bySlug.set(r.slug, r);
          return Array.from(bySlug.values());
        });
      } else {
        setError(res.error);
      }
    });
  }

  const failed = (results ?? []).filter((r) => !r.ok);

  return (
    <div>
      <Button type="button" onClick={() => activate(slugs)} disabled={pending}>
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
    </div>
  );
}
