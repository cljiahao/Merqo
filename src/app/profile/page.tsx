import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { getAvatarUrl, getDisplayName } from "@/lib/account";
import { getOrCreateVendorProfile } from "@/lib/merqo-vendor-profile";
import { ProfileForm } from "./profile-form";

export const revalidate = 0;

// Deliberately NOT under /dashboard: AccountMenu (and therefore the Profile
// link) is shared by both the vendor dashboard and the admin console, so a
// pure-admin account (no active kit) must be able to reach this page without
// requireActiveVendor() bouncing them to /dashboard/pending. Gated by
// "signed in" only, matching neither requireActiveVendor() nor
// requireMerqoTeam()'s stricter checks.
export default async function ProfilePage() {
  const supabase = await createServerClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) redirect("/login");

  const profile = await getOrCreateVendorProfile(supabase, user.id, null);

  return (
    <div className="mx-auto max-w-lg space-y-8 px-5 py-8 md:max-w-4xl">
      <header>
        <Link
          href="/dashboard"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Back
        </Link>
        <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Your account
        </p>
        <h1 className="font-display text-4xl font-semibold leading-none">
          Profile
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your stall name, profile icon, how we address you, and your sign-in
          password. Each section saves on its own.
        </p>
      </header>

      <ProfileForm
        stallName={profile.stall_name}
        displayName={getDisplayName(user) ?? ""}
        email={user.email ?? ""}
        vendorId={user.id}
        avatarUrl={getAvatarUrl(user)}
        socialLinks={profile.social_links}
      />
    </div>
  );
}
