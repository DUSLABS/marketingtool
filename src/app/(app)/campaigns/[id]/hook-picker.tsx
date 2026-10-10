"use client";

import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type PickerHook = { id: string; text: string; enabled: boolean };

const ROTATE = "rotate";

/** Chooses the hook the next generated post is built on. `null` rotates through the active hooks. */
export function HookPicker({
  hooks,
  value,
  onChange,
  allowRotation = false,
  disabled,
}: {
  hooks: PickerHook[];
  value: string | null;
  onChange: (id: string | null) => void;
  /** Offer "rotate" where no single hook is on screen (the posts page). */
  allowRotation?: boolean;
  disabled?: boolean;
}) {
  const current = hooks.find((h) => h.id === value);
  const label = current ? current.text || "Image only" : allowRotation ? "Rotate active hooks" : "Choose a hook";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" className="h-9 max-w-60" />}
        disabled={disabled || hooks.length === 0}
        title="The hook the next post is built on. Content, CTA and images follow it."
      >
        <span className="text-muted-foreground">Hook</span>
        <span className="min-w-0 truncate">{label}</span>
        <ChevronDown className="opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96 max-w-[calc(100vw-2rem)]">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Build the next post on</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={current ? current.id : ROTATE} onValueChange={(v) => onChange(v === ROTATE ? null : v)}>
            {allowRotation && (
              <DropdownMenuRadioItem value={ROTATE} closeOnClick>
                Rotate active hooks (least used first)
              </DropdownMenuRadioItem>
            )}
            {hooks.map((h) => (
              <DropdownMenuRadioItem key={h.id} value={h.id} closeOnClick className={cn("items-start", !h.enabled && "text-muted-foreground")}>
                <span className="min-w-0 flex-1 whitespace-normal">{h.text || <span className="italic">Image only</span>}</span>
                {!h.enabled && <span className="shrink-0 pt-0.5 text-[10px] tracking-wider uppercase">off</span>}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
