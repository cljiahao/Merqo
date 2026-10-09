"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Section } from "@merqo/ui";
import { useAsyncAction } from "@/hooks/use-async-action";
import { UserRound } from "lucide-react";
import { ImageUploader, resizeToWebp } from "@merqo/ui";
import {
  uploadVendorAvatar,
  removeReplacedAvatar,
} from "@/lib/image-upload-adapter";
import { createClient } from "@/lib/supabase/client";
export function AvatarSection({
  avatarUrl,
  vendorId,
}: {
  avatarUrl: string | null;
  vendorId: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [avatar, setAvatar] = useState(avatarUrl);
  const { run: runAvatar } = useAsyncAction();
  function saveAvatar(url: string | null) {
    const previousAvatar = avatar;
    setAvatar(url);
    return runAvatar(async () => {
      const { error } = await supabase.auth.updateUser({
        data: { avatar_url: url },
      });
      if (error) {
        setAvatar(previousAvatar);
        // The upload landed but the save did not, so the new object is
        // referenced nowhere.
        if (url && url !== previousAvatar) void removeReplacedAvatar(url);
        toast.error(error.message);
        return;
      }
      if (previousAvatar && previousAvatar !== url)
        void removeReplacedAvatar(previousAvatar);
      toast.success(url ? "Profile icon saved" : "Profile icon removed");
      router.refresh();
    }).catch(() => {
      setAvatar(previousAvatar);
      // A rejected response may have committed, so keep both storage objects.
      toast.error("Couldn't save your profile icon. Please try again.");
    });
  }
  return (
    <Section
      icon={<UserRound className="size-5" />}
      eyebrow="Your account menu"
      title="Profile icon"
      description="A small image for your account menu. Defaults to your initials."
    >
      <div className="flex items-center gap-4">
        <ImageUploader
          bucket="vendor-avatars"
          pathPrefix={vendorId}
          value={avatar}
          onChange={saveAvatar}
          onUpload={uploadVendorAvatar}
          resizeImage={resizeToWebp}
        />
        <p className="text-xs text-muted-foreground">
          Square images look best. Remove it any time to fall back to your
          initials badge.
        </p>
      </div>
    </Section>
  );
}
