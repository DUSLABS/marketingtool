"use client";

import { useState, useTransition } from "react";
import { Eye, Info, Plus, Sparkles, X } from "lucide-react";
import { hookItemCount } from "@/lib/slides/hooks";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  addCopyItem,
  aiGenerateCtas,
  aiGenerateHooks,
  deleteCopyItem,
  updateCopyItem,
  type AiResult,
  type CopyItem,
} from "../actions";

const COPY = {
  hook: { placeholder: "Type a hook, press Enter to add", noun: "hook", generate: "Generate hooks" },
  cta: { placeholder: "Type a CTA, press Enter to add", noun: "CTA", generate: "Generate CTAs" },
} as const;

/** Hooks or CTAs: the campaign picks one enabled item per post. */
export function CopyList({
  kind,
  campaignId,
  slideCount,
  items,
  onItemsChange,
  previewId,
  onPreview,
  beforeAi,
}: {
  kind: "hook" | "cta";
  campaignId: string;
  /** Content slides per post; numbered hooks that promise a different count get a hint. */
  slideCount?: number;
  items: CopyItem[];
  onItemsChange: (items: CopyItem[]) => void;
  previewId: string | null;
  onPreview: (id: string) => void;
  /** Called before AI actions so pending autosaves (e.g. the prompt) reach the server first. */
  beforeAi: () => Promise<void>;
}) {
  const [draft, setDraft] = useState("");
  const [generating, startGenerating] = useTransition();
  const [, startTransition] = useTransition();
  const copy = COPY[kind];
  const enabled = items.filter((i) => i.enabled).length;

  function add() {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    startTransition(async () => {
      try {
        const item = await addCopyItem(kind, campaignId, text);
        onItemsChange([...items, item]);
        onPreview(item.id);
      } catch {
        toast.error(`Could not add ${copy.noun}`);
        setDraft(text);
      }
    });
  }

  function generate() {
    startGenerating(async () => {
      await beforeAi();
      const res: AiResult<CopyItem[]> = kind === "hook" ? await aiGenerateHooks(campaignId) : await aiGenerateCtas(campaignId);
      if (!res.ok) return void toast.error(res.error);
      onItemsChange([...items, ...res.data]);
      toast.success(`${res.data.length} ${copy.noun}s added`);
    });
  }

  function toggle(item: CopyItem) {
    onItemsChange(items.map((i) => (i.id === item.id ? { ...i, enabled: !i.enabled } : i)));
    startTransition(() => updateCopyItem(kind, item.id, { enabled: !item.enabled }));
  }

  function remove(item: CopyItem) {
    onItemsChange(items.filter((i) => i.id !== item.id));
    startTransition(() => deleteCopyItem(kind, item.id));
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={copy.placeholder}
          className="h-10"
        />
        <Button variant="outline" size="icon-lg" className="size-10" onClick={add} aria-label={`Add ${copy.noun}`}>
          <Plus />
        </Button>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {items.length === 0
            ? `No ${copy.noun}s yet.`
            : `${enabled} of ${items.length} ${copy.noun}s active, rotating one per post. Click to switch on/off.`}
        </p>
        <Button variant="outline" size="sm" onClick={generate} disabled={generating} className="shrink-0 text-primary">
          <Sparkles className={cn(generating && "animate-pulse")} /> {generating ? "Writing…" : copy.generate}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <div
            key={item.id}
            className={cn(
              "group flex max-w-full items-center gap-1 rounded-xl border py-1 pr-1 pl-3 text-sm transition-colors",
              item.enabled ? "border-border bg-secondary/60" : "border-dashed border-border text-muted-foreground line-through",
              previewId === item.id && "border-primary/70",
            )}
          >
            <button className="truncate text-left" onClick={() => toggle(item)} title={item.enabled ? "Switch off" : "Switch on"}>
              {item.text || <span className="italic">Image only</span>}
            </button>
            {item.style && <span className="shrink-0 pl-1 text-[10px] tracking-wider text-muted-foreground uppercase">{item.style}</span>}
            {kind === "hook" && slideCount && hookItemCount(item.text) && hookItemCount(item.text) !== slideCount && (
              <span
                className="flex shrink-0 items-center gap-0.5 pl-1 text-[11px] text-[var(--warning)]"
                title={`This hook promises ${hookItemCount(item.text)} items, so its posts get ${hookItemCount(item.text)} content slides instead of ${slideCount}.`}
              >
                <Info className="size-3" /> {hookItemCount(item.text)} slides
              </span>
            )}
            <button
              onClick={() => onPreview(item.id)}
              className="shrink-0 rounded-md p-1 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground"
              aria-label="Show in preview"
            >
              <Eye className="size-3.5" />
            </button>
            <button
              onClick={() => remove(item)}
              className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground"
              aria-label="Delete"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
