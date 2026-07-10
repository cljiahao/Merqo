import type { ComponentType } from "react";
import { QkitPreview } from "./qkit-preview";
import { LoopkitPreview } from "./loopkit-preview";

export const KIT_PREVIEWS: Record<string, ComponentType> = {
  qkit: QkitPreview,
  loopkit: LoopkitPreview,
};
