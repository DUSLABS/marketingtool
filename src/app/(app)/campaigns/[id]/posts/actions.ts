"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import Anthropic from "@anthropic-ai/sdk";
import { getWorkspace } from "@/lib/workspace";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildPost, CampaignNotReadyError } from "@/lib/engine/build-post";
import { renderPost } from "@/lib/engine/render-post";
import { publishErrorMessage, publishPost, syncPublishStatus } from "@/lib/engine/publish-post";
import { rewriteSlide, type CampaignContext, type ProductContext } from "@/lib/ai/generate";
import { signPaths } from "@/lib/storage";
import { withDefaults, type ImageCrop, type SlideKind, type SlideLayout } from "@/lib/slides/types";

export type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string };

async function baseUrl() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

function message(e: unknown) {
  if (e instanceof CampaignNotReadyError) return e.message;
  if (e instanceof Anthropic.APIError && /credit balance/i.test(e.message)) {
    return "The Anthropic account has no credits left. Top up under Plans & Billing.";
  }
  if (e instanceof Anthropic.RateLimitError) return "AI rate limit reached. Wait a moment and try again.";
  if (e instanceof Anthropic.APIError) return `AI request failed (${e.status}).`;
  return e instanceof Error ? e.message : "Something went wrong.";
}

/** Builds a new post from the campaign and renders its slides (typically 20–60 s). */
export async function generatePost(campaignId: string): Promise<ActionResult<string>> {
  const { workspaceId } = await getWorkspace();
  const db = createAdminClient();

  let postId: string;
  try {
    postId = await buildPost(db, { workspaceId, campaignId });
  } catch (e) {
    console.error(e);
    return { ok: false, error: message(e) };
  }

  try {
    await renderPost(db, { postId, workspaceId, baseUrl: await baseUrl() });
  } catch (e) {
    console.error(e);
    await db.from("posts").update({ status: "failed", error: `Rendering failed: ${message(e)}` }).eq("id", postId);
    revalidatePath(`/campaigns/${campaignId}/posts`);
    return { ok: false, error: `Post created, but rendering failed: ${message(e)}` };
  }

  revalidatePath(`/campaigns/${campaignId}/posts`);
  return { ok: true, data: postId };
}

export async function rerenderPost(postId: string): Promise<ActionResult> {
  const { supabase, workspaceId } = await getWorkspace();
  try {
    await renderPost(createAdminClient(), { postId, workspaceId, baseUrl: await baseUrl() });
    await supabase.from("posts").update({ status: "preview", error: null }).eq("id", postId).eq("status", "failed");
  } catch (e) {
    console.error(e);
    return { ok: false, error: message(e) };
  }
  revalidatePath("/campaigns", "layout");
  return { ok: true, data: undefined };
}

export async function updatePostSlideText(slideId: string, text: string): Promise<ActionResult> {
  const { supabase } = await getWorkspace();
  const { error } = await supabase.from("post_slides").update({ text }).eq("id", slideId);
  return error ? { ok: false, error: error.message } : { ok: true, data: undefined };
}

export async function updatePostCaption(postId: string, caption: string) {
  const { supabase } = await getWorkspace();
  const { error } = await supabase.from("posts").update({ caption }).eq("id", postId);
  if (error) throw error;
}

export async function deletePost(postId: string) {
  const { supabase, workspaceId } = await getWorkspace();
  const { data: slides } = await supabase.from("post_slides").select("rendered_path").eq("post_id", postId);
  const paths = (slides ?? []).map((s) => s.rendered_path).filter(Boolean) as string[];
  if (paths.length) await supabase.storage.from("renders").remove(paths);
  const { error } = await supabase.from("posts").delete().eq("id", postId).eq("workspace_id", workspaceId);
  if (error) throw error;
  revalidatePath("/campaigns", "layout");
}

export async function sendPostToTikTok(postId: string): Promise<ActionResult<string>> {
  const { workspaceId } = await getWorkspace();
  const db = createAdminClient();
  try {
    await publishPost(db, { postId, workspaceId });
    // TikTok usually needs a few seconds to pull the images; check once right away.
    const { data: post } = await db.from("posts").select("id, tiktok_publish_id, tiktok_account_id").eq("id", postId).single();
    const status = post ? await syncPublishStatus(db, post).catch(() => "PROCESSING_DOWNLOAD") : "PROCESSING_DOWNLOAD";
    revalidatePath("/campaigns", "layout");
    return { ok: true, data: status };
  } catch (e) {
    console.error(e);
    return { ok: false, error: publishErrorMessage(e) };
  }
}

export async function refreshPostStatus(postId: string): Promise<ActionResult<string>> {
  const { workspaceId } = await getWorkspace();
  const db = createAdminClient();
  const { data: post } = await db
    .from("posts")
    .select("id, tiktok_publish_id, tiktok_account_id")
    .eq("id", postId)
    .eq("workspace_id", workspaceId)
    .single();
  if (!post?.tiktok_publish_id || !post.tiktok_account_id) return { ok: false, error: "This post was not sent to TikTok." };
  try {
    const status = await syncPublishStatus(db, post);
    revalidatePath("/campaigns", "layout");
    return { ok: true, data: status };
  } catch (e) {
    return { ok: false, error: publishErrorMessage(e) };
  }
}

/** "Send to TikTok" in the editor: builds a fresh post and sends it right away. */
export async function generateAndSendPost(campaignId: string): Promise<ActionResult<string>> {
  const generated = await generatePost(campaignId);
  if (!generated.ok) return generated;
  const sent = await sendPostToTikTok(generated.data);
  if (!sent.ok) return { ok: false, error: `Post created, but sending failed: ${sent.error}` };
  return sent;
}

// ─── Post editor (preview dialog) ────────────────────────────────────────────

export type EditorSlide = {
  id: string;
  kind: SlideKind;
  text: string;
  layout: Omit<SlideLayout, "libraryId">;
  assetId: string | null;
  imageUrl: string | null;
  imageCrop: ImageCrop | null;
};

export type EditorPost = {
  id: string;
  campaignId: string;
  status: string;
  caption: string;
  sentToTikTok: boolean;
  slides: EditorSlide[];
};

type SlideRow = {
  id: string;
  position: number;
  kind: SlideKind;
  text: string;
  layout: Omit<SlideLayout, "libraryId">;
  asset: { id: string; thumb_path: string | null; crop: ImageCrop | null } | null;
};

export async function getPostForEditor(postId: string): Promise<ActionResult<EditorPost>> {
  const { supabase } = await getWorkspace();
  const { data: post, error } = await supabase
    .from("posts")
    .select("id, campaign_id, status, caption, tiktok_publish_id, post_slides(id, position, kind, text, layout, asset:assets(id, thumb_path, crop))")
    .eq("id", postId)
    .single();
  if (error || !post) return { ok: false, error: "Post not found" };

  const rows = (post.post_slides as unknown as SlideRow[]).sort((a, b) => a.position - b.position);
  const urls = await signPaths(supabase, "assets", rows.map((r) => r.asset?.thumb_path ?? null));
  return {
    ok: true,
    data: {
      id: post.id,
      campaignId: post.campaign_id,
      status: post.status,
      caption: post.caption ?? "",
      sentToTikTok: !!post.tiktok_publish_id,
      slides: rows.map((r) => ({
        id: r.id,
        kind: r.kind,
        text: r.text,
        layout: r.layout,
        assetId: r.asset?.id ?? null,
        imageUrl: r.asset?.thumb_path ? (urls.get(r.asset.thumb_path) ?? null) : null,
        imageCrop: r.asset?.crop ?? null,
      })),
    },
  };
}

/** AI rewrite of one slide, given the (possibly edited) texts of the whole post. */
export async function rewritePostSlide(
  postId: string,
  slides: { kind: SlideKind; text: string }[],
  index: number,
): Promise<ActionResult<string>> {
  const { supabase } = await getWorkspace();
  const { data: post } = await supabase
    .from("posts")
    .select(
      "campaign:campaigns(language, content_prompt, content_slide_count, content_format, content_length, tone, product:products(name, description, facts, voice, avoid))",
    )
    .eq("id", postId)
    .single();
  const c = post?.campaign as unknown as
    | {
        language: string;
        content_prompt: string;
        content_slide_count: number;
        content_format: CampaignContext["contentFormat"];
        content_length: CampaignContext["contentLength"];
        tone: CampaignContext["tone"];
        product: ProductContext | null;
      }
    | undefined;
  if (!c) return { ok: false, error: "Post not found" };
  try {
    const text = await rewriteSlide({
      product: c.product,
      campaign: {
        language: c.language,
        contentPrompt: c.content_prompt,
        contentSlideCount: c.content_slide_count,
        contentFormat: c.content_format,
        contentLength: c.content_length,
        tone: c.tone,
      },
      slides,
      index,
    });
    return { ok: true, data: text };
  } catch (e) {
    console.error(e);
    return { ok: false, error: message(e) };
  }
}

/** Picks a different image for one slide from the campaign's library for that slide type. */
export async function pickOtherImage(
  postId: string,
  kind: SlideKind,
  excludeAssetIds: string[],
): Promise<ActionResult<{ assetId: string; imageUrl: string | null; imageCrop: ImageCrop | null }>> {
  const { supabase } = await getWorkspace();
  const { data: post } = await supabase.from("posts").select("campaign:campaigns(layout)").eq("id", postId).single();
  const libraryId = withDefaults((post?.campaign as unknown as { layout: never } | null)?.layout)[kind].libraryId;
  if (!libraryId) return { ok: false, error: `The campaign has no ${kind} image library.` };

  const { data: rows } = await supabase
    .from("library_assets")
    .select("asset:assets!inner(id, thumb_path, crop, locked)")
    .eq("library_id", libraryId)
    .eq("asset.locked", false);
  const candidates = (rows ?? [])
    .map((r) => r.asset as unknown as { id: string; thumb_path: string | null; crop: ImageCrop | null })
    .filter((a) => !excludeAssetIds.includes(a.id));
  if (!candidates.length) return { ok: false, error: "No other images in this library." };

  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  const urls = await signPaths(supabase, "assets", [pick.thumb_path]);
  return {
    ok: true,
    data: { assetId: pick.id, imageUrl: pick.thumb_path ? (urls.get(pick.thumb_path) ?? null) : null, imageCrop: pick.crop },
  };
}

/** Saves edited slides and caption, then re-renders the post. */
export async function savePostEdits(
  postId: string,
  edits: { caption: string; slides: { id: string; text: string; layout: EditorSlide["layout"]; assetId: string | null }[] },
): Promise<ActionResult> {
  const { supabase, workspaceId } = await getWorkspace();
  const { data: post } = await supabase.from("posts").select("id, tiktok_publish_id, status").eq("id", postId).single();
  if (!post) return { ok: false, error: "Post not found" };
  if (post.tiktok_publish_id && post.status !== "failed") return { ok: false, error: "This post was already sent to TikTok." };

  const results = await Promise.all([
    supabase.from("posts").update({ caption: edits.caption }).eq("id", postId),
    ...edits.slides.map((s) =>
      supabase.from("post_slides").update({ text: s.text, layout: s.layout, asset_id: s.assetId }).eq("id", s.id).eq("post_id", postId),
    ),
  ]);
  const failed = results.find((r) => r.error);
  if (failed?.error) return { ok: false, error: failed.error.message };

  try {
    await renderPost(createAdminClient(), { postId, workspaceId, baseUrl: await baseUrl() });
  } catch (e) {
    console.error(e);
    return { ok: false, error: `Saved, but rendering failed: ${message(e)}` };
  }
  revalidatePath("/campaigns", "layout");
  return { ok: true, data: undefined };
}
