"use client";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { resolveSupportMessageAction } from "./actions";

/** Mark a hub-level support message resolved once it's been handled. */
export function ResolveSupportMessageButton({ id }: { id: string }) {
  const [pending, start] = useTransition();

  function onClick() {
    start(async () => {
      try {
        const res = await resolveSupportMessageAction(id);
        if (!res.success) {
          toast.error(res.error);
        }
      } catch {
        toast.error("Unable to resolve this message. Please try again.");
      }
    });
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={onClick}
    >
      {pending ? "Resolving…" : "Resolve"}
    </Button>
  );
}
