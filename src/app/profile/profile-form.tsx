import { TwoColumnSections } from "@merqo/ui";
import type { SocialLinks } from "@/lib/types";
import { StallNameSection } from "./stall-name-section";
import { AvatarSection } from "./avatar-section";
import { PasswordSection } from "./password-section";
import { DisplayNameSection } from "./display-name-section";
import { SocialLinksSection } from "./social-links-section";
interface Props {
  stallName: string;
  displayName: string;
  email: string;
  vendorId: string;
  avatarUrl: string | null;
  socialLinks: SocialLinks;
}
export function ProfileForm({
  stallName,
  displayName,
  email,
  vendorId,
  avatarUrl,
  socialLinks,
}: Props) {
  return (
    <TwoColumnSections
      columnOne={
        <>
          <StallNameSection stallName={stallName} />
          <AvatarSection avatarUrl={avatarUrl} vendorId={vendorId} />
          <PasswordSection email={email} />
        </>
      }
      columnTwo={
        <>
          <DisplayNameSection displayName={displayName} />
          <SocialLinksSection socialLinks={socialLinks} />
        </>
      }
    />
  );
}
