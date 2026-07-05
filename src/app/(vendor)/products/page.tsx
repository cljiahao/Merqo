import { requireVendor, resolveVendorCatalog } from "@/lib/vendor";
import { joinWaitlistAction } from "./actions";

export const revalidate = 0;

export default async function VendorProductsPage() {
  const { email } = await requireVendor();
  const catalog = await resolveVendorCatalog(email);
  const owned = catalog.filter((c) => c.owned === "active");
  const rest = catalog.filter((c) => c.owned !== "active");

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-bold">Your Merqo products</h1>

      <section className="mt-4">
        <h2 className="font-semibold">Active</h2>
        {owned.length === 0 ? (
          <p className="text-sm text-gray-500">No active products yet.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {owned.map((c) => (
              <li key={c.slug} className="rounded border p-3">
                <span className="font-medium">{c.name}</span>{" "}
                {c.app_url && (
                  <a className="text-blue-600 underline" href={c.app_url}>
                    Open
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6">
        <h2 className="font-semibold">Add more</h2>
        <ul className="mt-2 space-y-2">
          {rest.map((c) => (
            <li
              key={c.slug}
              className="flex items-center justify-between rounded border p-3"
            >
              <span>
                <span className="font-medium">{c.name}</span>
                {c.status === "coming_soon" && (
                  <span className="ml-2 text-xs text-gray-500">
                    Coming soon
                  </span>
                )}
              </span>
              {c.owned === "waitlist" ? (
                <span className="text-sm text-green-600">On waitlist</span>
              ) : (
                <form action={joinWaitlistAction}>
                  <input type="hidden" name="product_slug" value={c.slug} />
                  <button
                    className="rounded bg-black px-3 py-1 text-sm text-white"
                    type="submit"
                  >
                    Join waitlist
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
