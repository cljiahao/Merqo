"use client";
import { useState } from "react";
import { toast } from "sonner";
import { removeTeamMemberAction } from "./actions";
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

export function RemoveMember({
  userId,
  label,
}: {
  userId: string;
  label: string;
}) {
  const { pending, run } = useAsyncAction();
  const [open, setOpen] = useState(false);

  function onConfirm(e: React.MouseEvent) {
    e.preventDefault();
    if (pending) return;
    run(async () => {
      const formData = new FormData();
      formData.set("user_id", userId);
      const res = await removeTeamMemberAction(formData);
      if (res.success) {
        toast.success(`Removed ${label} from the team`);
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
          size="sm"
          aria-label={`Remove ${label} from the team`}
          className="text-muted-foreground hover:text-destructive"
        >
          Remove
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {label} from the team?</AlertDialogTitle>
          <AlertDialogDescription>
            They&apos;ll lose access to the overview, vendors, and team pages.
            You can add them again later.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={pending}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            {pending ? "Removing…" : "Remove"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
