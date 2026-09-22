"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { ArrowLeft, Images, MoreHorizontal, Shuffle, Sparkles, Type } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Segmented, selectClass } from "@/components/app/segmented";
import { EditableSlide } from "@/components/slides/editable-slide";
import { ScaledSlide, Slide } from "@/components/slides/slide";
import { TEXT_STYLES } from "@/lib/slides/styles";
import type { CampaignLayout, SlideKind, SlideLayout, TextAlign, TextStyleId } from "@/lib/slides/types";
import { cn } from "@/lib/utils";
import {
  aiOptimizePrompt,
  aiPreviewContent,
  deleteCampaign,
  updateCampaign,
  type CampaignPatch,
  type CopyItem,
} from "../actions";
import { CopyList } from "./copy-list";

export type EditorCampaign = {
  id: string;
  name: string;
  status: string;
  product_id: string | null;
  language: string;
  content_prompt: string;
  content_slide_count: number;
  content_format: "numbered" | "steps" | "plain";
  content_length: "short" | "medium" | "long";
  tone: "plain" | "punchy" | "expert" | "warm";
  web_research: boolean;
  cta_enabled: boolean;
  layout: CampaignLayout;
};

export type EditorLibrary = { id: string; name: string; images: string[] };

type Props = {
  campaign: EditorCampaign;
  hooks: CopyItem[];
  ctas: CopyItem[];
  products: { id: string; name: string }[];
  libraries: EditorLibrary[];
};

const TABS: { value: SlideKind; label: string }[] = [
  { value: "hook", label: "Hook" },
  { value: "content", label: "Content" },
  { value: "cta", label: "CTA" },
];

const AUTOSAVE_MS = 600;

/** Local campaign state with debounced saves; flush() forces pending changes to the server. */
function useAutosave(initial: EditorCampaign) {
  const [campaign, setCampaign] = useState(initial);
  const [status, setStatus] = useState<"saved" | "saving" | "error">("saved");
  const pending = useRef<CampaignPatch>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflight = useRef<Promise<void>>(Promise.resolve());

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const patch = pending.current;
    pending.current = {};
    if (Object.keys(patch).length > 0) {
      setStatus("saving");
      inflight.current = inflight.current
        .then(() => updateCampaign(initial.id, patch))
        .then(() => setStatus("saved"))
        .catch(() => {
          setStatus("error");
          toast.error("Could not save changes");
        });
    }
    await inflight.current;
  }, [initial.id]);

  const patch = useCallback(
    (p: CampaignPatch) => {
      setCampaign((c) => ({ ...c, ...p }));
      pending.current = { ...pending.current, ...p };
      setStatus("saving");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), AUTOSAVE_MS);
    },
    [flush],
  );

  useEffect(() => {
    const onUnload = () => void flush();
    window.addEventListener("beforeunload", onUnload);
    return () => {
      window.removeEventListener("beforeunload", onUnload);
      void flush();
    };
  }, [flush]);

  return { campaign, patch, flush, status };
}

export function CampaignEditor({ campaign: initial, hooks: initialHooks, ctas: initialCtas, products, libraries }: Props) {
  const { campaign, patch, flush, status } = useAutosave(initial);
  const [hooks, setHooks] = useState(initialHooks);
  const [ctas, setCtas] = useState(initialCtas);
  const [tab, setTab] = useState<SlideKind>("hook");
  const [contentIndex, setContentIndex] = useState(0);
  const [previewHookId, setPreviewHookId] = useState<string | null>(null);
  const [previewCtaId, setPreviewCtaId] = useState<string | null>(null);
  const [previewSlides, setPreviewSlides] = useState<string[] | null>(null);
  const [seed, setSeed] = useState(0);
  const [showSafeArea, setShowSafeArea] = useState(false);
  const [aiBusy, startAi] = useTransition();

  const layout = campaign.layout;
  const setKindLayout = (kind: SlideKind, p: Partial<SlideLayout>) =>
    patch({ layout: { ...layout, [kind]: { ...layout[kind], ...p } } });

  // ─── Preview content ──────────────────────────────────────────────────────
  const hookText =
    hooks.find((h) => h.id === previewHookId)?.text ?? hooks.find((h) => h.enabled)?.text ?? "Your hook goes here";
  const ctaText = ctas.find((c) => c.id === previewCtaId)?.text ?? ctas.find((c) => c.enabled)?.text ?? "";
  const contentTexts = Array.from({ length: campaign.content_slide_count }, (_, i) => {
    if (previewSlides?.[i]) return previewSlides[i];
    const prefix = { numbered: `${i + 1}. `, steps: `Step ${i + 1}: `, plain: "" }[campaign.content_format];
    return `${prefix}Content slide ${i + 1} appears here`;
  });

  const imagesFor = (kind: SlideKind) => libraries.find((l) => l.id === layout[kind].libraryId)?.images ?? [];
  const imageAt = (kind: SlideKind, index: number) => {
    const images = imagesFor(kind);
    return images.length ? images[(seed + index) % images.length] : null;
  };

  const strip: { kind: SlideKind; index: number; text: string }[] = [
    { kind: "hook", index: 0, text: hookText },
    ...contentTexts.map((text, index) => ({ kind: "content" as const, index, text })),
    ...(campaign.cta_enabled ? [{ kind: "cta" as const, index: 0, text: ctaText }] : []),
  ];
  const active = tab === "content" ? strip[1 + Math.min(contentIndex, contentTexts.length - 1)] : strip.find((s) => s.kind === tab) ?? strip[0];

  function generatePreview() {
    startAi(async () => {
      await flush();
      const res = await aiPreviewContent(campaign.id, hookText);
      if (!res.ok) return void toast.error(res.error);
      setPreviewSlides(res.data);
      setTab("content");
      setContentIndex(0);
    });
  }

  function optimizePrompt() {
    startAi(async () => {
      await flush();
      const res = await aiOptimizePrompt(campaign.id);
      if (!res.ok) return void toast.error(res.error);
      patch({ content_prompt: res.data });
      toast.success("Prompt optimized");
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/campaigns" className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Back">
          <ArrowLeft className="size-4" />
        </Link>
        <Input
          value={campaign.name}
          onChange={(e) => patch({ name: e.target.value })}
          className="h-9 max-w-sm border-transparent bg-transparent text-lg font-semibold dark:bg-transparent hover:border-border"
        />
        <span className="text-xs text-muted-foreground">
          {status === "saving" ? "Saving…" : status === "error" ? "Not saved" : "Saved"}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <select
            value={campaign.product_id ?? ""}
            onChange={(e) => patch({ product_id: e.target.value || null })}
            className={selectClass}
            aria-label="Product"
          >
            <option value="">No product</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            value={campaign.language}
            onChange={(e) => patch({ language: e.target.value })}
            className={selectClass}
            aria-label="Language"
          >
            <option value="en">English</option>
            <option value="de">German</option>
          </select>
          <Link
            href={`/campaigns/${campaign.id}/posts`}
            onClick={() => void flush()}
            className={cn(buttonVariants(), "glow-hover")}
          >
            <Sparkles /> Posts & generate
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Campaign options" />}>
              <MoreHorizontal />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                variant="destructive"
                onClick={() => {
                  if (confirm(`Delete campaign "${campaign.name}"? Its hooks, CTAs and posts are deleted too.`)) {
                    void deleteCampaign(campaign.id);
                  }
                }}
              >
                Delete campaign
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[1fr_360px]">
        {/* Editor */}
        <section className="panel">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
            <div className="flex rounded-xl bg-secondary p-1">
              {TABS.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setTab(t.value)}
                  className={cn(
                    "rounded-lg px-4 py-1.5 text-sm transition-colors",
                    tab === t.value ? "bg-primary font-medium text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <KindToolbar
              layout={layout[tab]}
              libraries={libraries}
              onChange={(p) => setKindLayout(tab, p)}
            />
          </div>

          <div className="space-y-6 p-5">
            {tab === "hook" && (
              <CopyList
                kind="hook"
                campaignId={campaign.id}
                items={hooks}
                onItemsChange={setHooks}
                previewId={previewHookId}
                onPreview={setPreviewHookId}
                beforeAi={flush}
              />
            )}

            {tab === "content" && (
              <ContentSettings
                campaign={campaign}
                patch={patch}
                aiBusy={aiBusy}
                onOptimize={optimizePrompt}
                onGenerate={generatePreview}
              />
            )}

            {tab === "cta" && (
              <div className="space-y-5">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={campaign.cta_enabled}
                    onChange={(e) => patch({ cta_enabled: e.target.checked })}
                    className="size-4 accent-[var(--accent-primary)]"
                  />
                  End every post with a CTA slide
                </label>
                {campaign.cta_enabled && (
                  <>
                    <CopyList
                      kind="cta"
                      campaignId={campaign.id}
                      items={ctas}
                      onItemsChange={setCtas}
                      previewId={previewCtaId}
                      onPreview={setPreviewCtaId}
                      beforeAi={flush}
                    />
                    <p className="text-xs text-muted-foreground">
                      Tip: use app screenshots with the App Store badge as CTA images. Without any CTA text the slide shows
                      only the image.
                    </p>
                  </>
                )}
              </div>
            )}

            <LayoutControls layout={layout[tab]} onChange={(p) => setKindLayout(tab, p)} />
          </div>
        </section>

        {/* Preview */}
        <aside className="panel space-y-4 p-4 xl:sticky xl:top-6">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Preview</p>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSafeArea((v) => !v)}
                className={cn(showSafeArea && "text-primary")}
                title="Areas covered by TikTok's buttons and caption"
              >
                Safe area
              </Button>
              <Button variant="ghost" size="icon-sm" onClick={() => setSeed((s) => s + 1 + Math.floor(Math.random() * 7))} aria-label="Shuffle images" title="Shuffle images">
                <Shuffle />
              </Button>
            </div>
          </div>

          <div className="flex justify-center">
            <EditableSlide
              width={300}
              kind={active.kind}
              layout={layout[active.kind]}
              text={active.text}
              imageUrl={imageAt(active.kind, active.index)}
              showSafeArea={showSafeArea}
              onBoxChange={(box) => setKindLayout(active.kind, { box })}
            />
          </div>
          <p className="text-center text-xs text-muted-foreground">
            Drag the text to move it, pull the green handles to change its width. Applies to every {active.kind} slide.
          </p>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {strip.map((s, i) => {
              const isActive = s === active;
              return (
                <button
                  key={`${s.kind}-${s.index}`}
                  onClick={() => {
                    setTab(s.kind);
                    if (s.kind === "content") setContentIndex(s.index);
                  }}
                  className={cn("shrink-0 rounded-[10px] ring-offset-2 ring-offset-card", isActive ? "ring-2 ring-primary" : "opacity-70 hover:opacity-100")}
                  aria-label={`Slide ${i + 1}`}
                >
                  <ScaledSlide width={56}>
                    <Slide kind={s.kind} layout={layout[s.kind]} text={s.text} imageUrl={imageAt(s.kind, s.index)} />
                  </ScaledSlide>
                </button>
              );
            })}
          </div>
          {!previewSlides && (
            <Button variant="outline" size="sm" className="w-full text-primary" onClick={generatePreview} disabled={aiBusy}>
              <Sparkles className={cn(aiBusy && "animate-pulse")} /> {aiBusy ? "Writing…" : "Generate sample content"}
            </Button>
          )}
        </aside>
      </div>
    </div>
  );
}

function KindToolbar({
  layout,
  libraries,
  onChange,
}: {
  layout: SlideLayout;
  libraries: EditorLibrary[];
  onChange: (p: Partial<SlideLayout>) => void;
}) {
  const library = libraries.find((l) => l.id === layout.libraryId);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label
        className={cn(
          "flex h-8 items-center gap-2 rounded-lg border pl-2.5 text-sm",
          library ? "border-primary/60" : "border-destructive/60",
        )}
      >
        <Images className="size-4 text-muted-foreground" />
        <select
          value={layout.libraryId ?? ""}
          onChange={(e) => onChange({ libraryId: e.target.value || null })}
          className="h-full bg-transparent pr-2 outline-none [&>option]:bg-popover"
          aria-label="Image library"
        >
          <option value="">Choose library…</option>
          {libraries.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name} ({l.images.length})
            </option>
          ))}
        </select>
      </label>
      <label className="flex h-8 items-center gap-2 rounded-lg border border-border pl-2.5 text-sm">
        <Type className="size-4 text-muted-foreground" />
        <select
          value={layout.style}
          onChange={(e) => onChange({ style: e.target.value as TextStyleId })}
          className="h-full bg-transparent pr-2 outline-none [&>option]:bg-popover"
          aria-label="Text style"
        >
          {Object.entries(TEXT_STYLES).map(([id, s]) => (
            <option key={id} value={id}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function LayoutControls({ layout, onChange }: { layout: SlideLayout; onChange: (p: Partial<SlideLayout>) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-4 border-t border-border pt-5">
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Text alignment</Label>
        <Segmented<TextAlign>
          size="sm"
          value={layout.align}
          onChange={(align) => onChange({ align })}
          options={[
            { value: "left", label: "Left" },
            { value: "center", label: "Center" },
            { value: "right", label: "Right" },
          ]}
        />
      </div>
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Darken image · {Math.round(layout.dim * 100)}%</Label>
        <input
          type="range"
          min={0}
          max={0.7}
          step={0.05}
          value={layout.dim}
          onChange={(e) => onChange({ dim: Number(e.target.value) })}
          className="w-40 accent-[var(--accent-primary)]"
        />
      </div>
    </div>
  );
}

function ContentSettings({
  campaign,
  patch,
  aiBusy,
  onOptimize,
  onGenerate,
}: {
  campaign: EditorCampaign;
  patch: (p: CampaignPatch) => void;
  aiBusy: boolean;
  onOptimize: () => void;
  onGenerate: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="content_prompt" className="text-muted-foreground">
            What the posts are about
          </Label>
          <Button variant="ghost" size="sm" className="text-primary" onClick={onOptimize} disabled={aiBusy || !campaign.content_prompt}>
            <Sparkles /> Optimize prompt
          </Button>
        </div>
        <Textarea
          id="content_prompt"
          rows={4}
          value={campaign.content_prompt}
          onChange={(e) => patch({ content_prompt: e.target.value })}
          placeholder="e.g. Unconventional ways to get more candid photos at your wedding. Every tip must be practical and specific."
        />
        <p className="text-xs text-muted-foreground">
          Be specific: vague prompts produce vague slides. The content is written fresh for every post.
        </p>
      </div>

      <div className="flex flex-wrap gap-x-10 gap-y-5">
        <div className="space-y-2">
          <Label className="text-muted-foreground">Slides</Label>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => patch({ content_slide_count: Math.max(1, campaign.content_slide_count - 1) })}
              aria-label="Fewer slides"
            >
              −
            </Button>
            <span className="w-6 text-center tabular-nums">{campaign.content_slide_count}</span>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => patch({ content_slide_count: Math.min(10, campaign.content_slide_count + 1) })}
              aria-label="More slides"
            >
              +
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-muted-foreground">Format</Label>
          <Segmented
            value={campaign.content_format}
            onChange={(content_format) => patch({ content_format })}
            options={[
              { value: "numbered", label: "Numbered" },
              { value: "steps", label: "Steps" },
              { value: "plain", label: "Plain" },
            ]}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-x-10 gap-y-5 border-t border-border pt-5">
        <div className="space-y-2">
          <Label className="text-muted-foreground">Length</Label>
          <Segmented
            value={campaign.content_length}
            onChange={(content_length) => patch({ content_length })}
            options={[
              { value: "short", label: "5–7 words" },
              { value: "medium", label: "10–12 words" },
              { value: "long", label: "15–20 words" },
            ]}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-muted-foreground">Tone</Label>
          <Segmented
            value={campaign.tone}
            onChange={(tone) => patch({ tone })}
            options={[
              { value: "plain", label: "Plain" },
              { value: "punchy", label: "Punchy" },
              { value: "expert", label: "Expert" },
              { value: "warm", label: "Warm" },
            ]}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-muted-foreground">Research</Label>
          <Segmented
            value={campaign.web_research ? "web" : "off"}
            onChange={(v) => patch({ web_research: v === "web" })}
            options={[
              { value: "off", label: "Off" },
              { value: "web", label: "Search the web" },
            ]}
          />
        </div>
      </div>

      <Button variant="outline" className="text-primary" onClick={onGenerate} disabled={aiBusy}>
        <Sparkles className={cn(aiBusy && "animate-pulse")} /> {aiBusy ? "Writing…" : "Generate sample content for the preview"}
      </Button>
    </div>
  );
}
