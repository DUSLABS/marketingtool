import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildPost } from "./build-post";
import { renderPost } from "./render-post";
import { publishErrorMessage, publishPost, syncPublishStatus } from "./publish-post";
import { localDay, occurrences, zonedTimeToUtc, type ScheduleSlot } from "./schedule";

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

  // 2. Create, render and publish posts for due slots.
  const { data: campaigns, error } = await db
    .from("campaigns")
    .select("id, name, workspace_id, timezone, max_posts_per_day, schedule_slots(id, time_of_day, weekdays)")
    .eq("status", "active");
  if (error) throw error;

  for (const c of campaigns ?? []) {
    const slots = c.schedule_slots as ScheduleSlot[];
    const due = occurrences(slots, c.timezone, new Date(now.getTime() - CATCH_UP_MS), now);

    for (const { at } of due) {
      if (Date.now() - started > TIME_BUDGET_MS) {
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
