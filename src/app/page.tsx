import { Nav } from "@/components/landing/nav";
import { Hero } from "@/components/landing/hero";
import { Benefits } from "@/components/landing/benefits";
import { KitStacker } from "@/components/landing/kit-stacker/kit-stacker";
import { Cta } from "@/components/landing/cta";
import { Footer } from "@/components/landing/footer";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function Home() {
  return (
    <>
      <Nav />
      <main className="flex-1">
        <Hero />
        <Benefits />
        <KitStacker />
        <Cta />
      </main>
      <Footer />
      {/* Sticky mobile CTA — one persistent action on small screens. */}
      <div className="sticky bottom-0 z-40 border-t bg-background/90 p-3 backdrop-blur sm:hidden">
        <Button asChild size="lg" className="w-full">
          <Link href="/login">Log in</Link>
        </Button>
      </div>
    </>
  );
}
