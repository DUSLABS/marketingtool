"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, Download, ImageIcon, Loader2, Pencil, Send, Shuffle, Smartphone, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { EditableSlide } from "@/components/slides/editable-slide";
import { ScaledSlide, Slide } from "@/components/slides/slide";
import { cn } from "@/lib/utils";
import {
  getPostForEditor,
  listPickerImages,
  pickOtherImage,
  rewritePostSlide,
  savePostEdits,
  sendPostToTikTok,
  type EditorPost,
  type EditorSlide,
  type PickerLibrary,
} from "./posts/actions";

const CARD_WIDTH = 300;

/**
 * Large preview of one generated post. Every slide can be edited (text, position, image, AI
 * rewrite); saving re-renders the post. Opened after "Generate" and from the posts list.
 */
export function PostEditorDialog({
  postId,
  generating = false,
  canSend,
  onOpenChange,
  onChanged,
}: {
  /** Post to show; null while a new post is being generated. */
  postId: string | null;
  generating?: boolean;
  canSend: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
}) {
  const open = generating || !!postId;
  const [post, setPost] = useState<EditorPost | null>(null);
  const [slides, setSlides] = useState<EditorSlide[]>([]);
  const [caption, setCaption] = useState("");
  const [dirty, setDirty] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [busySlide, setBusySlide] = useState<number | null>(null);
  const [showSafeArea, setShowSafeArea] = useState(false);
  const [saving, startSaving] = useTransition();
  const [sending, startSending] = useTransition();
  const scroller = useRef<HTMLDivElement>(null);
  const [pickerFor, setPickerFor] = useState<number | null>(null);

  useEffect(() => {
    if (!postId) return;
    let cancelled = false;
    void getPostForEditor(postId).then((res) => {
      if (cancelled) return;
      if (!res.ok) return void toast.error(res.error);
      setPost(res.data);
      setSlides(res.data.slides);
      setCaption(res.data.caption);
      setDirty(false);
      setEditing(null);
    });
    return () => {
      cancelled = true;
    };
  }, [postId]);

  const loaded = post && post.id === postId;
  const locked = !!post?.sentToTikTok && post.status !== "failed";

  function updateSlide(index: number, p: Partial<EditorSlide>) {
    setSlides((all) => all.map((s, i) => (i === index ? { ...s, ...p } : s)));
    setDirty(true);
  }

  async function rewrite(index: number) {
    setBusySlide(index);
    const res = await rewritePostSlide(post!.id, slides.map((s) => ({ kind: s.kind, text: s.text })), index);
    setBusySlide(null);
    if (!res.ok) return void toast.error(res.error);
    updateSlide(index, { text: res.data });
  }

  async function shuffle(index: number) {
    setBusySlide(index);
    const used = slides.map((s) => s.assetId).filter((id): id is string => !!id);
    const res = await pickOtherImage(post!.id, slides[index].kind, used);
    setBusySlide(null);
    if (!res.ok) return void toast.error(res.error);
    updateSlide(index, { assetId: res.data.assetId, imageUrl: res.data.imageUrl, imageCrop: res.data.imageCrop });
  }

  async function save() {
    const res = await savePostEdits(post!.id, {
      caption,
      slides: slides.map((s) => ({ id: s.id, text: s.text, layout: s.layout, assetId: s.assetId })),
    });
    if (!res.ok) {
      toast.error(res.error);
      return false;
    }
    setDirty(false);
    setEditing(null);
    onChanged?.();
    return true;
  }

  function send() {
    startSending(async () => {
      if (dirty && !(await save())) return;
      const res = await sendPostToTikTok(post!.id);
      if (!res.ok) return void toast.error(res.error, { duration: 10_000 });
      toast.success(res.data === "SEND_TO_USER_INBOX" ? "Sent to your TikTok inbox" : "Sent to TikTok");
      setPost({ ...post!, sentToTikTok: true, status: "uploading" });
      onChanged?.();
    });
  }

  function close(next: boolean) {
    if (!next && dirty && !confirm("Discard your unsaved changes?")) return;
    onOpenChange(next);
  }

  const scroll = (dir: number) => scroller.current?.scrollBy({ left: dir * (CARD_WIDTH + 16) * 2, behavior: "smooth" });

  return (
    <Dialog open={open} onOpenChange={close}>
      {/* Fixed height: header and footer stay put, the slides area scrolls between them. */}
      <DialogContent showCloseButton={false} className="flex h-[92vh] w-[94vw] max-w-none flex-col gap-0 p-0 sm:max-w-none">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3">
          <DialogTitle>Preview</DialogTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSafeArea((v) => !v)}
              className={cn(showSafeArea && "border-primary/60 text-primary")}
            >
              <Smartphone /> Safe area
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => close(false)} aria-label="Close">
              <X />
            </Button>
          </div>
        </div>

        {!loaded ? (
          <div className="flex h-[560px] flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="size-6 animate-spin text-primary" />
            {generating ? "Writing the content, checking it against the hook, picking images and rendering… (~40–70 s)" : "Loading…"}
          </div>
        ) : (
          <>
            {/* The inner area scrolls, so the caption and the buttons below stay reachable. */}
            <div className="relative min-h-0 flex-1">
              <div ref={scroller} className="absolute inset-0 flex gap-4 overflow-auto px-5 py-5">
                {slides.map((slide, i) => (
                  <div key={slide.id} className="h-fit shrink-0 space-y-2" style={{ width: CARD_WIDTH }}>
                    <div
                      className={cn(
                        "group relative overflow-hidden rounded-2xl border-2",
                        editing === i ? "border-primary" : "border-transparent",
                      )}
                    >
                      {editing === i ? (
                        <EditableSlide
                          width={CARD_WIDTH - 4}
                          kind={slide.kind}
                          layout={{ ...slide.layout, libraryId: null }}
                          text={slide.text}
                          imageUrl={slide.imageUrl}
                          imageCrop={slide.imageCrop}
                          showSafeArea={showSafeArea}
                          onBoxChange={(box) => updateSlide(i, { layout: { ...slide.layout, box } })}
                          onBadgeChange={
                            slide.layout.badge?.enabled ? (badge) => updateSlide(i, { layout: { ...slide.layout, badge } }) : undefined
                          }
                        />
                      ) : (
                        <ScaledSlide width={CARD_WIDTH - 4}>
                          <Slide
                            kind={slide.kind}
                            layout={{ ...slide.layout, libraryId: null }}
                            text={slide.text}
                            imageUrl={slide.imageUrl}
                            imageCrop={slide.imageCrop}
                            showSafeArea={showSafeArea}
                          />
                        </ScaledSlide>
                      )}
                      <span className="absolute top-2.5 left-2.5 flex size-6 items-center justify-center rounded-full bg-black/60 text-xs text-white">
                        {i + 1}
                      </span>
                      {busySlide === i && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                          <Loader2 className="size-6 animate-spin text-primary" />
                        </div>
                      )}
                      {!locked && (
                        <div
                          className={cn(
                            "absolute right-2.5 bottom-2.5 flex gap-1.5 transition-opacity",
                            editing === i ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                          )}
                        >
                          <SlideButton label="Edit text and position" onClick={() => setEditing(editing === i ? null : i)} active={editing === i}>
                            <Pencil />
                          </SlideButton>
                          <SlideButton label="Rewrite with AI" onClick={() => void rewrite(i)} disabled={busySlide !== null}>
                            <Sparkles />
                          </SlideButton>
                          <SlideButton label="Choose image" onClick={() => setPickerFor(i)} disabled={busySlide !== null}>
                            <ImageIcon />
                          </SlideButton>
                          <SlideButton label="Random other image" onClick={() => void shuffle(i)} disabled={busySlide !== null}>
                            <Shuffle />
                          </SlideButton>
                        </div>
                      )}
                    </div>
                    {editing === i && (
                      <Textarea
                        autoFocus
                        rows={3}
                        value={slide.text}
                        onChange={(e) => updateSlide(i, { text: e.target.value })}
                        placeholder={slide.kind === "cta" ? "Leave empty for an image-only slide" : "Slide text"}
                        className="text-sm"
                      />
                    )}
                  </div>
                ))}
              </div>
              <ScrollButton side="left" onClick={() => scroll(-1)} />
              <ScrollButton side="right" onClick={() => scroll(1)} />
            </div>

            <div className="shrink-0 space-y-3 border-t border-border px-5 py-4">
              <label className="text-sm text-muted-foreground" htmlFor="post-caption">
                Caption
              </label>
              <Textarea
                id="post-caption"
                rows={2}
                value={caption}
                disabled={locked}
                onChange={(e) => {
                  setCaption(e.target.value);
                  setDirty(true);
                }}
              />
              <div className="flex flex-wrap items-center justify-end gap-2">
                <span className="mr-auto text-xs text-muted-foreground">
                  {locked
                    ? "Already sent to TikTok. Edits are no longer possible."
                    : dirty
                      ? "Unsaved changes. Saving renders the slides again."
                      : "Hover a slide to edit its text, rewrite it with AI or change the image."}
                </span>
                <a
                  href={dirty ? undefined : `/api/posts/${post.id}/zip`}
                  aria-disabled={dirty}
                  className={cn(buttonVariants({ variant: "outline" }), dirty && "pointer-events-none opacity-50")}
                >
                  <Download /> ZIP
                </a>
                {dirty && (
                  <Button variant="outline" disabled={saving || sending} onClick={() => startSaving(async () => void (await save()) )}>
                    {saving ? <Loader2 className="animate-spin" /> : null} {saving ? "Rendering…" : "Save changes"}
                  </Button>
                )}
                {!locked && (
                  <Button
                    disabled={!canSend || sending || saving}
                    title={canSend ? undefined : "Choose a TikTok account in the campaign settings first"}
                    onClick={send}
                    className="glow-hover"
                  >
                    {sending ? <Loader2 className="animate-spin" /> : <Send />} {sending ? "Sending…" : "Send to TikTok"}
                  </Button>
                )}
              </div>
            </div>
          </>
        )}

        {pickerFor !== null && slides[pickerFor] && (
          <ImagePicker
            currentAssetId={slides[pickerFor].assetId}
            onClose={() => setPickerFor(null)}
            onPick={(img) => {
              updateSlide(pickerFor, { assetId: img.assetId, imageUrl: img.url, imageCrop: img.crop });
              setPickerFor(null);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

let pickerCache: PickerLibrary[] | null = null;

/** Choose a slide image by hand from any library. */
function ImagePicker({
  currentAssetId,
  onClose,
  onPick,
}: {
  currentAssetId: string | null;
  onClose: () => void;
  onPick: (img: PickerLibrary["images"][number]) => void;
}) {
  const [libraries, setLibraries] = useState<PickerLibrary[] | null>(pickerCache);
  const [libraryId, setLibraryId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void listPickerImages().then((res) => {
      if (cancelled) return;
      if (!res.ok) return void toast.error(res.error);
      pickerCache = res.data;
      setLibraries(res.data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const active =
    libraries?.find((l) => l.id === libraryId) ??
    libraries?.find((l) => l.images.some((i) => i.assetId === currentAssetId)) ??
    libraries?.[0];

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[88vh] w-[min(920px,94vw)] max-w-none gap-4 sm:max-w-none">
        <DialogTitle>Choose image</DialogTitle>
        {!libraries ? (
          <div className="flex h-60 items-center justify-center">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : libraries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No libraries yet.</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-1.5">
              {libraries.map((l) => (
                <button
                  key={l.id}
                  onClick={() => setLibraryId(l.id)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-sm transition-colors",
                    l.id === active?.id ? "border-primary/70 bg-primary/10" : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {l.name} <span className="text-xs text-muted-foreground">{l.images.length}</span>
                </button>
              ))}
            </div>
            <div className="grid max-h-[62vh] grid-cols-4 gap-3 overflow-y-auto pr-1 sm:grid-cols-6">
              {active?.images.map((img) => (
                <button
                  key={img.assetId}
                  onClick={() => onPick(img)}
                  className={cn(
                    "relative aspect-[9/16] overflow-hidden rounded-lg border-2 transition-colors",
                    img.assetId === currentAssetId ? "border-primary" : "border-transparent hover:border-primary/60",
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- signed Supabase thumbnail */}
                  <img
                    src={img.url}
                    alt=""
                    loading="lazy"
                    className="size-full object-cover"
                    style={
                      img.crop
                        ? { transform: `translate(${img.crop.x * 100}%, ${img.crop.y * 100}%) scale(${img.crop.zoom})` }
                        : undefined
                    }
                  />
                </button>
              ))}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SlideButton({
  label,
  onClick,
  active,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={cn(
        "flex size-9 items-center justify-center rounded-xl bg-black/65 text-white backdrop-blur transition-colors hover:text-primary disabled:opacity-50 [&_svg]:size-4",
        active && "text-primary",
      )}
    >
      {children}
    </button>
  );
}

function ScrollButton({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={side === "left" ? "Scroll left" : "Scroll right"}
      className={cn(
        "absolute top-1/2 z-10 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur hover:text-primary",
        side === "left" ? "left-2" : "right-2",
      )}
    >
      {side === "left" ? <ChevronLeft /> : <ChevronRight />}
    </button>
  );
}
