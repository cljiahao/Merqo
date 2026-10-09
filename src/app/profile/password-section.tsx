"use client";
import { useState } from "react";

import { toast } from "sonner";
import { Section } from "@merqo/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAsyncAction } from "@/hooks/use-async-action";
import { FORM_ERROR_CLASS, FORM_LABEL_CLASS } from "@/lib/utils";
import { KeyRound } from "lucide-react";
import { passwordChangeSchema } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/client";
export function PasswordSection({ email }: { email: string }) {
  const supabase = createClient();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const { pending: savingPw, run: runPw } = useAsyncAction();
  function savePassword() {
    const parsed = passwordChangeSchema.safeParse({ password, confirm });
    if (!parsed.success) {
      setPwError(parsed.error.issues[0]?.message ?? "Check your password");
      return;
    }
    setPwError(null);
    return runPw(async () => {
      const { error } = await supabase.auth.updateUser({
        password: parsed.data.password,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Password updated");
      setPassword("");
      setConfirm("");
    }).catch(() => {
      toast.error("Couldn't save your changes. Please try again.");
    });
  }
  return (
    <Section
      icon={<KeyRound className="size-5" />}
      eyebrow="Sign-in security"
      title="Change password"
      description="Set a new password. At least 8 characters."
    >
      <div className="space-y-2">
        <Label htmlFor="email" className={FORM_LABEL_CLASS}>
          Email
        </Label>
        <Input
          id="email"
          value={email}
          readOnly
          disabled
          className="h-11 rounded-xl bg-secondary/60"
        />
        <p className="text-xs text-muted-foreground">
          Your sign-in email. It can&apos;t be changed here.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="new-password" className={FORM_LABEL_CLASS}>
          New password
        </Label>
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          value={password}
          placeholder="••••••••"
          onChange={(e) => setPassword(e.target.value)}
          className="h-11 rounded-xl"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm-password" className={FORM_LABEL_CLASS}>
          Confirm new password
        </Label>
        <Input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          placeholder="••••••••"
          onChange={(e) => setConfirm(e.target.value)}
          className="h-11 rounded-xl"
          aria-invalid={!!pwError}
          aria-describedby={pwError ? "confirm-password-error" : undefined}
        />
        {pwError && (
          <p id="confirm-password-error" className={FORM_ERROR_CLASS}>
            {pwError}
          </p>
        )}
      </div>
      <div className="flex justify-end">
        <Button
          type="button"
          onClick={savePassword}
          disabled={savingPw || !password || !confirm}
          className="h-10 rounded-xl font-semibold"
        >
          {savingPw ? "Updating…" : "Update password"}
        </Button>
      </div>
    </Section>
  );
}
