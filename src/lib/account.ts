// display_name and avatar_url are arbitrary JSON on the auth user — read
// defensively rather than trusting the shape (same convention as qkit's
// profile page, which reads the same two keys off the same untyped field).
type MetadataUser = { user_metadata?: unknown } | null | undefined;

function stringField(user: MetadataUser, key: string): string | null {
  const meta = user?.user_metadata as Record<string, unknown> | undefined;
  const raw = meta?.[key];
  return typeof raw === "string" ? raw : null;
}

export function getAvatarUrl(user: MetadataUser): string | null {
  return stringField(user, "avatar_url");
}

export function getDisplayName(user: MetadataUser): string | null {
  const raw = stringField(user, "full_name");
  const trimmed = raw?.trim();
  return trimmed ? trimmed : null;
}
