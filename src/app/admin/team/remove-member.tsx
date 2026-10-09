"use client";
import { Button } from "@/components/ui/button";
import { ConfirmAdminAction } from "../confirm-admin-action";
import { removeTeamMemberAction } from "./actions";
export function RemoveMember({
  userId,
  label,
}: {
  userId: string;
  label: string;
}) {
  return (
    <ConfirmAdminAction
      trigger={
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={`Remove ${label} from the team`}
          className="text-muted-foreground hover:text-destructive"
        >
          Remove
        </Button>
      }
      title={<>Remove {label} from the team?</>}
      description={
        <>
          They&apos;ll lose access to the overview, vendors, and team pages. You
          can add them again later.
        </>
      }
      action={() => {
        const data = new FormData();
        data.set("user_id", userId);
        return removeTeamMemberAction(data);
      }}
      successMessage={`Removed ${label} from the team`}
      confirmLabel="Remove"
      pendingLabel="Removing…"
    />
  );
}
