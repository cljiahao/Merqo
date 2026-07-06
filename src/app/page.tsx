import { Nav } from "@/components/landing/nav";
import { Hero } from "@/components/landing/hero";
import { Benefits } from "@/components/landing/benefits";
import { StackerShell } from "@/components/landing/kit-stacker/stacker-shell";
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

        {/* A/B/C/D comparison — pick one, then the rest get pruned. */}
        <StackerShell
          id="kits"
          eyebrow="Option A · Graph"
          title="One queue. Click a kit to see how it snaps on."
          subtitle="A hub-and-spoke network — qkit at the centre, each kit connects in."
          variant="graph"
        />
        <StackerShell
          eyebrow="Option B · Blocks"
          title="Or build it as a stack."
          subtitle="qkit is the foundation; every kit stacks on top of the queue."
          variant="blocks"
        />
        <StackerShell
          eyebrow="Option C · Flow"
          title="Watch an order move through your stack."
          subtitle="A pipeline — the order travels left to right and each kit does its part."
          variant="flow"
        />
        <StackerShell
          eyebrow="Option D · Iso blocks (CSS 3D)"
          title="Stack the modules in 3D."
          subtitle="An isometric tower — pure CSS, no three.js."
          variant="iso"
        />

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
