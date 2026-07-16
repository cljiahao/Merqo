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
  /** 2-3 sentence explanation for the dashboard's discovery cards. */
  description: string;
  /** 3-4 short "what you get" bullets for the dashboard's discovery cards. */
  features: string[];
  status: KitStatus;
  /** Only set for `live` kits — where the CTA sends the vendor. */
  href?: string;
};

/** Where the live qkit product lives. Set NEXT_PUBLIC_QKIT_URL per environment
 *  to override (e.g. a custom domain). */
export const QKIT_URL =
  process.env.NEXT_PUBLIC_QKIT_URL ?? "https://qkit-sg.vercel.app";

/** Where the live loopkit product lives. Set NEXT_PUBLIC_LOOPKIT_URL per
 *  environment to override (e.g. a custom domain). */
export const LOOPKIT_URL =
  process.env.NEXT_PUBLIC_LOOPKIT_URL ?? "https://loopkit-sg.vercel.app";

/** Where the live paykit product lives. Set NEXT_PUBLIC_PAYKIT_URL per
 *  environment to override (e.g. a custom domain). */
export const PAYKIT_URL =
  process.env.NEXT_PUBLIC_PAYKIT_URL ?? "https://paykit-sg.vercel.app";

// Canonical per-kit URLs (each kit is a standalone product on its own domain).
// href is wired for the live kits (qkit, loopkit, paykit); the rest launch on:
//   shopkit-sg.vercel.app · stockkit-sg.vercel.app · reachkit-sg.vercel.app
export const KITS: Kit[] = [
  {
    slug: "qkit",
    name: "qkit",
    tagline:
      "Take orders and run your queue from a QR code — no app, no hardware.",
    description:
      "Customers scan a QR code to join your queue or place an order — no app download, no extra hardware. You get a live dashboard to manage orders, track busy periods, and keep the line moving.",
    features: [
      "QR-code ordering and queueing",
      "Live order dashboard",
      "Works on any phone, no app needed",
      "Free and Pro tiers",
    ],
    status: "live",
    href: QKIT_URL,
  },
  {
    slug: "loopkit",
    name: "loopkit",
    tagline: "Stamp cards, points and tiers that bring customers back.",
    description:
      "Digital stamp cards and a points system that turns one-time buyers into regulars. Customers collect stamps or points on every visit and redeem rewards you set — all tracked automatically, no punch cards to lose.",
    features: [
      "Digital stamp cards & points",
      "Custom rewards and tiers",
      "Automatic visit tracking",
      "Works alongside your other kits",
    ],
    status: "live",
    href: LOOPKIT_URL,
  },
  {
    slug: "shopkit",
    name: "shopkit",
    tagline: "A simple storefront for your catalog, checkout and pre-orders.",
    description:
      "A lightweight online storefront for your products — list your catalog, take orders and pre-orders, and get paid, all from one link you can share anywhere.",
    features: [
      "Shareable online storefront",
      "Catalog & pre-orders",
      "Built-in checkout",
      "No fee on your own PayNow",
    ],
    status: "coming",
  },
  {
    slug: "paykit",
    name: "paykit",
    tagline: "Collect PayNow, cards and cash — with receipts and e-invoices.",
    description:
      "One place to collect payment however your customer prefers — PayNow, cards or cash — with automatic receipts and e-invoices, so your books stay tidy without extra admin.",
    features: [
      "PayNow, card & cash in one flow",
      "Automatic receipts",
      "E-invoices",
      "Syncs with your other kits' orders",
    ],
    status: "live",
    href: PAYKIT_URL,
  },
  {
    slug: "stockkit",
    name: "stockkit",
    tagline: "Track stock in and out, and know what each dish really costs.",
    description:
      "Keep a real-time count of what's on your shelves or in your kitchen, and see the true cost of every dish or product — so you know what's actually making you money.",
    features: [
      "Real-time stock tracking",
      "Ingredient/product cost breakdown",
      "Low-stock alerts",
      "Ties stock movement to your sales",
    ],
    status: "planned",
  },
  {
    slug: "reachkit",
    name: "reachkit",
    tagline:
      "Reach customers by SMS, email and WhatsApp — and collect reviews.",
    description:
      "Send updates, promotions and reminders to your customers over SMS, email or WhatsApp, and collect reviews after every visit — all from the same customer list your other kits already know.",
    features: [
      "SMS, email & WhatsApp campaigns",
      "Automated review requests",
      "Shared customer list across kits",
      "Simple campaign templates",
    ],
    status: "planned",
  },
];

export const LIVE_KITS = KITS.filter((k) => k.status === "live");
export const COMING_KITS = KITS.filter((k) => k.status === "coming");

/** Slugs a vendor can join a waitlist for — the server action validates against this. */
export const WAITLISTABLE_SLUGS = COMING_KITS.map((k) => k.slug);
