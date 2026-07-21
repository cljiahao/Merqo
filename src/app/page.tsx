import { Nav } from "@/components/landing/nav";
import { Hero } from "@/components/landing/hero";
import { Benefits } from "@/components/landing/benefits";
import { KitStacker } from "@/components/landing/kit-stacker/kit-stacker";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Faq } from "@/components/landing/faq";
import { Cta } from "@/components/landing/cta";
import { Footer } from "@/components/landing/footer";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";

export default async function Home() {
  // Reflect the session in the landing CTAs: a signed-in operator jumps straight
  // to the dashboard instead of being sent back through /login.
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const authed = !!user;

  return (
    <>
      <Nav authed={authed} />
      <main className="flex-1">
        <Hero authed={authed} />
        <Benefits />
        <KitStacker />
        <HowItWorks />
        <Faq />
        <Cta authed={authed} />
      </main>
      <Footer />
      {/* Sticky mobile CTA — one persistent action on small screens. */}
      <div className="sticky bottom-0 z-40 border-t bg-background/90 p-3 backdrop-blur sm:hidden">
        <Button asChild size="lg" className="w-full">
          <Link href={authed ? "/admin" : "/login"}>
            {authed ? "Go to dashboard" : "Log in"}
          </Link>
        </Button>
      </div>
    </>
  );
}
