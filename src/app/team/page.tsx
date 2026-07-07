import { requireMerqoTeam } from "@/lib/team";
import { listTeamMembers } from "@/lib/admin";
import { AddTeamForm } from "./add-team-form";
import { RemoveMember } from "./remove-member";
import { DashHeader } from "@/components/dashboard/dash-header";

export const revalidate = 0;

export default async function TeamPage() {
  const { user } = await requireMerqoTeam();
  const team = await listTeamMembers();

  return (
    <>
      <DashHeader email={user.email} />
      <main className="mx-auto max-w-4xl space-y-8 px-5 py-8">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            Team
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Merqo team members can see the overview, vendors, and this page.
          </p>
        </div>

        <section>
          <h2 className="font-display text-lg font-bold">Add a member</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Add by email — the person must have signed in once first.
          </p>
          <div className="mt-3">
            <AddTeamForm />
          </div>
        </section>

        <section>
          <h2 className="font-display text-lg font-bold">Members</h2>
          <ul className="mt-3 space-y-2">
            {team.map((m) => (
              <li
                key={m.user_id}
                className="flex items-center justify-between rounded-xl border bg-card p-3.5 shadow-sm"
              >
                <span className="text-sm">
                  {m.email ?? m.user_id}
                  {m.user_id === user.id && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      (you)
                    </span>
                  )}
                </span>
                {m.user_id !== user.id && (
                  <RemoveMember
                    userId={m.user_id}
                    label={m.email ?? m.user_id}
                  />
                )}
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}
