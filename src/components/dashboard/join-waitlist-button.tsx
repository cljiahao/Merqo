"use client";
import { useTransition } from "react";
import { toast } from "sonner";
import { joinWaitlistAction } from "@/app/actions/join-waitlist";
import { Button } from "@/components/ui/button";

export function JoinWaitlistButton({
  slug,
  kitName,
}: {
  slug: string;
  kitName: string;
}) {
  const [pending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      const res = await joinWaitlistAction(slug);
      if (res.success) {
        toast.success(`You're on the waitlist for ${kitName}`);
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      onClick={onClick}
      disabled={pending}
    >
      {pending ? "Joining…" : "Join waitlist"}
    </Button>
  );
}
