"use client";
import { Button } from "@/components/ui/button";
import { ConfirmAdminAction } from "../confirm-admin-action";
import { revokeKitAction } from "./actions";
export function RevokeButton({ email, slug }: { email: string; slug: string }) {
  return (
    <ConfirmAdminAction
      trigger={
        <Button
          type="button"
          variant="ghost"
          size="xs"
          aria-label={`Revoke ${slug} from ${email}`}
          className="text-muted-foreground hover:text-destructive"
        >
          Revoke
        </Button>
      }
      title={
        <>
          Revoke {slug} from {email}?
        </>
      }
      description={
        <>
          This removes the vendor&apos;s access and waitlist entry for this kit.
          You can grant it again later.
        </>
      }
      action={() => {
        const data = new FormData();
        data.set("email", email);
        data.set("slug", slug);
        return revokeKitAction(data);
      }}
      successMessage={`Revoked ${slug} from ${email}`}
      confirmLabel="Revoke"
      pendingLabel="Revoking…"
    />
  );
}
