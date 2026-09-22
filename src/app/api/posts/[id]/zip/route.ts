import { zipSync } from "fflate";
import { createClient } from "@/lib/supabase/server";

// Downloads a post's rendered slides plus its caption as a ZIP, for manual upload to TikTok.
export async function GET(_req: Request, ctx: RouteContext<"/api/posts/[id]/zip">) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return new Response("Unauthorized", { status: 401 });

  // RLS limits this to posts in the user's workspace.
  const { data: post } = await supabase
    .from("posts")
    .select("caption, campaign:campaigns(name), post_slides(position, rendered_path)")
    .eq("id", id)
    .maybeSingle();
  if (!post) return new Response("Not found", { status: 404 });

  const slides = (post.post_slides as { position: number; rendered_path: string | null }[]).sort((a, b) => a.position - b.position);
  if (slides.some((s) => !s.rendered_path)) return new Response("Post is not rendered yet", { status: 409 });

  const files: Record<string, Uint8Array> = {};
  await Promise.all(
    slides.map(async (s) => {
      const { data, error } = await supabase.storage.from("renders").download(s.rendered_path!);
      if (error) throw error;
      files[`slide-${String(s.position + 1).padStart(2, "0")}.jpg`] = new Uint8Array(await data.arrayBuffer());
    }),
  );
  files["caption.txt"] = new TextEncoder().encode(post.caption ?? "");

  // JPEGs are already compressed: store without deflate.
  const zip = zipSync(files, { level: 0 });
  const name = ((post.campaign as unknown as { name: string } | null)?.name ?? "post").replace(/[^\w-]+/g, "-").toLowerCase();
  return new Response(zip, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${name}-${id.slice(0, 8)}.zip"`,
    },
  });
}
