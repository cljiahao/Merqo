import { requireMerqoTeam } from "@/lib/team";
import { listAdminAuditEntries } from "@/lib/admin";
import type { AuditLogEntry } from "@merqo/ui";
import { ActivityLog } from "./activity-log";

export const revalidate = 0;

export default async function AdminActivityPage() {
  await requireMerqoTeam();
  const rows = await listAdminAuditEntries(100);

  const entries: AuditLogEntry[] = rows.map((r) => ({
    id: r.id,
    actor: r.adminEmail,
    action: r.action,
    target: r.target_id,
    detail: r.detail === null ? null : JSON.stringify(r.detail),
    createdAt: r.created_at,
  }));

  return (
    <main className="mx-auto max-w-5xl px-5 py-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Internal
        </p>
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Activity
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Recent admin actions across the console.
        </p>
      </div>

      <div className="mt-6">
        <ActivityLog entries={entries} />
      </div>
    </main>
  );
}
