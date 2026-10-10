import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { chooseRelevantImage, reviewSlideImage } from "@/lib/ai/generate";
import { generateImage, IMAGE_MODEL } from "@/lib/ai/images";
import { canReuseImage, imageSettingsSchema } from "@/lib/slides/image-policy";
import { CANVAS, type ImageCrop } from "@/lib/slides/types";
import { describeAssets } from "./describe-assets";
import { renderPost } from "./render-post";
import { prepareSocialImage } from "./social-images";

const jobSchema = imageSettingsSchema.extend({ targetStatus: z.enum(["preview", "queued"]) });
type Candidate = { id: string; description: string | null; favorite: boolean; storage_path: string; crop: ImageCrop | null; origin_campaign_id: string | null };
type WorkSlide = { id: string; position: number; kind: string; text: string; asset_id: string | null;
  visual_prompt: string | null; image_library_id: string | null; image_attempts: number; image_rejected_assets: string[] };

async function candidatesForSlide(db: SupabaseClient, workspaceId: string, campaignId: string, libraryId: string | null) {
  let ids: Set<string> | null = null;
  if (libraryId) {
    ids = new Set();
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await db.from("library_assets")
        .select("asset_id, library:libraries!inner(workspace_id)")
        .eq("library_id", libraryId).eq("library.workspace_id", workspaceId)
        .order("asset_id").range(offset, offset + 499);
      if (error) throw error;
      for (const row of data) ids.add(row.asset_id);
      if (data.length < 500) break;
    }
  }
  const all: Candidate[] = [];
  // Read pages so older, suitable images are not silently excluded by Supabase's row limit.
  for (let offset = 0; ; offset += 500) {
    const query = db.from("assets").select("id, description, favorite, storage_path, crop, origin_campaign_id")
      .eq("workspace_id", workspaceId).eq("locked", false)
      .or(`source.eq.upload,origin_campaign_id.eq.${campaignId}`)
      .order("id").range(offset, offset + 499);
    // An attached library is a preference boundary; own generated images remain reusable.
    const { data, error } = await query;
    if (error) throw error;
    all.push(...(data as Candidate[]).filter((a) => !ids || ids.has(a.id) || a.origin_campaign_id === campaignId));
    if (data.length < 500) break;
  }
  return all;
}

async function saveGeneratedImage(db: SupabaseClient, input: {
  workspaceId: string; campaignId: string; prompt: string; description: string; image: Buffer; thumbnail: Buffer;
}) {
  const id = randomUUID();
  const imagePath = `${input.workspaceId}/${id}/original.jpg`;
  const thumbPath = `${input.workspaceId}/${id}/thumb.jpg`;
  const bucket = db.storage.from("assets");
  const paths: string[] = [];
  try {
    for (const [path, bytes] of [[imagePath, input.image], [thumbPath, input.thumbnail]] as const) {
      const { error } = await bucket.upload(path, bytes, { contentType: "image/jpeg" });
      if (error) throw error;
      paths.push(path);
    }
    const { error } = await db.from("assets").insert({
      id, workspace_id: input.workspaceId, storage_path: imagePath, thumb_path: thumbPath,
      width: CANVAS.width, height: CANVAS.height, sha256: createHash("sha256").update(input.image).digest("hex"),
      source: "generated", generation_prompt: input.prompt, generation_model: IMAGE_MODEL,
      origin_campaign_id: input.campaignId, description: input.description,
    });
    if (error) throw error;
  } catch (error) {
    if (paths.length) await bucket.remove(paths);
    throw error;
  }
  const { data: campaign, error: campaignError } = await db.from("campaigns").select("name")
    .eq("id", input.campaignId).eq("workspace_id", input.workspaceId).single();
  if (campaignError) throw campaignError;
  const { data: library, error: libraryError } = await db.from("libraries").upsert({
    workspace_id: input.workspaceId, generated_campaign_id: input.campaignId, name: `${campaign.name} · AI images`,
  }, { onConflict: "generated_campaign_id" }).select("id").single();
  if (libraryError) throw libraryError;
  const { error: linkError } = await db.from("library_assets").insert({ library_id: library.id, asset_id: id });
  if (linkError) throw linkError;
  return id;
}

/** One durable slide per invocation. A campaign lease serializes concurrent previews and cron. */
export async function advanceAutomaticImages(db: SupabaseClient, input: {
  workspaceId: string; postId: string; baseUrl: string;
}): Promise<{ done: boolean; completed: number; total: number }> {
  const { data: initial, error: initialError } = await db.from("posts")
    .select("campaign_id").eq("id", input.postId).eq("workspace_id", input.workspaceId).single();
  if (initialError) throw initialError;
  const token = randomUUID();
  const { data: claimed, error: claimError } = await db.rpc("claim_image_generation", {
    p_campaign_id: initial.campaign_id, p_token: token,
  });
  if (claimError) throw claimError;
  if (!claimed) return { done: false, completed: 0, total: 0 };
  try {
    const { data: post, error } = await db.from("posts")
      .select("id, campaign_id, status, image_generation, error, post_slides(id, position, kind, text, asset_id, visual_prompt, image_library_id, image_attempts, image_rejected_assets)")
      .eq("id", input.postId).eq("workspace_id", input.workspaceId).single();
    if (error) throw error;
    const slides = (post.post_slides as WorkSlide[]).sort((a, b) => a.position - b.position);
    const total = slides.length;
    const completed = slides.filter((s) => s.asset_id).length;
    if (post.status !== "generating") {
      if (post.status === "failed") throw new Error(post.error || "Image generation failed. Retry this post.");
      return { done: true, completed, total };
    }
    if (!total) throw new Error("The post has no slides. Generate a new post.");
    const settings = jobSchema.parse(post.image_generation);
    const slide = slides.find((s) => !s.asset_id);
    if (!slide) {
      await renderPost(db, input);
      const { error: finishError } = await db.from("posts").update({ status: settings.targetStatus, error: null })
        .eq("id", input.postId).eq("workspace_id", input.workspaceId);
      if (finishError) throw finishError;
      return { done: true, completed, total };
    }
    if (slide.image_attempts >= 2) throw new Error("Image generation stopped after two attempts for this slide. Retry the post to continue.");
    let generationAttempted = false;
    try {
      const prompt = slide.visual_prompt;
      if (!prompt) throw new Error("This slide has no image brief.");
      const reusePrompt = slide.kind === "cta" && slide.image_library_id
        ? `${prompt}\nThis is the CTA's explicitly selected product library. A genuine supplied product screenshot or app-store graphic is also suitable for this CTA; its existing interface and lettering are allowed. Do not treat a real supplied screenshot as an invented interface.`
        : prompt;
      const { data: history, error: historyError } = await db.rpc("campaign_image_usage", {
        p_workspace_id: input.workspaceId, p_campaign_id: post.campaign_id,
      });
      if (historyError) throw historyError;
      const usage = new Map<string, { uses: number; lastUsed: number }>(
        (history as { asset_id: string; uses: number; last_used: string }[]).map((r) =>
          [r.asset_id, { uses: Number(r.uses), lastUsed: new Date(r.last_used).getTime() }]),
      );
      const taken = new Set(slides.map((s) => s.asset_id));
      const rejected = new Set(slide.image_rejected_assets);
      const candidates = (await candidatesForSlide(db, input.workspaceId, post.campaign_id, slide.image_library_id))
        .filter((a) => !taken.has(a.id) && !rejected.has(a.id) && canReuseImage(usage.get(a.id) ?? { uses: 0, lastUsed: 0 }, settings))
        .sort((a, b) => (usage.get(a.id)?.uses ?? 0) - (usage.get(b.id)?.uses ?? 0));
      let assetId: string | null = null;
      // Search the entire eligible catalogue across bounded, resumable batches.
      const pool = candidates.filter((a): a is Candidate & { description: string } => !!a.description).slice(0, 60);
      if (pool.length) {
        const chosen = await chooseRelevantImage({ text: slide.text, prompt: reusePrompt, candidates: pool });
        if (chosen) {
          const candidate = pool.find((a) => a.id === chosen)!;
          const { data: bytes, error: downloadError } = await db.storage.from("assets").download(candidate.storage_path);
          if (downloadError) throw downloadError;
          const prepared = await prepareSocialImage(Buffer.from(await bytes.arrayBuffer()), candidate.crop);
          const review = await reviewSlideImage({ base64: prepared.image.toString("base64"), text: slide.text, prompt: reusePrompt });
          if (review.fits) assetId = chosen;
          else rejected.add(chosen);
        } else {
          for (const candidate of pool) rejected.add(candidate.id);
        }
        if (!assetId) {
          const { error: rejectError } = await db.from("post_slides").update({ image_rejected_assets: [...rejected] })
            .eq("id", slide.id).eq("post_id", post.id);
          if (rejectError) throw rejectError;
          return { done: false, completed, total };
        }
      }
      if (!assetId) {
        const undescribed = candidates.filter((a) => !a.description).slice(0, 10);
        if (undescribed.length) {
          const count = await describeAssets(db, { workspaceId: input.workspaceId, ids: undescribed.map((a) => a.id), limit: 10 });
          if (!count) throw new Error("Could not analyse existing images. Check the text AI account and retry.");
          return { done: false, completed, total };
        }
        const { error: attemptError } = await db.from("post_slides").update({ image_attempts: slide.image_attempts + 1 })
          .eq("id", slide.id).eq("post_id", post.id);
        if (attemptError) throw attemptError;
        generationAttempted = true;
        const correctedPrompt = post.error?.startsWith("Image does not fit")
          ? `${prompt}\nCorrect this problem from the previous attempt: ${post.error}` : prompt;
        const prepared = await prepareSocialImage(await generateImage(correctedPrompt));
        const review = await reviewSlideImage({ base64: prepared.image.toString("base64"), text: slide.text, prompt });
        if (!review.fits) throw new Error(`Image does not fit slide ${slide.position + 1}: ${review.reason}`);
        assetId = await saveGeneratedImage(db, {
          workspaceId: input.workspaceId, campaignId: post.campaign_id, prompt: correctedPrompt,
          description: review.description, ...prepared,
        });
      }
      const { error: saveError } = await db.from("post_slides").update({ asset_id: assetId })
        .eq("id", slide.id).eq("post_id", post.id);
      if (saveError) throw saveError;
      await db.from("posts").update({ error: null }).eq("id", post.id).eq("workspace_id", input.workspaceId);
      return { done: false, completed: completed + 1, total };
    } catch (error) {
      if (!generationAttempted) throw error;
      const message = error instanceof Error ? error.message : "Image generation failed.";
      const { error: saveError } = await db.from("posts").update({
        error: message, ...(slide.image_attempts + 1 >= 2 ? { status: "failed" } : {}),
      }).eq("id", post.id).eq("workspace_id", input.workspaceId);
      if (saveError) throw saveError;
      if (slide.image_attempts + 1 >= 2) throw error;
      return { done: false, completed, total };
    }
  } catch (error) {
    await db.from("posts").update({ status: "failed", error: error instanceof Error ? error.message : "Image creation failed." })
      .eq("id", input.postId).eq("workspace_id", input.workspaceId).eq("status", "generating");
    throw error;
  } finally {
    await db.from("image_generation_leases").delete().eq("campaign_id", initial.campaign_id).eq("token", token);
  }
}
