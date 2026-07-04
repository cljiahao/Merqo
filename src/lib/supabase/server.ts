import {
  createServerClient as createSSRClient,
  type CookieMethodsServer,
} from "@supabase/ssr";
import { cookies } from "next/headers";

type CookieStore = Awaited<ReturnType<typeof cookies>>;

// Shared @supabase/ssr cookie adapter. The setAll catch covers the read-only
// Server Component context (session refresh is handled by middleware instead).
function cookieMethods(cookieStore: CookieStore): CookieMethodsServer {
  return {
    getAll() {
      return cookieStore.getAll();
    },
    setAll(cookiesToSet) {
      try {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
        });
      } catch {
        // Read-only context (Server Component) — session refresh handled by middleware
      }
    },
  };
}

export async function createServerClient() {
  const cookieStore = await cookies();

  return createSSRClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      // Shared project (arch-v2 §2): merqo's tables live in the `merqo` schema,
      // qkit's in `public`. Default every .from() to merqo. auth.* is unaffected.
      db: { schema: "merqo" },
      cookies: cookieMethods(cookieStore),
    },
  );
}

// Uses the secret key — bypasses RLS. Only use in Server Actions/Route Handlers.
// CRITICAL: do NOT attach the request cookies here. An empty cookie adapter
// means the secret key drives auth → true RLS bypass. Passing the user's auth
// cookies would hydrate their session and re-apply RLS to every query.
export async function createServiceClient() {
  return createSSRClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    {
      db: { schema: "merqo" },
      cookies: { getAll: () => [], setAll: () => {} },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
