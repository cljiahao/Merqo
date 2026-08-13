"use client";

import { toast } from "sonner";
import Link from "next/link";
import { AccountMenu as SharedAccountMenu } from "@merqo/ui";
import { signOutAction } from "@/app/actions/auth";
import { submitFeedbackAction } from "@/app/actions/feedback";
import { submitSupportMessageAction } from "@/app/actions/support";
import {
  SUPPORT_CATEGORY_LABELS,
  type SupportMessageInput,
} from "@/lib/feedback-support-schemas";

const HELP_CATEGORIES = (
  Object.keys(SUPPORT_CATEGORY_LABELS) as SupportMessageInput["category"][]
).map((value) => ({ value, label: SUPPORT_CATEGORY_LABELS[value] }));

// @merqo/ui's getHelp.onSubmit types `category` as a bare `string | undefined`
// (it has no knowledge of Merqo's own category literals), so narrow it back
// to SupportMessageInput["category"] by checking membership in the values
// HELP_CATEGORIES itself offered, instead of asserting the type.
const HELP_CATEGORY_VALUES: readonly string[] = HELP_CATEGORIES.map(
  (c) => c.value,
);
function isSupportCategory(
  value: string | undefined,
): value is SupportMessageInput["category"] {
  return value !== undefined && HELP_CATEGORY_VALUES.includes(value);
}

function onError(error: unknown) {
  toast.error(error instanceof Error ? error.message : "Something went wrong");
}

/** True for the internal control-flow error Next.js throws from `redirect()`
 *  inside a Server Action. `signOutAction` redirects to `/login` on success;
 *  @merqo/ui's `useAsyncAction` catches ANY throw from the action it's given
 *  and forwards it to `onError`, so without this guard every sign-out would
 *  surface a raw "NEXT_REDIRECT" toast even though the redirect itself
 *  already succeeded. */
function isNextRedirectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

async function handleSignOut() {
  try {
    await signOutAction();
  } catch (error) {
    if (isNextRedirectError(error)) return;
    throw error;
  }
}

/**
 * Shared account-menu trigger for /dashboard and /admin headers, composed
 * from @merqo/ui's `AccountMenu` — an image avatar (or initials fallback)
 * that opens a dropdown with the signed-in email, a Profile link, Get help
 * and Feedback (each opening a Sheet form), an optional switch link for
 * dual-role accounts, and Sign out.
 *
 * Merqo has no per-user display name distinct from email at the account-menu
 * level (unlike qkit's vendor "stall name"), so `email` fills both the
 * shared component's `vendor.name` (used only for the initials fallback) and
 * `vendor.subtitle` (the one line actually rendered next to the trigger and
 * in the dropdown header) — matching this component's pre-migration behavior
 * exactly. Merqo has no `/dashboard/plan` or kit-local settings route, so
 * `showPlanItem` is off and `kitLocalSettingsHref` is omitted; the shared
 * component's Profile link is hardcoded to `/dashboard/profile`, which
 * `src/app/dashboard/profile/page.tsx` now redirects to Merqo's real,
 * persona-shared `/profile` route.
 */
export function AccountMenu({
  email,
  avatarUrl,
  switchTo,
}: {
  email?: string | null;
  avatarUrl?: string | null;
  switchTo?: { href: string; label: string };
}) {
  return (
    <SharedAccountMenu
      vendor={{
        name: email ?? "",
        avatarUrl: avatarUrl ?? undefined,
        subtitle: email ?? undefined,
      }}
      signOutAction={handleSignOut}
      showPlanItem={false}
      getHelp={{
        type: "form",
        onSubmit: async ({ message, category }) => {
          const res = await submitSupportMessageAction({
            category: isSupportCategory(category) ? category : "other",
            body: message,
          });
          if (!res.success) throw new Error(res.error);
        },
        categories: HELP_CATEGORIES,
      }}
      onFeedbackSubmit={async ({ message, nps }) => {
        const res = await submitFeedbackAction({
          nps: nps ?? 0,
          message: message.trim() || undefined,
        });
        if (!res.success) throw new Error(res.error);
      }}
      feedbackMetric="nps"
      showNps
      extraLink={switchTo}
      onError={onError}
      LinkComponent={Link}
    />
  );
}
