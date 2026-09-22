"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import Anthropic from "@anthropic-ai/sdk";
import { getWorkspace } from "@/lib/workspace";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildPost, CampaignNotReadyError } from "@/lib/engine/build-post";
import { renderPost } from "@/lib/engine/render-post";
import { publishErrorMessage, publishPost, syncPublishStatus } from "@/lib/engine/publish-post";

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
