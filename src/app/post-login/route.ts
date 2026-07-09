import { NextResponse } from "next/server";
import {
  hasRenderableActiveKit,
  loadVendorContext,
  resolveHome,
} from "@/lib/vendor";
import { syncVendorKits } from "@/lib/vendor-sync";

// Single funnel for "where do I go after signing in?" — password sign-in, OAuth
// callback, and password reset all send the user here so the role-routing logic
// lives in exactly one place. Also the once-per-login sync point: refreshes
// membership (new kits the vendor joined directly) and tier (see vendor-sync.ts)
// before deciding where to send them. Never throws, so a bad kit/network/DB
// hiccup here just falls back to the vendor's already-known links.
export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  const { user, isTeam, links: initialLinks } = await loadVendorContext();
  if (!user) return NextResponse.redirect(`${origin}/login`);
  const links =
    !isTeam && user.email ? await syncVendorKits(user.email) : initialLinks;
  const dest = resolveHome({
    isTeam,
    hasActiveKit: hasRenderableActiveKit(links),
  });
  return NextResponse.redirect(`${origin}${dest}`);
}
