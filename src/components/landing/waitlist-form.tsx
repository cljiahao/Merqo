"use client";
import { useActionState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { joinKitWaitlist, WAITLIST_IDLE } from "@/app/actions/waitlist";
import { Button } from "@/components/ui/button";

/** The only client component on the landing — a one-field email capture for a
 *  "coming soon" kit. Progressive: works as a plain form action. */
export function WaitlistForm({ slug }: { slug: string }) {
  const [state, action, pending] = useActionState(
    joinKitWaitlist,
    WAITLIST_IDLE,
  );

  if (state.status === "success") {
    return (
      <p
        role="status"
        className="flex items-center gap-2 text-sm font-medium text-primary"
      >
        <Check className="size-4 shrink-0" />
        {state.message}
      </p>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-1.5">
      <input type="hidden" name="slug" value={slug} />
      <div className="flex gap-2">
        <label htmlFor={`waitlist-${slug}`} className="sr-only">
          Email for {slug} early access
        </label>
        <input
          id={`waitlist-${slug}`}
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@business.sg"
          className="h-9 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
        <Button type="submit" size="sm" variant="secondary" disabled={pending}>
          {pending ? (
            "…"
          ) : (
            <>
              Notify me
              <ArrowRight className="size-3.5" />
            </>
          )}
        </Button>
      </div>
      {state.status === "error" && (
        <p role="alert" className="text-xs text-destructive">
          {state.message}
        </p>
      )}
    </form>
  );
}
