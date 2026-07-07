import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";

// All operator areas require a session. Everything else (landing, /login,
// /no-access) is public. Merqo-team membership is additionally enforced in each
// page via requireMerqoTeam(); the proxy only guarantees a session.
function isProtectedPath(path: string): boolean {
  return (
    path.startsWith("/dashboard") ||
    path.startsWith("/vendors") ||
    path.startsWith("/team")
  );
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refresh the session on EVERY request, not just protected ones. @supabase/ssr
  // rotates the auth cookies as a side effect of getUser(); skipping it on public
  // routes (the landing, /login) lets the access token age out with no refresh,
  // which silently logs the user out when they return. Run getUser() first, then
  // apply the login gate only for protected paths.
  let user: User | null = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    // Auth unreachable — degrade to unauthenticated.
    user = null;
  }

  if (!user && isProtectedPath(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
