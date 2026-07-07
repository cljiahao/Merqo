import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { signOutAction } from "@/app/actions/auth";
import { Wordmark } from "@/components/landing/wordmark";
import { Button } from "@/components/ui/button";

export const revalidate = 0;

// Shown to a signed-in user who is not on the Merqo team. requireMerqoTeam
// redirects here instead of 404ing, so the person knows access is the issue.
export default async function NoAccessPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="flex min-h-screen items-center justify-center p-5">
      <div className="w-full max-w-md text-center">
        <div className="rounded-2xl border bg-card px-7 py-10 shadow-sm">
          <Wordmark className="text-2xl" />
          <h1 className="mt-6 font-display text-3xl font-bold tracking-tight">
            You&rsquo;re not on the team yet
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {user?.email ? (
              <>
                You&rsquo;re signed in as{" "}
                <span className="font-medium text-foreground">
                  {user.email}
                </span>
                , but this account isn&rsquo;t on the Merqo team. Ask an admin
                to add you, then reload.
              </>
            ) : (
              <>Sign in with a Merqo-team account to continue.</>
            )}
          </p>
          <div className="mt-7 flex flex-col gap-2.5">
            {user ? (
              <form action={signOutAction}>
                <Button
                  type="submit"
                  variant="outline"
                  className="h-11 w-full rounded-xl"
                >
                  Sign out
                </Button>
              </form>
            ) : (
              <Button asChild className="h-11 w-full rounded-xl">
                <Link href="/login">Sign in</Link>
              </Button>
            )}
            <Button asChild variant="ghost" className="h-11 w-full rounded-xl">
              <Link href="/">Back to home</Link>
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
