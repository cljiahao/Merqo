import { timingSafeEqual } from "node:crypto";

/**
 * Constant-time check of `Authorization: Bearer <MERQO_CUSTOMER_SECRET>`.
 * Gates the two `/api/merqo/*` customer-notify routes that qkit and
 * loopkit call — the first time merqo itself is the RECEIVING side of a
 * bearer-authenticated call (every existing cross-kit call flows
 * merqo → kit: metrics pull, vendor-provision). Mirrors qkit's own
 * `provisionBearerOk` (`src/lib/merqo-auth.ts` in the qkit repo) — same
 * constant-time-compare shape, first use in the opposite direction. Fails
 * closed when `MERQO_CUSTOMER_SECRET` isn't configured at all.
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
