"use client";

import { useState, useTransition } from "react";
import { requestDowngrade } from "@/app/actions/downgrade";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

/** Confirm an immediate move to Free and show the result inline. */
export function DowngradeButton({ slug }: { slug: string }) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<"idle" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  function onConfirm() {
    startTransition(async () => {
      try {
        const res = await requestDowngrade(slug);
        if (res.success) {
          setState("done");
        } else {
          setState("error");
          setError(res.error);
        }
      } catch {
        setState("error");
        setError("Unable to cancel Pro. Please try again.");
      }
    });
  }

  if (state === "done") {
    return (
      <p className="text-sm font-medium text-muted-foreground">
        Cancelled — you&apos;re back on Free.
      </p>
    );
  }

  return (
    <div>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <button
            type="button"
            disabled={pending}
            className="text-sm font-medium text-foreground hover:underline disabled:opacity-60"
          >
            {pending ? "Cancelling…" : "Cancel Pro"}
          </button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel your Pro subscription?</AlertDialogTitle>
            <AlertDialogDescription>
              You&apos;ll be moved back to the free tier immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Never mind</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirm}>
              Cancel subscription
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {state === "error" && error && (
        <p className="mt-1 text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}
