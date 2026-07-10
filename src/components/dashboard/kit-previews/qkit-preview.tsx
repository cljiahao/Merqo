import { MockupWindow } from "./mockup-window";

export function QkitPreview() {
  return (
    <MockupWindow>
      <div className="text-center">
        <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground">
          Now serving
        </p>
        <p className="font-display text-3xl font-bold text-primary">42</p>
      </div>
    </MockupWindow>
  );
}
