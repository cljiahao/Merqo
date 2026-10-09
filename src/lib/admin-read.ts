import type { createServiceClient } from "@/lib/supabase/server";

/** Read every page of a deterministically ordered admin query or fail visibly. */
export async function readAdminRows<T>(
  label: string,
  page: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  while (true) {
    const { data, error } = await page(rows.length, rows.length + 999);
    if (error || !data)
      throw new Error(
        label + ": " + (error?.message ?? "Missing query results"),
      );
    if (data.length === 0) return rows;
    rows.push(...data);
  }
}

/** Resolve only referenced auth IDs, with bounded concurrency and no directory scan. */
export async function adminEmailsById(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  userIds: string[],
): Promise<Map<string, string | null>> {
  const ids = [...new Set(userIds)];
  const emails = new Map<string, string | null>();
  for (let offset = 0; offset < ids.length; offset += 8) {
    const batch = ids.slice(offset, offset + 8);
    const users = await Promise.all(
      batch.map(async (id) => {
        const { data, error } = await supabase.auth.admin.getUserById(id);
        if (error && error.status !== 404)
          throw new Error("read user: " + error.message);
        return data?.user?.email ?? null;
      }),
    );
    batch.forEach((id, index) => emails.set(id, users[index]));
  }
  return emails;
}
