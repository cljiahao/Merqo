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
import { Store } from "lucide-react";
import { profileNameSchema } from "@/lib/schemas";
import { updateStallName } from "./actions";
export function StallNameSection({ stallName }: { stallName: string }) {
  const router = useRouter();
  const [name, setName] = useState(stallName);
  const [nameError, setNameError] = useState<string | null>(null);
  const { pending: savingName, run: runName } = useAsyncAction();
  function saveStall() {
    const parsed = profileNameSchema.safeParse({ name });
    if (!parsed.success) {
      setNameError(parsed.error.issues[0]?.message ?? "Invalid stall name");
      return;
    }
    setNameError(null);
    return runName(async () => {
      const res = await updateStallName({ name: parsed.data.name });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success("Stall name saved");
      router.refresh();
    }).catch(() => {
      toast.error("Couldn't save your changes. Please try again.");
    });
  }
  return (
    <Section
      icon={<Store className="size-5" />}
      eyebrow="Shown to customers"
      title="Stall name"
      description="The name shown across every kit you use."
    >
      <div className="space-y-2">
        <Label htmlFor="stall-name" className={FORM_LABEL_CLASS}>
          Stall name
        </Label>
        <Input
          id="stall-name"
          value={name}
          maxLength={100}
          onChange={(e) => setName(e.target.value)}
          className="h-11 rounded-xl"
          aria-invalid={!!nameError}
          aria-describedby={nameError ? "stall-name-error" : undefined}
        />
        {nameError && (
          <p id="stall-name-error" className={FORM_ERROR_CLASS}>
            {nameError}
          </p>
        )}
      </div>
      <div className="flex justify-end">
        <Button
          type="button"
          onClick={saveStall}
          disabled={savingName || name === stallName}
          className="h-10 rounded-xl font-semibold"
        >
          {savingName ? "Saving…" : "Save stall name"}
        </Button>
      </div>
    </Section>
  );
}
