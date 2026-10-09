"use client";

import { useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useAsyncAction } from "@/hooks/use-async-action";
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

type Result = { success: true } | { success: false; error: string };
interface Props {
  trigger: ReactNode;
  title: ReactNode;
  description: ReactNode;
  action: () => Promise<Result>;
  successMessage: string;
  confirmLabel: string;
  pendingLabel: string;
}

export function ConfirmAdminAction({
  trigger,
  title,
  description,
  action,
  successMessage,
  confirmLabel,
  pendingLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const inFlight = useRef(false);
  const { pending, run } = useAsyncAction();
  async function confirm(event: React.MouseEvent) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      await run(async () => {
        const result = await action();
        if (!result.success) {
          toast.error(result.error);
          return;
        }
        toast.success(successMessage);
        setOpen(false);
      });
    } catch {
      toast.error("Couldn't complete this action. Please try again.");
    } finally {
      inFlight.current = false;
    }
  }
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!inFlight.current) setOpen(next);
      }}
    >
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={confirm}
            disabled={pending}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            {pending ? pendingLabel : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
