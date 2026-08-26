import { requireMerqoTeam } from "@/lib/team";
import { listAdminAuditEntries } from "@/lib/admin";
import { AuditLogTable, type AuditLogEntry } from "@merqo/ui";

export const revalidate = 0;

// Human labels for every action string recorded via recordAudit() — see
// src/app/admin/actions.ts, vendors/actions.ts, team/actions.ts.
const ACTION_LABELS: Record<string, string> = {
  grant_kit_access: "Granted kit access",
  revoke_kit_access: "Revoked kit access",
  add_team_member: "Added team member",
  remove_team_member: "Removed team member",
  toggle_bundle_discount: "Toggled bundle discount",
  resolve_support_message: "Resolved support message",
};

function formatAction(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

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
        <AuditLogTable
          entries={entries}
          formatAction={formatAction}
          emptyState={
            <div className="rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
              No admin activity yet.
            </div>
          }
        />
      </div>
    </main>
  );
}
