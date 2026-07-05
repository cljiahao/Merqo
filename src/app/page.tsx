import { Nav } from "@/components/landing/nav";
import { Hero } from "@/components/landing/hero";
import { Benefits } from "@/components/landing/benefits";
import { KitGrid } from "@/components/landing/kit-grid";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Cta } from "@/components/landing/cta";
import { Footer } from "@/components/landing/footer";
import { Button } from "@/components/ui/button";
import { QKIT_URL } from "@/lib/kits";

export default function Home() {
  return (
    <>
      <Nav />
      <main className="flex-1">
        <Hero />
        <Benefits />
        <KitGrid />
        <HowItWorks />
        <Cta />
      </main>
      <Footer />
      {/* Sticky mobile CTA — one persistent action on small screens. */}
      <div className="sticky bottom-0 z-40 border-t bg-background/90 p-3 backdrop-blur sm:hidden">
        <Button asChild size="lg" className="w-full">
          <a href={QKIT_URL}>Open qkit</a>
        </Button>
      </div>
    </>
  );
}
