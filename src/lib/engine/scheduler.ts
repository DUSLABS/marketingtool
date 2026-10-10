import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildPost } from "./build-post";
import { renderPost } from "./render-post";
import { publishErrorMessage, publishPost, syncPublishStatus } from "./publish-post";
import { localDay, occurrences, zonedTimeToUtc, type ScheduleSlot } from "./schedule";
import { advanceAutomaticImages } from "./automatic-images";

// One scheduler run ("tick"), triggered every 5 minutes by pg_cron. Idempotent: the unique index
// on (campaign_id, scheduled_for) guarantees one post per slot even if ticks overlap.

const CATCH_UP_MS = 30 * 60 * 1000; // slots missed by up to 30 min are still posted
const TIME_BUDGET_MS = 200 * 1000; // stop starting new posts well before the 300 s function limit

type TickReport = { synced: number; created: string[]; skipped: string[]; errors: string[] };

export async function runTick(db: SupabaseClient, { baseUrl, now = new Date() }: { baseUrl: string; now?: Date }) {
  const started = Date.now();
  const report: TickReport = { synced: 0, created: [], skipped: [], errors: [] };

  // 1. Follow up on posts TikTok is still processing.
  const { data: uploading } = await db
    .from("posts")
    .select("id, tiktok_publish_id, tiktok_account_id")
    .eq("status", "uploading")
    .not("tiktok_publish_id", "is", null)
    .limit(30);
  for (const post of uploading ?? []) {
    try {
      await syncPublishStatus(db, post);
      report.synced++;
    } catch (e) {
      report.errors.push(`status ${post.id}: ${publishErrorMessage(e)}`);
    }
  }

  // 2. Resume durable image jobs, including previews whose browser was closed.
  // Only start an image step with enough headroom for generation (120 s) and review (45 s).
  const { data: jobs, error: jobsError } = await db.from("posts")
    .select("id, workspace_id").eq("status", "generating")
    .order("scheduled_for", { nullsFirst: false }).order("created_at").limit(1);
  if (jobsError) throw jobsError;
  for (const job of jobs ?? []) {
    try {
      for (let step = 0; step < 12 && Date.now() - started < 45_000; step++) {
        const progress = await advanceAutomaticImages(db, { postId: job.id, workspaceId: job.workspace_id, baseUrl });
        if (progress.done || progress.total === 0) break;
      }
    } catch (e) {
      report.errors.push(`images ${job.id}: ${publishErrorMessage(e)}`);
    }
  }

  // Completed automatic posts are published only when due. Future slots stay queued,
  // and pausing a campaign also pauses its already prepared scheduled posts.
  const { data: ready, error: readyError } = await db.from("posts")
    .select("id, campaign_id, workspace_id, scheduled_for, campaign:campaigns!inner(status)")
    .eq("status", "queued").not("image_generation", "is", null)
    .or(`scheduled_for.is.null,scheduled_for.lte.${now.toISOString()}`).limit(20);
  if (readyError) throw readyError;
  for (const post of ready ?? []) {
    if (Date.now() - started > TIME_BUDGET_MS) break;
    const campaign = post.campaign as unknown as { status: string };
    if (post.scheduled_for && campaign.status !== "active") continue;
    const token = randomUUID();
    const { data: claimed, error: claimError } = await db.rpc("claim_image_generation", {
      p_campaign_id: post.campaign_id, p_token: token,
    });
    if (claimError) throw claimError;
    if (!claimed) continue;
    try {
      const { data: current, error: currentError } = await db.from("posts").select("status")
        .eq("id", post.id).eq("workspace_id", post.workspace_id).single();
      if (currentError) throw currentError;
      if (current.status !== "queued") continue;
      await publishPost(db, { postId: post.id, workspaceId: post.workspace_id });
      report.created.push(post.id);
    } catch (e) {
      const message = publishErrorMessage(e);
      await db.from("posts").update({ status: "failed", error: message }).eq("id", post.id).eq("status", "queued");
      report.errors.push(`${post.id}: ${message}`);
    } finally {
      await db.from("image_generation_leases").delete().eq("campaign_id", post.campaign_id).eq("token", token);
    }
  }

  // 3. Automatic campaigns prepare six hours ahead; library-only campaigns keep their schedule.
  const { data: campaigns, error } = await db
    .from("campaigns")
    .select("id, name, workspace_id, timezone, image_mode, max_posts_per_day, schedule_slots(id, time_of_day, weekdays)")
    .eq("status", "active");
  if (error) throw error;

  for (const c of campaigns ?? []) {
    const slots = c.schedule_slots as ScheduleSlot[];
    const due = occurrences(slots, c.timezone, new Date(now.getTime() - CATCH_UP_MS),
      c.image_mode === "auto" ? new Date(now.getTime() + 6 * 60 * 60 * 1000) : now);

    for (const { at } of due) {
      if (Date.now() - started > (c.image_mode === "auto" ? 45_000 : TIME_BUDGET_MS)) {
        report.skipped.push(`${c.name} ${at.toISOString()}: time budget, next tick`);
        continue;
      }
      const scheduledFor = at.toISOString();

      const { data: existing } = await db
        .from("posts")
        .select("id")
        .eq("campaign_id", c.id)
        .eq("scheduled_for", scheduledFor)
        .maybeSingle();
      if (existing) continue;

      // Daily cap, counted per local calendar day of the campaign.
      const day = localDay(at, c.timezone);
      const dayStart = zonedTimeToUtc(day.y, day.m, day.d, 0, 0, c.timezone);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      const { count } = await db
        .from("posts")
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", c.id)
        .gte("scheduled_for", dayStart.toISOString())
        .lt("scheduled_for", dayEnd.toISOString());
      if ((count ?? 0) >= c.max_posts_per_day) {
        report.skipped.push(`${c.name} ${scheduledFor}: daily limit`);
        continue;
      }

      let postId: string | null = null;
      try {
        postId = await buildPost(db, { workspaceId: c.workspace_id, campaignId: c.id, status: "queued", scheduledFor });
        if (c.image_mode === "auto") {
          report.created.push(`${c.name} ${scheduledFor}: preparing images`);
          continue;
        }
        await renderPost(db, { postId, workspaceId: c.workspace_id, baseUrl });
        await publishPost(db, { postId, workspaceId: c.workspace_id });
        report.created.push(`${c.name} ${scheduledFor}`);
      } catch (e) {
        // 23505 = unique violation: another tick already took this slot.
        if ((e as { code?: string }).code === "23505") continue;
        const message = publishErrorMessage(e);
        report.errors.push(`${c.name} ${scheduledFor}: ${message}`);
        if (postId) await db.from("posts").update({ status: "failed", error: message }).eq("id", postId);
      }
    }
  }

  return report;
}
