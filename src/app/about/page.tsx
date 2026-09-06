import Link from "next/link";
import { Nav } from "@/components/landing/nav";
import { Footer } from "@/components/landing/footer";
import { Button } from "@/components/ui/button";
import { createServerClient } from "@/lib/supabase/server";

export const metadata = {
  title: "About",
};

export default async function AboutPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const authed = !!user;

  return (
    <>
      <Nav authed={authed} />
      <main className="flex-1">
        <article className="mx-auto max-w-2xl px-5 py-16 text-sm sm:py-20">
          <h1 className="mb-6 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
            Why Merqo
          </h1>

          <div className="space-y-4 leading-relaxed text-foreground/90">
            <p>Merqo started at a wedding, in the queue for a coffee cart.</p>
            <p>
              There was no queue number, no order system — just a crowd pressing
              in on the vendor, people cutting in to order faster, and the
              vendor taking it because there was nothing else to do. Finished
              drinks went onto a table with a name scrawled on the cup, and
              guests wandered up to pick through them looking for theirs — not
              exactly hygienic, and the hot drinks were going cold and the iced
              ones watery by the time anyone claimed them.
            </p>
            <p>
              That mess is where{" "}
              <span className="font-medium text-foreground">qkit</span> came
              from: a live queue and order system a small vendor can run with no
              app for the customer and no extra hardware to buy.
            </p>
            <p>
              Merqo grew out of qkit to be the shared home for the rest of the
              family —{" "}
              <span className="font-medium text-foreground">loopkit</span> for
              stamp-card loyalty,{" "}
              <span className="font-medium text-foreground">paykit</span> for
              PayNow and payment tracking, and more kits after — all under one
              account, one sign-in, one dashboard.
            </p>
            <p>
              Merqo is run by Lee Jia Hao Clarence, trading as Merqo (sole
              proprietorship — ACRA registration pending). Every kit is built
              for the same kind of vendor as that coffee cart: small, busy, and
              better off spending time on the product, not the queue.
            </p>
          </div>

          <div className="mt-10">
            <Button asChild size="lg">
              <Link href="/#kits">See the kits</Link>
            </Button>
          </div>
        </article>
      </main>
      <Footer />
    </>
  );
}
