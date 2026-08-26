"use client";

import { AuditLogTable, type AuditLogEntry } from "@merqo/ui";

// AuditLogTable is a Client Component (all of @merqo/ui is) — its
// `formatAction` prop is a plain function, not a Server Action, so it can't
// cross the server/client boundary as a prop from the (server) page. This
// thin client wrapper owns the function locally instead; the page passes it
// only serializable `entries` data.
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

export function ActivityLog({ entries }: { entries: AuditLogEntry[] }) {
  return (
    <AuditLogTable
      entries={entries}
      formatAction={formatAction}
      emptyState={
        <div className="rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
          No admin activity yet.
        </div>
      }
    />
  );
}
