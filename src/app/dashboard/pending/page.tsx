import Link from "next/link";
import { redirect } from "next/navigation";
import {
  loadVendorContext,
  tilesForLinks,
  hasRenderableActiveKit,
} from "@/lib/vendor";
import { syncVendorKits } from "@/lib/vendor-sync";
import { signOutAction } from "@/app/actions/auth";
import { Wordmark } from "@/components/landing/wordmark";
import { Button } from "@/components/ui/button";

export const revalidate = 0;

// Reachable only by a signed-in user who is not an active vendor. Not under the
// (app) gate, so requireActiveVendor's redirect here can't loop. Sends anyone who
// actually qualifies onward via /post-login.
export default async function PendingPage() {
  const { user, isTeam, links: initialLinks } = await loadVendorContext();
  if (!user) redirect("/login");
  if (isTeam) redirect("/admin");

  // A vendor with zero links may have signed up directly on a kit — check
  // before showing "no kits yet" (see vendor-sync.ts; best-effort, never
  // throws, so a sync failure just leaves `links` as the empty array it
  // already was).
  const links =
    initialLinks.length === 0 && user.email
      ? await syncVendorKits(user.email)
      : initialLinks;

  if (hasRenderableActiveKit(links)) redirect("/dashboard");

  const { pending } = tilesForLinks(links);

  return (
    <main className="flex min-h-screen items-center justify-center p-5">
      <div className="w-full max-w-md text-center">
        <div className="rounded-2xl border bg-card px-7 py-10 shadow-sm">
          <Wordmark className="text-2xl" />
          {pending.length > 0 ? (
            <>
              <h1 className="mt-6 font-display text-3xl font-bold tracking-tight">
                You&rsquo;re on the list
              </h1>
              <p className="mt-3 text-sm text-muted-foreground">
                We&rsquo;ll email{" "}
                <span className="font-medium text-foreground">
                  {user.email}
                </span>{" "}
                when {pending.length === 1 ? "it opens" : "these open"}:
              </p>
              <ul className="mt-4 space-y-1.5 text-sm">
                {pending.map((t) => (
                  <li key={t.slug} className="font-medium">
                    {t.name}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <h1 className="mt-6 font-display text-3xl font-bold tracking-tight">
                No kits yet
              </h1>
              <p className="mt-3 text-sm text-muted-foreground">
                You&rsquo;re signed in as{" "}
                <span className="font-medium text-foreground">
                  {user.email}
                </span>
                , but no kits are active on this account yet. Get in touch to
                get started.
              </p>
            </>
          )}
          <div className="mt-7 flex flex-col gap-2.5">
            <Button asChild className="h-11 w-full rounded-xl">
              <Link href="/post-login">Check again</Link>
            </Button>
            <form action={signOutAction}>
              <Button
                type="submit"
                variant="outline"
                className="h-11 w-full rounded-xl"
              >
                Sign out
              </Button>
            </form>
            <Button asChild variant="ghost" className="h-11 w-full rounded-xl">
              <Link href="/">Back to home</Link>
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
