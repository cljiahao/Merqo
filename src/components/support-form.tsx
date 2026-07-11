"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { submitSupportMessageAction } from "@/app/actions/support";
import {
  SUPPORT_CATEGORY_LABELS,
  type SupportMessageInput,
} from "@/lib/feedback-support-schemas";

const CATEGORIES = (
  Object.keys(SUPPORT_CATEGORY_LABELS) as SupportMessageInput["category"][]
).map((value) => ({ value, label: SUPPORT_CATEGORY_LABELS[value] }));

/** Hub-level vendor/team → Merqo help request. Ported from qkit's own
 *  SupportForm — pick what it's about, say what's wrong; the Merqo team
 *  picks it up on /admin. Sits in a Sheet off the account menu. */
export function SupportForm() {
  const [category, setCategory] =
    useState<SupportMessageInput["category"]>("vendor_access");
  const [body, setBody] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();

  function send() {
    if (!body.trim()) {
      toast.error("Tell us what's wrong");
      return;
    }
    start(async () => {
      const res = await submitSupportMessageAction({
        category,
        body: body.trim(),
      });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      setSent(true);
    });
  }

  if (sent) {
    return (
      <div className="rounded-xl border bg-card px-4 py-3 text-center text-sm text-muted-foreground">
        Got it — we&apos;ll look into this and follow up.
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <div>
        <p className="mb-2 text-sm font-medium">What&apos;s it about?</p>
        <div
          className="grid grid-cols-2 gap-1.5"
          role="radiogroup"
          aria-label="What's it about?"
        >
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              type="button"
              role="radio"
              aria-checked={category === c.value}
              onClick={() => setCategory(c.value)}
              className={cn(
                "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                category === c.value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/50 hover:bg-primary/5",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        aria-label="Describe the problem"
        placeholder="What happened? The more detail, the faster we can help."
        rows={4}
        maxLength={2000}
        className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      />
      <Button
        type="button"
        className="h-11 w-full rounded-xl font-semibold"
        onClick={send}
        disabled={pending}
      >
        {pending ? "Sending…" : "Send message"}
      </Button>
    </div>
  );
}
