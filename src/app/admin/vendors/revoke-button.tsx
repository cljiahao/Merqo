"use client";
import { useState } from "react";
import { toast } from "sonner";
import { revokeKitAction } from "./actions";
import { useAsyncAction } from "@/hooks/use-async-action";
import { Button } from "@/components/ui/button";
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

export function RevokeButton({ email, slug }: { email: string; slug: string }) {
  const { pending, run } = useAsyncAction();
  const [open, setOpen] = useState(false);

  function onConfirm(e: React.MouseEvent) {
    e.preventDefault();
    if (pending) return;
    run(async () => {
      const formData = new FormData();
      formData.set("email", email);
      formData.set("slug", slug);
      const res = await revokeKitAction(formData);
      if (res.success) {
        toast.success(`Revoked ${slug} from ${email}`);
        setOpen(false);
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          aria-label={`Revoke ${slug} from ${email}`}
          className="text-muted-foreground hover:text-destructive"
        >
          Revoke
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Revoke {slug} from {email}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This removes the vendor&apos;s access and waitlist entry for this
            kit. You can grant it again later.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={pending}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            {pending ? "Revoking…" : "Revoke"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
