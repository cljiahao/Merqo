import { cn } from "@/lib/utils";
import { MockupWindow } from "./mockup-window";

const STAMPS_FILLED = 3;
const STAMPS_TOTAL = 8;

export function LoopkitPreview() {
  return (
    <MockupWindow>
      <div className="flex gap-1.5">
        {Array.from({ length: STAMPS_TOTAL }, (_, i) => {
          const filled = i < STAMPS_FILLED;
          return (
            <span
              key={i}
              data-filled={filled}
              className={cn(
                "size-4 rounded-full border-2",
                filled
                  ? "border-primary bg-primary"
                  : "border-muted-foreground/25",
              )}
            />
          );
        })}
      </div>
    </MockupWindow>
  );
}
