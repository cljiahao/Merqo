import type { OpenSupportMessage } from "@/lib/support";
import { ResolveSupportMessageButton } from "./resolve-support-message-button";

/**
 * One row in the admin "Needs attention" support-message list. `kit_slug`
 * renders as "merqo" when null — the existing, unchanged meaning of a hub-
 * level message (see the cross-kit-support-messages design spec).
 * `category` is plain text, not a labeled enum lookup — any kit can now
 * write its own category vocabulary through the shared RPC.
 */
export function SupportMessageRow({
  message,
}: {
  message: OpenSupportMessage;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/[0.04] px-4 py-3 text-sm">
      <div className="min-w-0">
        <p className="truncate font-medium">{message.email ?? "Unknown"}</p>
        <p className="truncate text-xs text-muted-foreground">
          <span className="font-mono text-[10px] uppercase tracking-wide">
            {message.kit_slug ?? "merqo"}
          </span>{" "}
          · {message.category} — {message.body}
        </p>
      </div>
      <ResolveSupportMessageButton id={message.id} />
    </div>
  );
}
