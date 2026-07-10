import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { getAvatarUrl, getDisplayName } from "@/lib/account";
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

  return (
    <main className="mx-auto max-w-xl px-5 py-8">
      <Link
        href="/dashboard"
        className="text-sm text-muted-foreground hover:underline"
      >
        ← Back
      </Link>
      <h1 className="mt-2 font-display text-2xl font-bold tracking-tight">
        Profile
      </h1>
      <ProfileForm
        email={user.email ?? null}
        avatarUrl={getAvatarUrl(user)}
        displayName={getDisplayName(user)}
      />
    </main>
  );
}
