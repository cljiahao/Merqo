"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Section } from "@merqo/ui";
import { Button } from "@/components/ui/button";
import { useAsyncAction } from "@/hooks/use-async-action";
import { FORM_ERROR_CLASS } from "@/lib/utils";
import { Share2 } from "lucide-react";
import { socialLinksSchema } from "@/lib/schemas";
import { updateSocialLinks } from "./actions";
import { SocialLinksFields } from "@merqo/ui";
import type { SocialLinks } from "@/lib/types";
export function SocialLinksSection({
  socialLinks,
}: {
  socialLinks: SocialLinks;
}) {
  const router = useRouter();
  const [links, setLinks] = useState<SocialLinks>(socialLinks);
  const [linksError, setLinksError] = useState<string | null>(null);
  const { pending: savingLinks, run: runLinks } = useAsyncAction();
  function saveLinks() {
    const parsed = socialLinksSchema.safeParse(links);
    if (!parsed.success) {
      setLinksError(parsed.error.issues[0]?.message ?? "Check your links");
      return;
    }
    setLinksError(null);
    return runLinks(async () => {
      const res = await updateSocialLinks(parsed.data);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success("Links saved");
      router.refresh();
    }).catch(() => {
      toast.error("Couldn't save your changes. Please try again.");
    });
  }
  return (
    <Section
      icon={<Share2 className="size-5" />}
      eyebrow="Shown to customers"
      title="Social & website"
      description="Shown across every kit you use, unless a kit lets you override it locally."
    >
      <SocialLinksFields value={links} onChange={setLinks} idPrefix="profile" />
      {linksError && <p className={FORM_ERROR_CLASS}>{linksError}</p>}
      <div className="flex justify-end">
        <Button
          type="button"
          onClick={saveLinks}
          disabled={savingLinks}
          className="h-10 rounded-xl font-semibold"
        >
          {savingLinks ? "Saving…" : "Save links"}
        </Button>
      </div>
    </Section>
  );
}
