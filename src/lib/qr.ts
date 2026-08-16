import QRCode from "qrcode";

/**
 * Renders `text` (a Telegram deep link) as an inline SVG markup string —
 * used by the vendor Telegram-connect flow (`src/app/profile/`) to hand
 * `@merqo/ui`'s `VendorTelegramSection` a QR block via
 * `dangerouslySetInnerHTML`, same shape/library as loopkit's and qkit's
 * own (now-retired, Phase A2) per-kit `qrSvg` helpers.
 */
export async function qrSvg(text: string): Promise<string> {
  return QRCode.toString(text, {
    type: "svg",
    margin: 1,
    errorCorrectionLevel: "M",
  });
}
