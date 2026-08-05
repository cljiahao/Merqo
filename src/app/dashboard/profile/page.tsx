import { redirect } from "next/navigation";

/**
 * @merqo/ui's `AccountMenu` hardcodes its Profile link to `/dashboard/profile`
 * (the convention every other kit in the family follows). Merqo's actual
 * account page lives at the top-level `/profile` — shared by both the vendor
 * dashboard and the admin console, so it can't sit under `/dashboard` (see
 * `src/app/profile/page.tsx`'s own comment on why). This route exists solely
 * to keep the shared component's hardcoded link working without patching
 * @merqo/ui itself.
 */
export default function DashboardProfileRedirect() {
  redirect("/profile");
}
