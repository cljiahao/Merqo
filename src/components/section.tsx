import { InfoTooltip } from "@/components/info-tooltip";

/** Field-group card for account-settings-style pages (icon chip, eyebrow,
 *  title, description, optional header tooltip) — see the cross-kit
 *  profile-page standard, docs/business/2026-07-21-profile-settings-page-standard.md §2.1. */
export function Section({
  icon,
  eyebrow,
  title,
  description,
  tooltip,
  children,
}: {
  icon: React.ReactNode;
  eyebrow?: string;
  title: string;
  description: string;
  tooltip?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-card px-6 py-6">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </span>
        <div>
          {eyebrow && (
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {eyebrow}
            </p>
          )}
          <div className="flex items-center gap-1.5">
            <h2 className="font-display text-xl font-semibold leading-tight">
              {title}
            </h2>
            {tooltip && (
              <InfoTooltip ariaLabel="More about this section">
                {tooltip}
              </InfoTooltip>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  );
}
