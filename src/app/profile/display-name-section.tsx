"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Section } from "@merqo/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAsyncAction } from "@/hooks/use-async-action";
import { FORM_ERROR_CLASS, FORM_LABEL_CLASS } from "@/lib/utils";
import { IdCard } from "lucide-react";
import { displayNameSchema } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/client";
export function DisplayNameSection({ displayName }: { displayName: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [display, setDisplay] = useState(displayName);
  const [displayError, setDisplayError] = useState<string | null>(null);
  const { pending: savingDisplay, run: runDisplay } = useAsyncAction();
  function saveDisplayName() {
    const parsed = displayNameSchema.safeParse({ displayName: display });
    if (!parsed.success) {
      setDisplayError(parsed.error.issues[0]?.message ?? "Invalid name");
      return;
    }
    setDisplayError(null);
    return runDisplay(async () => {
      const { error } = await supabase.auth.updateUser({
        data: { display_name: parsed.data.displayName },
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Display name saved");
      router.refresh();
    }).catch(() => {
      toast.error("Couldn't save your changes. Please try again.");
    });
  }
  return (
    <Section
      icon={<IdCard className="size-5" />}
      eyebrow="Just for you"
      title="Display name"
      description="How Merqo addresses you. Customers never see this."
    >
      <div className="space-y-2">
        <Label htmlFor="display-name" className={FORM_LABEL_CLASS}>
          Display name
        </Label>
        <Input
          id="display-name"
          value={display}
          maxLength={60}
          placeholder="e.g. Aisha"
          onChange={(e) => setDisplay(e.target.value)}
          className="h-11 rounded-xl"
          aria-invalid={!!displayError}
          aria-describedby={displayError ? "display-name-error" : undefined}
        />
        {displayError && (
          <p id="display-name-error" className={FORM_ERROR_CLASS}>
            {displayError}
          </p>
        )}
      </div>
      <div className="flex justify-end">
        <Button
          type="button"
          onClick={saveDisplayName}
          disabled={savingDisplay || display === displayName}
          className="h-10 rounded-xl font-semibold"
        >
          {savingDisplay ? "Saving…" : "Save display name"}
        </Button>
      </div>
    </Section>
  );
}
