import { NextResponse } from "next/server";
import { loadVendorContext, resolveHome } from "@/lib/vendor";
import { syncVendorKits } from "@/lib/vendor-sync";

// Single funnel for "where do I go after signing in?" — password sign-in, OAuth
// callback, and password reset all send the user here so the role-routing logic
// lives in exactly one place. Also the fresh-login sync point: forces a kit
// re-check (bypassing syncVendorKits' throttle) so a kit joined directly on
// its own site is reflected the moment the vendor next signs in to Merqo.
export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  const { user, isTeam } = await loadVendorContext();
  if (!user) return NextResponse.redirect(`${origin}/login`);
  if (!isTeam && user.email) {
    await syncVendorKits(user.email, { force: true });
  }
  return NextResponse.redirect(`${origin}${resolveHome({ isTeam })}`);
}
