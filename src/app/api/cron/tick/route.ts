import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { runTick } from "@/lib/engine/scheduler";

// Called every 5 minutes by Supabase pg_cron (see supabase/cron-setup.sql).
export const maxDuration = 300;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export async function GET(request: Request) {
  if (!authorized(request)) return new Response("Unauthorized", { status: 401 });
  // Render via this deployment; TikTok itself always gets public-domain media URLs.
  const report = await runTick(createAdminClient(), { baseUrl: new URL(request.url).origin });
  if (report.errors.length) console.error("tick errors", report.errors);
  return Response.json(report);
}
