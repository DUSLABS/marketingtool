"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Copy, Download, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { deletePost, generatePost, rerenderPost, updatePostCaption } from "./actions";

export type PostSummary = {
  id: string;
  status: string;
  caption: string;
  error: string | null;
  createdAt: string;
  slides: { id: string; kind: string; text: string; url: string | null }[];
};

const STATUS_LABEL: Record<string, string> = {
  preview: "Ready",
  queued: "Scheduled",
  rendering: "Rendering",
  uploading: "Uploading",
  in_drafts: "In TikTok drafts",
  published: "Published",
  failed: "Failed",
};

export function PostsView({ campaign, posts }: { campaign: { id: string; name: string }; posts: PostSummary[] }) {
  const router = useRouter();
  const [generating, startGenerating] = useTransition();
  const [viewer, setViewer] = useState<{ post: PostSummary; index: number } | null>(null);

  function generate() {
    startGenerating(async () => {
      const res = await generatePost(campaign.id);
      if (!res.ok) toast.error(res.error, { duration: 10_000 });
      else toast.success("New post ready");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={`/campaigns/${campaign.id}`}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
          aria-label="Back to campaign"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div>
          <h1 className="text-lg font-semibold">{campaign.name}</h1>
          <p className="text-sm text-muted-foreground">Generated posts. Download a ZIP to post manually until TikTok is connected.</p>
        </div>
        <Button onClick={generate} disabled={generating} className={cn("ml-auto", generating ? "glow" : "glow-hover")}>
          <Sparkles className={cn(generating && "animate-pulse")} />
          {generating ? "Writing & rendering… (~30–60 s)" : "Generate post"}
        </Button>
      </div>

      {posts.length === 0 && !generating && (
        <div className="panel p-10 text-center text-sm text-muted-foreground">
          No posts yet. Each click on “Generate post” builds a new slideshow from this campaign.
        </div>
      )}

      <div className="space-y-4">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} onOpen={(index) => setViewer({ post, index })} />
        ))}
      </div>

      <SlideViewer viewer={viewer} onChange={setViewer} />
    </div>
  );
}

function PostCard({ post, onOpen }: { post: PostSummary; onOpen: (index: number) => void }) {
  const router = useRouter();
  const [caption, setCaption] = useState(post.caption);
  const [busy, startBusy] = useTransition();
  const rendered = post.slides.every((s) => s.url);

  return (
    <article className="panel space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge variant={post.status === "failed" ? "destructive" : post.status === "preview" ? "secondary" : "default"}>
          {STATUS_LABEL[post.status] ?? post.status}
        </Badge>
        <span className="text-muted-foreground">
          {new Date(post.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })} · {post.slides.length} slides
        </span>
        <div className="ml-auto flex items-center gap-1">
          {(!rendered || post.status === "failed") && (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() =>
                startBusy(async () => {
                  const res = await rerenderPost(post.id);
                  if (!res.ok) toast.error(res.error);
                  router.refresh();
                })
              }
            >
              <RefreshCw className={cn(busy && "animate-spin")} /> Render again
            </Button>
          )}
          {rendered && (
            <a href={`/api/posts/${post.id}/zip`} className={buttonVariants({ variant: "outline", size: "sm" })}>
              <Download /> ZIP
            </a>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Delete post"
            onClick={() => {
              if (confirm("Delete this post?")) startBusy(() => deletePost(post.id));
            }}
          >
            <Trash2 />
          </Button>
        </div>
      </div>

      {post.error && <p className="text-sm text-destructive">{post.error}</p>}

      <div className="flex gap-2 overflow-x-auto pb-1">
        {post.slides.map((s, i) => (
          <button
            key={s.id}
            onClick={() => onOpen(i)}
            className="relative aspect-[9/16] w-28 shrink-0 overflow-hidden rounded-lg border border-border bg-secondary hover:border-primary/60"
            title={s.text}
          >
            {s.url ? (
              // eslint-disable-next-line @next/next/no-img-element -- signed Supabase URL of the final render
              <img src={s.url} alt={s.text} loading="lazy" className="size-full object-cover" />
            ) : (
              <span className="flex size-full items-center justify-center p-2 text-center text-[10px] text-muted-foreground">
                {s.text || s.kind}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Caption</span>
          <Button
            variant="ghost"
            size="xs"
            onClick={() => {
              void navigator.clipboard.writeText(caption);
              toast.success("Caption copied");
            }}
          >
            <Copy /> Copy
          </Button>
        </div>
        <Textarea
          value={caption}
          rows={2}
          onChange={(e) => setCaption(e.target.value)}
          onBlur={() => caption !== post.caption && void updatePostCaption(post.id, caption)}
        />
      </div>
    </article>
  );
}

function SlideViewer({
  viewer,
  onChange,
}: {
  viewer: { post: PostSummary; index: number } | null;
  onChange: (v: { post: PostSummary; index: number } | null) => void;
}) {
  if (!viewer) return null;
  const { post, index } = viewer;
  const slide = post.slides[index];
  const go = (delta: number) =>
    onChange({ post, index: (index + delta + post.slides.length) % post.slides.length });

  return (
    <Dialog open onOpenChange={(open) => !open && onChange(null)}>
      <DialogContent className="w-auto max-w-none p-3 sm:max-w-none" onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(1);
        if (e.key === "ArrowLeft") go(-1);
      }}>
        <DialogTitle className="sr-only">Slide {index + 1}</DialogTitle>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => go(-1)} aria-label="Previous slide">
            <ChevronLeft />
          </Button>
          {slide.url ? (
            // eslint-disable-next-line @next/next/no-img-element -- signed Supabase URL of the final render
            <img src={slide.url} alt={slide.text} className="h-[80vh] rounded-lg" />
          ) : (
            <div className="flex h-[80vh] w-[45vh] items-center justify-center rounded-lg bg-secondary p-6 text-center">{slide.text}</div>
          )}
          <Button variant="ghost" size="icon" onClick={() => go(1)} aria-label="Next slide">
            <ChevronRight />
          </Button>
        </div>
        <p className="text-center text-xs text-muted-foreground tabular-nums">
          {index + 1} / {post.slides.length}
        </p>
      </DialogContent>
    </Dialog>
  );
}
