import { AcceptForm } from "./accept-form";

export const revalidate = 0;

// Deliberately does NOT call requireVendorSession (or any other legal-gate
// check) — this page is what that gate redirects TO. Gating it the same way
// would be an infinite redirect loop. acceptLegalTerms (actions.ts) re-checks
// for a signed-in user on submit and sends a signed-out visitor to /login.
export default async function LegalAcceptPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <div className="mx-auto max-w-md px-5 py-16">
      <h1 className="mb-4 text-xl font-semibold">
        Our terms have been updated
      </h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Please review and accept before continuing.
      </p>
      <AcceptForm next={next ?? "/dashboard"} />
    </div>
  );
}
