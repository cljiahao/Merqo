"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { VendorTelegramSection } from "@merqo/ui";
import {
  mintVendorTelegramConnectToken,
  disconnectVendorTelegram,
} from "./vendor-telegram-actions";

interface Props {
  connected: boolean;
}

/**
 * Adapts the `ActionResult`-returning server actions
 * (`vendor-telegram-actions.ts`) to `@merqo/ui`'s `VendorTelegramSection`
 * throw-on-failure prop contract — same shape as `ProfileForm`'s own
 * `res.success` → toast/throw pattern elsewhere on this page.
 */
export function VendorTelegramConnect({ connected }: Props) {
  const router = useRouter();

  if (connected) {
    return (
      <VendorTelegramSection
        connected
        onDisconnect={async () => {
          const res = await disconnectVendorTelegram();
          if (!res.success) throw new Error(res.error);
          router.refresh();
        }}
        onError={(err) =>
          toast.error(
            err instanceof Error ? err.message : "Something went wrong",
          )
        }
      />
    );
  }

  return (
    <VendorTelegramSection
      connected={false}
      onConnect={async () => {
        const res = await mintVendorTelegramConnectToken();
        if (!res.success) throw new Error(res.error);
        return { deepLink: res.deepLink, qrSvgMarkup: res.qrSvgMarkup };
      }}
      onError={(err) =>
        toast.error(err instanceof Error ? err.message : "Something went wrong")
      }
    />
  );
}
