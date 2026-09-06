import Link from "next/link";
import { AboutMerqo } from "@merqo/ui";
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
        <AboutMerqo>
          <Button asChild size="lg">
            <Link href="/#kits">See the kits</Link>
          </Button>
        </AboutMerqo>
      </main>
      <Footer />
    </>
  );
}
