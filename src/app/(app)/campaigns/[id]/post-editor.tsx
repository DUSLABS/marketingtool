"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, Download, Loader2, Pencil, Send, Shuffle, Smartphone, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { EditableSlide } from "@/components/slides/editable-slide";
import { ScaledSlide, Slide } from "@/components/slides/slide";
import { cn } from "@/lib/utils";
import {
  getPostForEditor,
  pickOtherImage,
  rewritePostSlide,
  savePostEdits,
  sendPostToTikTok,
  type EditorPost,
  type EditorSlide,
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
      <DialogContent showCloseButton={false} className="flex max-h-[94vh] w-[94vw] max-w-none flex-col gap-0 p-0 sm:max-w-none">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
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
            {generating ? "Writing the content and rendering the slides… (~20–40 s)" : "Loading…"}
          </div>
        ) : (
          <>
            <div className="relative">
              <div ref={scroller} className="flex gap-4 overflow-x-auto px-5 py-5">
                {slides.map((slide, i) => (
                  <div key={slide.id} className="shrink-0 space-y-2" style={{ width: CARD_WIDTH }}>
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
                          <SlideButton label="Use another image" onClick={() => void shuffle(i)} disabled={busySlide !== null}>
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

            <div className="space-y-3 border-t border-border px-5 py-4">
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
                      : "Hover a slide to edit its text, rewrite it with AI or swap the image."}
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
        "absolute top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur hover:text-primary",
        side === "left" ? "left-2" : "right-2",
      )}
    >
      {side === "left" ? <ChevronLeft /> : <ChevronRight />}
    </button>
  );
}
