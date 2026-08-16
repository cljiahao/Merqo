import { timingSafeEqual } from "node:crypto";

/**
 * Constant-time check of `Authorization: Bearer <MERQO_CUSTOMER_SECRET>`.
 * Gates all four `/api/merqo/*` kit-caller routes — the original pair
 * (`customer-connect-token`, `notify-customer`) plus the Phase A2 vendor
 * pair (`vendor-connect-token`, `notify-vendor`) — the first time merqo
 * itself is the RECEIVING side of a bearer-authenticated call (every
 * existing cross-kit call flows merqo → kit: metrics pull,
 * vendor-provision). The name and the `MERQO_CUSTOMER_SECRET` env var
 * predate the vendor-facing routes; kept as-is rather than renamed, since
 * the underlying secret is shared across 3 repos and a rename this late
 * has real coordination cost for a naming nicety (see the vendor-connect
 * design spec's own note on this). Mirrors qkit's own `provisionBearerOk`
 * (`src/lib/merqo-auth.ts` in the qkit repo) — same constant-time-compare
 * shape, first use in the opposite direction. Fails closed when
 * `MERQO_CUSTOMER_SECRET` isn't configured at all.
 */
export function customerNotifySecretOk(request: Request): boolean {
  const secret = process.env.MERQO_CUSTOMER_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const prefix = "Bearer ";
  if (!header.startsWith(prefix)) return false;
  const provided = Buffer.from(header.slice(prefix.length));
  const expected = Buffer.from(secret);
  return (
    provided.length === expected.length && timingSafeEqual(provided, expected)
  );
}
