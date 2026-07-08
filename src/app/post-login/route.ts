import { NextResponse } from "next/server";
import { loadVendorContext, resolveHome } from "@/lib/vendor";

// Single funnel for "where do I go after signing in?" — password sign-in, OAuth
// callback, and password reset all send the user here so the role-routing logic
// lives in exactly one place.
export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  const { user, isTeam, links } = await loadVendorContext();
  if (!user) return NextResponse.redirect(`${origin}/login`);
  const dest = resolveHome({
    isTeam,
    hasActiveKit: links.some((l) => l.status === "active"),
  });
  return NextResponse.redirect(`${origin}${dest}`);
}
