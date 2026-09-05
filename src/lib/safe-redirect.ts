/**
 * Guards against an open redirect: accepts only a same-origin relative path
 * (leading "/", not "//" or "/\" — both browser-normalize to a protocol-relative
 * URL), falling back to `fallback` otherwise.
 */
export function safeRedirectPath(
  next: string | null | undefined,
  fallback: string,
): string {
  if (
    next &&
    next.startsWith("/") &&
    !next.startsWith("//") &&
    !next.startsWith("/\\")
  ) {
    return next;
  }
  return fallback;
}
