"use client";
import { useState } from "react";
import { toast } from "sonner";
import { updateDisplayNameAction } from "./actions";
import { useAsyncAction } from "@/hooks/use-async-action";
import { initials } from "@/components/account-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ProfileForm({
  email,
  avatarUrl,
  displayName,
}: {
  email: string | null;
  avatarUrl: string | null;
  displayName: string | null;
}) {
  const { pending, run } = useAsyncAction();
  const [name, setName] = useState(displayName ?? "");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    run(async () => {
      const formData = new FormData();
      formData.set("displayName", name);
      const res = await updateDisplayNameAction(formData);
      if (res.success) {
        toast.success("Profile updated");
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="mt-6 space-y-6">
      <div className="flex items-center gap-3">
        {avatarUrl ? (
          // see the same note in account-menu.tsx.
          // eslint-disable-next-line @next/next/no-img-element -- fixed
          <img
            src={avatarUrl}
            alt="Profile picture"
            className="size-14 shrink-0 rounded-full object-cover ring-1 ring-primary/25 ring-inset"
          />
        ) : (
          <span
            aria-hidden
            className="grid size-14 shrink-0 place-items-center rounded-full bg-primary/12 font-mono text-lg font-semibold text-primary ring-1 ring-primary/25 ring-inset"
          >
            {initials(email)}
          </span>
        )}
        <div>
          <p className="text-sm font-medium">{email}</p>
          <p className="text-xs text-muted-foreground">
            {avatarUrl
              ? "Picture from your Google account"
              : "No profile picture"}
          </p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-2">
        <Label htmlFor="displayName">Display name</Label>
        <div className="flex gap-2">
          <Input
            id="displayName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            maxLength={80}
          />
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </div>
  );
}
