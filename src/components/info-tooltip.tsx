import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/** Icon + tooltip trigger, parameterized on aria-label so a section header
 *  and a field can each say "More about this section"/"More about this
 *  setting" as appropriate — see the cross-kit profile-page standard,
 *  docs/business/2026-07-21-profile-settings-page-standard.md §2.2. */
export function InfoTooltip({
  children,
  ariaLabel = "More info",
}: {
  children: React.ReactNode;
  ariaLabel?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          className="inline-flex text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 rounded-sm"
        >
          <Info className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-sm">{children}</TooltipContent>
    </Tooltip>
  );
}
