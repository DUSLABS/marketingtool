"use client";

import { cn } from "@/lib/utils";

/** Pill options like Volume's format/length/tone pickers. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = "default",
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  size?: "default" | "sm";
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-full border transition-colors",
            size === "sm" ? "px-2.5 py-0.5 text-xs" : "px-3 py-1 text-sm",
            o.value === value
              ? "border-primary/70 bg-primary/10 text-foreground"
              : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export const selectClass =
  "h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 [&>option]:bg-popover";
