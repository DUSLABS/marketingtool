import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchPublishStatus, initPhotoPost, queryCreatorInfo, TikTokError } from "@/lib/tiktok/api";
import { getAccessToken } from "@/lib/tiktok/accounts";
import { mediaUrl } from "@/lib/tiktok/media";

export class PublishNotReadyError extends Error {}

/** Sends a rendered post to TikTok using its campaign's publishing settings. */
export async function publishPost(db: SupabaseClient, { postId, workspaceId }: { postId: string; workspaceId: string }) {
  const { data: post, error } = await db
    .from("posts")
    .select(
      "id, status, caption, campaign:campaigns(tiktok_account_id, publish_mode, privacy_level, allow_comments, disclose_commercial, ai_label), post_slides(position, text, rendered_path)",
    )
    .eq("id", postId)
    .eq("workspace_id", workspaceId)
    .single();
  if (error) throw error;

  const campaign = post.campaign as unknown as {
    tiktok_account_id: string | null;
    publish_mode: "draft" | "direct";
    privacy_level: string | null;
    allow_comments: boolean;
    disclose_commercial: boolean;
    ai_label: boolean;
  };
  const slides = (post.post_slides as { position: number; text: string; rendered_path: string | null }[]).sort(
    (a, b) => a.position - b.position,
  );

  if (!campaign.tiktok_account_id) throw new PublishNotReadyError("Choose a TikTok account in the campaign's Publish tab.");
  if (slides.some((s) => !s.rendered_path)) throw new PublishNotReadyError("Render the post before sending it to TikTok.");
  if (["uploading", "in_drafts", "published"].includes(post.status)) {
    throw new PublishNotReadyError("This post was already sent to TikTok.");
  }

  const accessToken = await getAccessToken(db, campaign.tiktok_account_id);

  if (campaign.publish_mode === "direct") {
    // TikTok requires the privacy level to be one the creator currently offers.
    const creator = await queryCreatorInfo(accessToken);
    if (!campaign.privacy_level || !creator.privacy_level_options.includes(campaign.privacy_level)) {
      throw new PublishNotReadyError(
        `Choose who can see the posts in the Publish tab (available: ${creator.privacy_level_options.join(", ")}).`,
      );
    }
  }

  const { publish_id } = await initPhotoPost(accessToken, {
    mode: campaign.publish_mode,
    imageUrls: slides.map((s) => mediaUrl(s.rendered_path!)),
    title: slides[0]?.text ?? "",
    description: post.caption ?? "",
    privacyLevel: campaign.privacy_level ?? undefined,
    allowComments: campaign.allow_comments,
    discloseCommercial: campaign.disclose_commercial,
    isAigc: campaign.ai_label,
  });

  const { error: updateError } = await db
    .from("posts")
    .update({
      status: "uploading",
      tiktok_publish_id: publish_id,
      tiktok_account_id: campaign.tiktok_account_id,
      tiktok_status: "PROCESSING_DOWNLOAD",
      published_mode: campaign.publish_mode,
      error: null,
    })
    .eq("id", postId);
  if (updateError) throw updateError;
  return publish_id;
}

const FAIL_REASONS: Record<string, string> = {
  photo_pull_failed: "TikTok could not download the images. Check that the domain is verified in the TikTok app settings.",
  spam_risk_too_many_posts: "TikTok's daily posting limit for this account is reached.",
  spam_risk_user_banned_from_posting: "This TikTok account is currently not allowed to post.",
  picture_size_check_failed: "TikTok rejected the image size.",
  auth_removed: "The TikTok account removed access. Reconnect it under Connections.",
  publish_cancelled: "The post was cancelled in TikTok.",
};

/** Polls TikTok for a post that is being uploaded and maps the result onto our status. */
export async function syncPublishStatus(db: SupabaseClient, post: { id: string; tiktok_publish_id: string; tiktok_account_id: string }) {
  const accessToken = await getAccessToken(db, post.tiktok_account_id);
  const s = await fetchPublishStatus(accessToken, post.tiktok_publish_id);

  const update: Record<string, unknown> = { tiktok_status: s.status };
  if (s.status === "SEND_TO_USER_INBOX") update.status = "in_drafts";
  if (s.status === "PUBLISH_COMPLETE") {
    update.status = "published";
    update.published_at = new Date().toISOString();
    if (s.publicaly_available_post_id?.length) update.tiktok_post_id = String(s.publicaly_available_post_id[0]);
  }
  if (s.status === "FAILED") {
    update.status = "failed";
    update.error = FAIL_REASONS[s.fail_reason ?? ""] ?? `TikTok: ${s.fail_reason ?? "publishing failed"}`;
  }
  await db.from("posts").update(update).eq("id", post.id);
  return s.status;
}

export function publishErrorMessage(e: unknown) {
  if (e instanceof PublishNotReadyError) return e.message;
  if (e instanceof TikTokError) {
    if (e.code === "spam_risk_too_many_posts") return FAIL_REASONS.spam_risk_too_many_posts;
    if (e.code === "rate_limit_exceeded") return "TikTok rate limit reached. Try again in a minute.";
    if (e.code === "url_ownership_unverified") return "TikTok says the image domain is not verified. Verify marketingtool.duslabs.de in the TikTok developer portal.";
    return `TikTok: ${e.message} (${e.code})`;
  }
  return e instanceof Error ? e.message : "Sending to TikTok failed.";
}
