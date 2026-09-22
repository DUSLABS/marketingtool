"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowLeft, Copy, Download, RefreshCw, Send, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { PostEditorDialog } from "../post-editor";
import { deletePost, generatePost, refreshPostStatus, rerenderPost, sendPostToTikTok, updatePostCaption } from "./actions";

export type PostSummary = {
  id: string;
  status: string;
  caption: string;
  error: string | null;
  createdAt: string;
  scheduledFor: string | null;
  sentToTikTok: boolean;
  slides: { id: string; kind: string; text: string; url: string | null }[];
};

const STATUS_LABEL: Record<string, string> = {
  preview: "Ready",
  queued: "Scheduled",
  rendering: "Rendering",
  uploading: "TikTok is processing",
  in_drafts: "In TikTok inbox",
  published: "Published",
  failed: "Failed",
};

const TIKTOK_STATUS: Record<string, string> = {
  SEND_TO_USER_INBOX: "Sent to your TikTok inbox. Open TikTok to finish and post it.",
  PUBLISH_COMPLETE: "Published on TikTok.",
  PROCESSING_DOWNLOAD: "TikTok is downloading the images…",
  PROCESSING_UPLOAD: "TikTok is processing the post…",
  FAILED: "TikTok rejected the post.",
};

export function PostsView({ campaign, posts }: { campaign: { id: string; name: string; hasAccount: boolean }; posts: PostSummary[] }) {
  const router = useRouter();
  const [generating, startGenerating] = useTransition();
  const [editing, setEditing] = useState<{ id: string | null; generating: boolean } | null>(null);

  function generate() {
    setEditing({ id: null, generating: true });
    startGenerating(async () => {
      const res = await generatePost(campaign.id);
      if (!res.ok) {
        setEditing(null);
        toast.error(res.error, { duration: 10_000 });
      } else setEditing({ id: res.data, generating: false });
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
          <PostCard key={post.id} post={post} canSend={campaign.hasAccount} onOpen={() => setEditing({ id: post.id, generating: false })} />
        ))}
      </div>

      <PostEditorDialog
        postId={editing?.id ?? null}
        generating={editing?.generating}
        canSend={campaign.hasAccount}
        onOpenChange={(open) => !open && !editing?.generating && setEditing(null)}
        onChanged={() => router.refresh()}
      />
    </div>
  );
}

function PostCard({ post, canSend, onOpen }: { post: PostSummary; canSend: boolean; onOpen: () => void }) {
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
          {post.scheduledFor ? "Slot " : ""}
          {new Date(post.scheduledFor ?? post.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })} ·{" "}
          {post.slides.length} slides
        </span>
        <div className="ml-auto flex items-center gap-1">
          {rendered && (!post.sentToTikTok || post.status === "failed") && (
            <Button
              size="sm"
              disabled={busy || !canSend}
              title={canSend ? "Send to TikTok with this campaign's publish settings" : "Choose a TikTok account in the campaign's Publish tab"}
              onClick={() =>
                startBusy(async () => {
                  const res = await sendPostToTikTok(post.id);
                  if (!res.ok) toast.error(res.error, { duration: 10_000 });
                  else toast.success(TIKTOK_STATUS[res.data] ?? "Sent to TikTok");
                  router.refresh();
                })
              }
            >
              <Send /> Send to TikTok
            </Button>
          )}
          {post.status === "uploading" && (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() =>
                startBusy(async () => {
                  const res = await refreshPostStatus(post.id);
                  if (!res.ok) toast.error(res.error);
                  else toast(TIKTOK_STATUS[res.data] ?? res.data);
                  router.refresh();
                })
              }
            >
              <RefreshCw className={cn(busy && "animate-spin")} /> Check status
            </Button>
          )}
          {(!rendered || (post.status === "failed" && !post.sentToTikTok)) && (
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
        {post.slides.map((s) => (
          <button
            key={s.id}
            onClick={onOpen}
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
