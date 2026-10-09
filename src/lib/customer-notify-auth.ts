import { timingSafeEqual } from "node:crypto";

/**
 * Constant-time bearer check for kit-to-Merqo Telegram and legal routes.
 * The shared secret name predates the vendor and legal endpoints.
 * An unconfigured secret fails closed.
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
