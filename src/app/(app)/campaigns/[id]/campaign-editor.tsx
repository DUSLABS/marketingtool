"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  ArrowLeft,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  GalleryHorizontalEnd,
  ImageIcon,
  Images,
  MoreHorizontal,
  Palette,
  PanelRightClose,
  PanelRightOpen,
  Send,
  Sparkles,
  Type,
} from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Segmented, selectClass } from "@/components/app/segmented";
import { EditableSlide } from "@/components/slides/editable-slide";
import { ScaledSlide, Slide } from "@/components/slides/slide";
import { TEXT_STYLES } from "@/lib/slides/styles";
import { ctaPosition, type BadgeLayout, type CampaignLayout, type ImageCrop, type SlideKind, type SlideLayout, type TextAlign, type TextStyleId } from "@/lib/slides/types";
import { cn } from "@/lib/utils";
import {
  aiOptimizePrompt,
  aiPreviewContent,
  deleteCampaign,
  updateCampaign,
  type CampaignPatch,
  type CopyItem,
  type Slot,
} from "../actions";
import { generateAndSendPost, generatePost } from "./posts/actions";
import { CopyList } from "./copy-list";
import { PublishSettings, type PublishAccount } from "./publish-settings";
import { PostEditorDialog } from "./post-editor";

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
  tiktok_account_id: string | null;
  publish_mode: "draft" | "direct";
  privacy_level: string | null;
  allow_comments: boolean;
  disclose_commercial: boolean;
  ai_label: boolean;
  timezone: string;
  max_posts_per_day: number;
};

export type EditorImage = { url: string; crop: ImageCrop | null };
export type EditorLibrary = { id: string; name: string; images: EditorImage[] };

type Props = {
  campaign: EditorCampaign;
  hooks: CopyItem[];
  ctas: CopyItem[];
  products: { id: string; name: string }[];
  libraries: EditorLibrary[];
  accounts: PublishAccount[];
  slots: Slot[];
  postCount: number;
};

const TABS: { value: SlideKind; label: string }[] = [
  { value: "hook", label: "Hook" },
  { value: "content", label: "Content" },
  { value: "cta", label: "CTA" },
];

const AUTOSAVE_MS = 600;
const CARD_WIDTH = 176; // 7 slides (hook, 5 content, CTA) fit side by side on a ~1440px wide screen
const ORDINALS = ["first", "second", "third", "4th", "5th", "6th", "7th", "8th", "9th", "10th"];

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

type StripSlide = { kind: SlideKind; index: number; text: string; placeholder: boolean };

export function CampaignEditor({
  campaign: initial,
  hooks: initialHooks,
  ctas: initialCtas,
  products,
  libraries,
  accounts,
  slots,
  postCount,
}: Props) {
  const router = useRouter();
  const { campaign, patch, flush, status } = useAutosave(initial);
  const [hooks, setHooks] = useState(initialHooks);
  const [ctas, setCtas] = useState(initialCtas);
  const [tab, setTab] = useState<SlideKind>("hook");
  const [selected, setSelected] = useState<{ kind: SlideKind; index: number }>({ kind: "hook", index: 0 });
  const [previewHookId, setPreviewHookId] = useState<string | null>(null);
  const [previewCtaId, setPreviewCtaId] = useState<string | null>(null);
  const [previewSlides, setPreviewSlides] = useState<string[] | null>(null);
  const [showSafeArea, setShowSafeArea] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [aiBusy, startAi] = useTransition();
  const [postBusy, startPost] = useTransition();
  const [postAction, setPostAction] = useState<"generate" | "send" | null>(null);
  const [generatedPost, setGeneratedPost] = useState<{ id: string | null; generating: boolean } | null>(null);

  const layout = campaign.layout;
  const setKindLayout = (kind: SlideKind, p: Partial<SlideLayout>) =>
    patch({ layout: { ...layout, [kind]: { ...layout[kind], ...p } } });

  // ─── Slides shown in the strip ────────────────────────────────────────────
  const enabledHooks = hooks.filter((h) => h.enabled);
  const hookText = hooks.find((h) => h.id === previewHookId)?.text ?? enabledHooks[0]?.text ?? "";
  const ctaText = ctas.find((c) => c.id === previewCtaId)?.text ?? ctas.find((c) => c.enabled)?.text ?? "";
  const contentTexts = Array.from({ length: campaign.content_slide_count }, (_, i) => {
    if (previewSlides?.[i]) return { text: previewSlides[i], placeholder: false };
    const prefix = { numbered: `${i + 1}. `, steps: `Step ${i + 1}: `, plain: "" }[campaign.content_format];
    return { text: `${prefix}Your ${ORDINALS[i]} point, plus the one detail that makes it land`, placeholder: true };
  });

  const strip: StripSlide[] = [
    { kind: "hook", index: 0, text: hookText || "Your hook goes here", placeholder: !hookText },
    ...contentTexts.map((c, index) => ({ kind: "content" as const, index, ...c })),
  ];
  if (campaign.cta_enabled) {
    strip.splice(ctaPosition(layout.cta.placement, contentTexts.length), 0, { kind: "cta", index: 0, text: ctaText, placeholder: false });
  }

  const imageAt = (kind: SlideKind, index: number) => {
    const images = libraries.find((l) => l.id === layout[kind].libraryId)?.images ?? [];
    return images.length ? images[index % images.length] : null;
  };

  function select(kind: SlideKind, index: number) {
    setSelected({ kind, index });
    setTab(kind);
  }

  function selectTab(kind: SlideKind) {
    setTab(kind);
    setSelected({ kind, index: 0 });
  }

  function cycleHook() {
    if (enabledHooks.length < 2) return;
    const i = enabledHooks.findIndex((h) => h.text === hookText);
    setPreviewHookId(enabledHooks[(i + 1) % enabledHooks.length].id);
  }

  // ─── Actions ──────────────────────────────────────────────────────────────
  function generatePreview() {
    startAi(async () => {
      await flush();
      const res = await aiPreviewContent(campaign.id, hookText || "A useful slideshow for this topic");
      if (!res.ok) return void toast.error(res.error);
      setPreviewSlides(res.data);
      select("content", 0);
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

  const postsHref = `/campaigns/${campaign.id}/posts`;

  function runPost(kind: "generate" | "send") {
    setPostAction(kind);
    // "Generate" opens the preview right away and fills it once the post is rendered.
    if (kind === "generate") setGeneratedPost({ id: null, generating: true });
    startPost(async () => {
      await flush();
      const res = kind === "send" ? await generateAndSendPost(campaign.id) : await generatePost(campaign.id);
      setPostAction(null);
      if (!res.ok) {
        setGeneratedPost(null);
        return void toast.error(res.error, { duration: 10_000 });
      }
      if (kind === "generate") setGeneratedPost({ id: res.data, generating: false });
      else toast.success("Post sent to TikTok", { action: { label: "View", onClick: () => router.push(postsHref) } });
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      {/* ─── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/campaigns" className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Back">
          <ArrowLeft className="size-4" />
        </Link>
        <Input
          value={campaign.name}
          onChange={(e) => patch({ name: e.target.value })}
          className="h-9 w-72 text-base font-medium"
          aria-label="Campaign name"
        />
        <span className="flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-sm text-muted-foreground">
          <GalleryHorizontalEnd className="size-4" /> Slideshow
        </span>
        <StyleMenu layout={layout} onApply={(p) => patch({ layout: { hook: { ...layout.hook, ...p }, content: { ...layout.content, ...p }, cta: { ...layout.cta, ...p } } })} />

        <div className="ml-auto flex items-center gap-2">
          <span className="px-1 text-sm text-muted-foreground">
            {status === "saving" ? "Saving…" : status === "error" ? "Not saved" : "Saved"}
          </span>
          <Button variant="outline" className="h-9" onClick={() => setPreviewOpen(true)}>
            <Eye /> Preview
          </Button>
          <Link href={postsHref} onClick={() => void flush()} className={cn(buttonVariants({ variant: "outline" }), "h-9")}>
            Posts{postCount ? ` (${postCount})` : ""}
          </Link>
          <Button
            variant="outline"
            className="h-9"
            disabled={postBusy || !campaign.tiktok_account_id}
            title={campaign.tiktok_account_id ? "Generate a post and send it to TikTok now" : "Choose a TikTok account in Settings first"}
            onClick={() => runPost("send")}
          >
            <Send className={cn(postAction === "send" && "animate-pulse")} /> {postAction === "send" ? "Sending…" : "Send to TikTok"}
          </Button>
          <Button className={cn("h-9", postBusy ? "glow" : "glow-hover")} disabled={postBusy} onClick={() => runPost("generate")}>
            <Sparkles className={cn(postAction === "generate" && "animate-pulse")} /> {postAction === "generate" ? "Generating…" : "Generate"}
          </Button>
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

      {/* ─── Slide strip ────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border bg-[radial-gradient(var(--line)_1px,transparent_1px)] [background-size:16px_16px] p-5">
        <div className="flex gap-4 overflow-x-auto pb-2">
          {strip.map((s, i) => {
            const isSelected = selected.kind === s.kind && (s.kind !== "content" || selected.index === s.index);
            return (
              <SlideCard
                key={`${s.kind}-${s.index}`}
                number={i + 1}
                slide={s}
                layout={layout[s.kind]}
                image={imageAt(s.kind, s.index)}
                libraries={libraries}
                inTab={s.kind === tab}
                selected={isSelected}
                showSafeArea={showSafeArea}
                label={s.kind === "hook" ? `Hook · ${enabledHooks.length} rotating` : s.kind === "cta" ? "CTA" : "Content"}
                onSelect={() => select(s.kind, s.index)}
                onBoxChange={(box) => setKindLayout(s.kind, { box })}
                onBadgeChange={s.kind === "cta" ? (badge) => setKindLayout("cta", { badge }) : undefined}
                onLibrary={(libraryId) => setKindLayout(s.kind, { libraryId })}
                onEye={s.kind === "hook" ? cycleHook : undefined}
              />
            );
          })}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-xs text-muted-foreground">
          <span>Click a slide to edit it. Drag its text to move it; pull the green handles to change the width.</span>
          <div className="flex items-center gap-3">
            <button className={cn("hover:text-foreground", showSafeArea && "text-primary")} onClick={() => setShowSafeArea((v) => !v)}>
              TikTok safe area
            </button>
            <button className="text-primary hover:underline disabled:opacity-50" onClick={generatePreview} disabled={aiBusy}>
              {aiBusy ? "Writing sample content…" : "✦ Fill with sample content"}
            </button>
          </div>
        </div>
      </div>

      {/* ─── Editor + settings ──────────────────────────────────────────────── */}
      <div className={cn("grid items-start gap-5", settingsOpen && "xl:grid-cols-[1fr_400px]")}>
        <section className="panel">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
            <div className="flex rounded-xl bg-secondary p-1">
              {TABS.map((t) => (
                <button
                  key={t.value}
                  onClick={() => selectTab(t.value)}
                  className={cn(
                    "rounded-lg px-4 py-1.5 text-sm transition-colors",
                    tab === t.value ? "bg-primary font-medium text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <LibraryPicker
                libraryId={layout[tab].libraryId}
                libraries={libraries}
                onChange={(libraryId) => setKindLayout(tab, { libraryId })}
              />
              <TextStylePicker value={layout[tab].style} onChange={(style) => setKindLayout(tab, { style })} />
              {!settingsOpen && (
                <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(true)} aria-label="Show settings">
                  <PanelRightOpen />
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-6 p-5">
            {tab === "hook" && (
              <CopyList
                kind="hook"
                campaignId={campaign.id}
                items={hooks}
                onItemsChange={setHooks}
                previewId={previewHookId}
                onPreview={(id) => {
                  setPreviewHookId(id);
                  select("hook", 0);
                }}
                beforeAi={flush}
              />
            )}

            {tab === "content" && (
              <ContentSettings campaign={campaign} patch={patch} aiBusy={aiBusy} onOptimize={optimizePrompt} onGenerate={generatePreview} />
            )}

            {tab === "cta" && (
              <div className="space-y-5">
                {campaign.cta_enabled && (
                  <>
                    <CopyList
                      kind="cta"
                      campaignId={campaign.id}
                      items={ctas}
                      onItemsChange={setCtas}
                      previewId={previewCtaId}
                      onPreview={(id) => {
                        setPreviewCtaId(id);
                        select("cta", 0);
                      }}
                      beforeAi={flush}
                    />
                    <BadgeControls
                      badge={layout.cta.badge!}
                      onChange={(p) => setKindLayout("cta", { badge: { ...layout.cta.badge!, ...p } })}
                      onEnable={() => select("cta", 0)}
                    />
                  </>
                )}
                <div className="space-y-2 border-t border-border pt-5">
                  <Label className="text-muted-foreground">Lands</Label>
                  <Segmented
                    value={!campaign.cta_enabled ? "none" : (layout.cta.placement ?? "end")}
                    onChange={(v) => {
                      if (v === "none") return patch({ cta_enabled: false });
                      patch({ cta_enabled: true, layout: { ...layout, cta: { ...layout.cta, placement: v } } });
                    }}
                    options={[
                      { value: "end", label: "At the end" },
                      { value: "middle", label: "Mid-deck" },
                      { value: "none", label: "No CTA slide" },
                    ]}
                  />
                  <p className="text-xs text-muted-foreground">
                    Tip: app screenshots make good CTA images. Without CTA text the slide shows only the image (and badge).
                  </p>
                </div>
              </div>
            )}

            <LayoutControls layout={layout[tab]} onChange={(p) => setKindLayout(tab, p)} />
          </div>
        </section>

        {settingsOpen && (
          <aside className="panel xl:sticky xl:top-6">
            <div className="flex items-center justify-between border-b border-border p-4">
              <p className="font-medium">Settings</p>
              <Button variant="ghost" size="icon-sm" onClick={() => setSettingsOpen(false)} aria-label="Hide settings">
                <PanelRightClose />
              </Button>
            </div>
            <div className="space-y-6 p-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Product</Label>
                  <select
                    value={campaign.product_id ?? ""}
                    onChange={(e) => patch({ product_id: e.target.value || null })}
                    className={cn(selectClass, "w-full")}
                  >
                    <option value="">No product</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Language</Label>
                  <select value={campaign.language} onChange={(e) => patch({ language: e.target.value })} className={cn(selectClass, "w-full")}>
                    <option value="en">English</option>
                    <option value="de">German</option>
                  </select>
                </div>
              </div>
              <PublishSettings campaign={campaign} patch={patch} accounts={accounts} slots={slots} beforeStart={flush} />
            </div>
          </aside>
        )}
      </div>

      <PostEditorDialog
        postId={generatedPost?.id ?? null}
        generating={generatedPost?.generating}
        canSend={!!campaign.tiktok_account_id}
        onOpenChange={(open) => !open && !generatedPost?.generating && setGeneratedPost(null)}
        onChanged={() => router.refresh()}
      />

      <PreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        slides={strip.map((s) => ({ ...s, layout: layout[s.kind], image: imageAt(s.kind, s.index) }))}
      />
    </div>
  );
}

// ─── Slide card in the strip ───────────────────────────────────────────────

function SlideCard({
  number,
  slide,
  layout,
  image,
  libraries,
  inTab,
  selected,
  showSafeArea,
  label,
  onSelect,
  onBoxChange,
  onBadgeChange,
  onLibrary,
  onEye,
}: {
  number: number;
  slide: StripSlide;
  layout: SlideLayout;
  image: EditorImage | null;
  libraries: EditorLibrary[];
  inTab: boolean;
  selected: boolean;
  showSafeArea: boolean;
  label: string;
  onSelect: () => void;
  onBoxChange: (box: SlideLayout["box"]) => void;
  onBadgeChange?: (badge: BadgeLayout) => void;
  onLibrary: (libraryId: string | null) => void;
  onEye?: () => void;
}) {
  const faded = slide.placeholder ? { opacity: 0.55 } : undefined;
  return (
    <div
      onClick={onSelect}
      className={cn(
        "relative shrink-0 cursor-pointer overflow-hidden rounded-2xl border-2 bg-card transition-colors",
        inTab ? "border-primary/80" : "border-border hover:border-muted-foreground/40",
        selected && "glow",
      )}
      style={{ width: CARD_WIDTH + 4 }}
    >
      <div className="relative" style={faded}>
        {selected ? (
          <EditableSlide
            width={CARD_WIDTH}
            kind={slide.kind}
            layout={layout}
            text={slide.text}
            imageUrl={image?.url ?? null}
            imageCrop={image?.crop}
            showSafeArea={showSafeArea}
            onBoxChange={onBoxChange}
            onBadgeChange={onBadgeChange}
          />
        ) : (
          <ScaledSlide width={CARD_WIDTH}>
            <Slide
              kind={slide.kind}
              layout={layout}
              text={slide.text}
              imageUrl={image?.url ?? null}
              imageCrop={image?.crop}
              showSafeArea={showSafeArea}
            />
          </ScaledSlide>
        )}
      </div>

      <span className="absolute top-2 left-2 flex size-6 items-center justify-center rounded-md bg-black/60 text-xs font-medium text-white">
        {number}
      </span>
      <div className="absolute top-2 right-2 flex gap-1" onClick={(e) => e.stopPropagation()}>
        {onEye && (
          <button
            onClick={onEye}
            className="flex size-7 items-center justify-center rounded-md bg-black/60 text-white hover:text-primary"
            title="Show the next hook"
            aria-label="Show the next hook"
          >
            <Eye className="size-4" />
          </button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              "flex size-7 items-center justify-center rounded-md bg-black/60 hover:text-primary",
              layout.libraryId ? "text-white" : "text-destructive",
            )}
            aria-label="Image library"
            title="Image library"
          >
            <ImageIcon className="size-4" />
          </DropdownMenuTrigger>
          <LibraryMenuContent libraryId={layout.libraryId} libraries={libraries} onChange={onLibrary} />
        </DropdownMenu>
      </div>

      <div className={cn("border-t border-border px-3 py-2 text-sm", inTab ? "font-medium text-foreground" : "text-muted-foreground")}>
        {label}
      </div>
    </div>
  );
}

// ─── App Store badge ───────────────────────────────────────────────────────

function BadgeControls({
  badge,
  onChange,
  onEnable,
}: {
  badge: BadgeLayout;
  onChange: (p: Partial<BadgeLayout>) => void;
  onEnable: () => void;
}) {
  return (
    <div className="space-y-4 rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={badge.enabled}
            onChange={(e) => {
              onChange({ enabled: e.target.checked });
              if (e.target.checked) onEnable();
            }}
            className="size-4 accent-[var(--accent-primary)]"
          />
          App Store badge
        </label>
        {badge.enabled && (
          <>
            <Segmented
              size="sm"
              value={badge.variant}
              onChange={(variant) => onChange({ variant })}
              options={[
                { value: "dark", label: "Dark" },
                { value: "light", label: "Light" },
              ]}
            />
            <span className="text-xs text-muted-foreground">drag it on the CTA slide to place it</span>
          </>
        )}
      </div>
      {badge.enabled && (
        <label className="flex items-center gap-4 text-sm">
          <span className="w-10 text-muted-foreground">Size</span>
          <input
            type="range"
            min={0.2}
            max={0.9}
            step={0.01}
            value={badge.w}
            onChange={(e) => {
              const w = Number(e.target.value);
              onChange({ w, x: Math.min(1 - w / 2, Math.max(w / 2, badge.x)) });
            }}
            className="flex-1 accent-[var(--accent-primary)]"
          />
          <span className="w-12 rounded-lg border border-border px-2 py-1 text-right tabular-nums">{Math.round(badge.w * 100)}%</span>
        </label>
      )}
    </div>
  );
}

// ─── Pickers ───────────────────────────────────────────────────────────────

function LibraryMenuContent({
  libraryId,
  libraries,
  onChange,
}: {
  libraryId: string | null;
  libraries: EditorLibrary[];
  onChange: (id: string | null) => void;
}) {
  return (
    <DropdownMenuContent align="end" className="min-w-56">
      <DropdownMenuGroup>
        <DropdownMenuLabel>Image library</DropdownMenuLabel>
        {libraries.length === 0 && (
          <DropdownMenuItem render={<Link href="/library" />}>Create a library first →</DropdownMenuItem>
        )}
        {libraries.map((l) => (
          <DropdownMenuItem key={l.id} onClick={() => onChange(l.id)} className={cn(l.id === libraryId && "text-primary")}>
            <Images /> {l.name} <span className="ml-auto text-xs text-muted-foreground">{l.images.length}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuGroup>
      {libraryId && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => onChange(null)}>Detach library</DropdownMenuItem>
        </>
      )}
    </DropdownMenuContent>
  );
}

function LibraryPicker({
  libraryId,
  libraries,
  onChange,
}: {
  libraryId: string | null;
  libraries: EditorLibrary[];
  onChange: (id: string | null) => void;
}) {
  const library = libraries.find((l) => l.id === libraryId);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            className={cn("h-9", library ? "border-primary/60" : "border-destructive/70 text-destructive hover:text-destructive")}
          />
        }
      >
        <Images /> {library ? `${library.name} (${library.images.length})` : "Attach image library"} <ChevronDown className="opacity-60" />
      </DropdownMenuTrigger>
      <LibraryMenuContent libraryId={libraryId} libraries={libraries} onChange={onChange} />
    </DropdownMenu>
  );
}

function TextStylePicker({ value, onChange }: { value: TextStyleId; onChange: (style: TextStyleId) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" className="h-9" />}>
        <Type /> {TEXT_STYLES[value].label} <ChevronDown className="opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-64">
        {(Object.keys(TEXT_STYLES) as TextStyleId[]).map((id) => (
          <DropdownMenuItem key={id} onClick={() => onChange(id)} className={cn("flex-col items-start gap-0", id === value && "text-primary")}>
            <span>{TEXT_STYLES[id].label}</span>
            <span className="text-xs text-muted-foreground">{TEXT_STYLES[id].description}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Header "Style" menu: applies a look to every slide type at once. */
function StyleMenu({ layout, onApply }: { layout: CampaignLayout; onApply: (p: Partial<SlideLayout>) => void }) {
  const uniform = layout.hook.style === layout.content.style && layout.content.style === layout.cta.style;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" className="h-9" />}>
        <Palette /> Style {uniform && <span className="text-muted-foreground">· {TEXT_STYLES[layout.hook.style].label}</span>}
        <ChevronDown className="opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Apply to all slides</DropdownMenuLabel>
          {(Object.keys(TEXT_STYLES) as TextStyleId[]).map((id) => (
            <DropdownMenuItem key={id} onClick={() => onApply({ style: id })} className="flex-col items-start gap-0">
              <span>{TEXT_STYLES[id].label}</span>
              <span className="text-xs text-muted-foreground">{TEXT_STYLES[id].description}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>Text alignment</DropdownMenuLabel>
          {(["left", "center", "right"] as TextAlign[]).map((align) => (
            <DropdownMenuItem key={align} onClick={() => onApply({ align })} className="capitalize">
              {align}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Preview ───────────────────────────────────────────────────────────────

function PreviewDialog({
  open,
  onOpenChange,
  slides,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slides: (StripSlide & { layout: SlideLayout; image: EditorImage | null })[];
}) {
  const [index, setIndex] = useState(0);
  const i = Math.min(index, slides.length - 1);
  const slide = slides[i];
  const go = (delta: number) => setIndex((i + delta + slides.length) % slides.length);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-auto max-w-none gap-3 p-4 sm:max-w-none"
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") go(1);
          if (e.key === "ArrowLeft") go(-1);
        }}
      >
        <DialogTitle className="sr-only">Preview</DialogTitle>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => go(-1)} aria-label="Previous slide">
            <ChevronLeft />
          </Button>
          <div className="relative">
            <ScaledSlide width={340}>
              <Slide
                kind={slide.kind}
                layout={slide.layout}
                text={slide.text}
                imageUrl={slide.image?.url ?? null}
                imageCrop={slide.image?.crop}
              />
            </ScaledSlide>
            {/* TikTok-style photo mode dots */}
            <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1">
              {slides.map((_, n) => (
                <span key={n} className={cn("h-1 rounded-full bg-white transition-all", n === i ? "w-4" : "w-1 opacity-50")} />
              ))}
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => go(1)} aria-label="Next slide">
            <ChevronRight />
          </Button>
        </div>
        <p className="text-center text-xs text-muted-foreground tabular-nums">
          {i + 1} / {slides.length} · use ← → to swipe
        </p>
      </DialogContent>
    </Dialog>
  );
}

// ─── Panels ────────────────────────────────────────────────────────────────

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
          rows={3}
          value={campaign.content_prompt}
          onChange={(e) => patch({ content_prompt: e.target.value })}
          placeholder="e.g. Unconventional ways to get more candid photos at your wedding. Every tip must be practical and specific."
        />
        <p className="text-xs text-muted-foreground">Be specific: vague prompts produce vague slides. The content is written fresh for every post.</p>
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
        <Sparkles className={cn(aiBusy && "animate-pulse")} /> {aiBusy ? "Writing…" : "Fill slides with sample content"}
      </Button>
    </div>
  );
}
