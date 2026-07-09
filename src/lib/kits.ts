/**
 * The Merqo kit family — the source of truth for the landing roadmap grid.
 * Static on purpose: no DB read keeps the landing's LCP fast and lets it render
 * even while Supabase is half-provisioned. Waitlist writes still hit the DB;
 * every `coming` kit here must have a matching `merqo.products` row (see
 * migration 0004) for the vendor_links FK.
 */

export type KitStatus = "live" | "coming" | "planned";

export type Kit = {
  slug: string;
  name: string;
  /** One-line, plain-language "what it does" for a non-technical vendor. */
  tagline: string;
  status: KitStatus;
  /** Only set for `live` kits — where the CTA sends the vendor. */
  href?: string;
};

/** Where the live qkit product lives. Set NEXT_PUBLIC_QKIT_URL per environment
 *  to override (e.g. a custom domain). */
export const QKIT_URL =
  process.env.NEXT_PUBLIC_QKIT_URL ?? "https://qkit-sg.vercel.app";

// Canonical per-kit URLs (each kit is a standalone product on its own domain).
// href is only wired for the live kit; the rest launch on:
//   loopkit-sg.vercel.app · shopkit-sg.vercel.app · paykit-sg.vercel.app
//   stockkit-sg.vercel.app · reachkit-sg.vercel.app
export const KITS: Kit[] = [
  {
    slug: "qkit",
    name: "qkit",
    tagline:
      "Take orders and run your queue from a QR code — no app, no hardware.",
    status: "live",
    href: QKIT_URL,
  },
  {
    slug: "loopkit",
    name: "loopkit",
    tagline: "Stamp cards, points and tiers that bring customers back.",
    status: "coming",
  },
  {
    slug: "shopkit",
    name: "shopkit",
    tagline: "A simple storefront for your catalog, checkout and pre-orders.",
    status: "planned",
  },
  {
    slug: "paykit",
    name: "paykit",
    tagline: "Collect PayNow, cards and cash — with receipts and e-invoices.",
    status: "planned",
  },
  {
    slug: "stockkit",
    name: "stockkit",
    tagline: "Track stock in and out, and know what each dish really costs.",
    status: "planned",
  },
  {
    slug: "reachkit",
    name: "reachkit",
    tagline:
      "Reach customers by SMS, email and WhatsApp — and collect reviews.",
    status: "planned",
  },
];

export const LIVE_KITS = KITS.filter((k) => k.status === "live");
export const COMING_KITS = KITS.filter((k) => k.status === "coming");

/** Slugs a vendor can join a waitlist for — the server action validates against this. */
export const WAITLISTABLE_SLUGS = COMING_KITS.map((k) => k.slug);
