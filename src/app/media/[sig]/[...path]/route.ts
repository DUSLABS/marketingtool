import { createAdminClient } from "@/lib/supabase/admin";
import { verifyMediaSignature } from "@/lib/tiktok/media";

// Serves rendered slides to TikTok (PULL_FROM_URL). Access is by signed path only.
export async function GET(_req: Request, ctx: RouteContext<"/media/[sig]/[...path]">) {
  const { sig, path } = await ctx.params;
  const renderPath = path.join("/");
  if (!/^[0-9a-f-]{36}\/[0-9a-f-]{36}\/\d+\.jpg$/.test(renderPath) || !verifyMediaSignature(renderPath, sig)) {
    return new Response("Not found", { status: 404 });
  }

  const { data, error } = await createAdminClient().storage.from("renders").download(renderPath);
  if (error || !data) return new Response("Not found", { status: 404 });

  return new Response(data, {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=86400, immutable" },
  });
}
