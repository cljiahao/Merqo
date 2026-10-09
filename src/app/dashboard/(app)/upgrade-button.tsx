"use client";

import { useState, useTransition } from "react";
import { requestUpgrade } from "@/app/actions/upgrade";

/** Request monthly Pro without leaving the dashboard; show the result inline. */
export function UpgradeButton({ slug }: { slug: string }) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<"idle" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  function onClick() {
    startTransition(async () => {
      try {
        const res = await requestUpgrade(slug);
        if (res.success) {
          setState("sent");
        } else {
          setState("error");
          setError(res.error);
        }
      } catch {
        setState("error");
        setError("Unable to request an upgrade. Please try again.");
      }
    });
  }

  if (state === "sent") {
    return (
      <p className="text-sm font-medium text-muted-foreground">
        Request sent — we&apos;ll set you up shortly.
      </p>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="text-sm font-medium text-foreground hover:underline disabled:opacity-60"
      >
        {pending ? "Sending…" : "Upgrade to Pro"}
      </button>
      {state === "error" && error && (
        <p className="mt-1 text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}
