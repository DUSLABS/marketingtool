import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { runTick } from "@/lib/engine/scheduler";

// Called every 5 minutes by Supabase pg_cron (see supabase/cron-setup.sql).
export const maxDuration = 300;

function authorized(request: Request, secret: string) {
  const header = (request.headers.get("authorization") ?? "").trim();
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export async function GET(request: Request) {
  // Trimmed: values pasted into the Vercel dashboard easily pick up a trailing newline.
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return new Response("CRON_SECRET is not configured", { status: 503 });
  if (!authorized(request, secret)) return new Response("Unauthorized", { status: 401 });
  // Render via this deployment; TikTok itself always gets public-domain media URLs.
  const report = await runTick(createAdminClient(), { baseUrl: new URL(request.url).origin });
  if (report.errors.length) console.error("tick errors", report.errors);
  return Response.json(report);
}
