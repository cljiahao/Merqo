import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    // Client-side Supabase calls (auth, storage) go straight from the browser
    // to Supabase, so connect-src must allow it. In dev that's local Supabase
    // over plain http/ws (127.0.0.1:54321, matching supabase/config.toml); in
    // prod it's the hosted *.supabase.co over https/wss.
    const connectSrc =
      process.env.NODE_ENV === "production"
        ? "connect-src 'self' https://*.supabase.co wss://*.supabase.co"
        : "connect-src 'self' https://*.supabase.co wss://*.supabase.co http://127.0.0.1:54321 ws://127.0.0.1:54321";

    // Avatars render as plain <img> tags (@merqo/ui's AccountMenu), so the
    // actual Supabase Storage origin needs to be reachable directly. This app
    // has no Google OAuth (email/password only — see src/app/login), so
    // unlike qkit's policy there's no googleusercontent.com to allow.
    const imgSrc =
      process.env.NODE_ENV === "production"
        ? "img-src 'self' data: blob: https://*.supabase.co"
        : "img-src 'self' data: blob: https://*.supabase.co http://127.0.0.1:54321";

    // React dev mode calls eval() to reconstruct stack traces across the RSC
    // boundary — dev-only, never in production.
    const scriptSrc =
      process.env.NODE_ENV === "production"
        ? "script-src 'self' 'unsafe-inline'"
        : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";

    // X-Frame-Options and CSP frame-ancestors apply during `next dev` too,
    // and browsers enforce both even on localhost — blocking any IDE preview
    // pane that renders this app via <iframe>. Both are dev-only-omitted;
    // every deployed environment (prod, preview) still gets full protection.
    const isDev = process.env.NODE_ENV !== "production";

    return [
      {
        source: "/(.*)",
        headers: [
          ...(isDev ? [] : [{ key: "X-Frame-Options", value: "DENY" }]),
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          { key: "X-XSS-Protection", value: "0" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              scriptSrc,
              "style-src 'self' 'unsafe-inline'",
              imgSrc,
              "font-src 'self' data:",
              connectSrc,
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              isDev ? null : "frame-ancestors 'none'",
            ]
              .filter(Boolean)
              .join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
