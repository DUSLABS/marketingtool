import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { screenshotSlides } from "@/lib/render/browser";
import { createRenderToken } from "@/lib/render/token";

/**
 * Renders every slide of a post to a JPEG via the /render page and stores them in the
 * `renders` bucket at <workspace>/<post>/<position>.jpg.
 */
export async function renderPost(db: SupabaseClient, { postId, workspaceId, baseUrl }: { postId: string; workspaceId: string; baseUrl: string }) {
  const { data: slides, error } = await db
    .from("post_slides")
    .select("id, position, post:posts!inner(workspace_id)")
    .eq("post_id", postId)
    .eq("post.workspace_id", workspaceId)
    .order("position");
  if (error) throw error;
  if (!slides.length) throw new Error("Post has no slides");

  const url = `${baseUrl}/render/${postId}?token=${encodeURIComponent(createRenderToken(postId))}`;
  const images = await screenshotSlides(url, slides.length);

  await Promise.all(
    slides.map(async (slide, i) => {
      const path = `${workspaceId}/${postId}/${slide.position}.jpg`;
      const { error: uploadError } = await db.storage
        .from("renders")
        .upload(path, images[i], { contentType: "image/jpeg", upsert: true });
      if (uploadError) throw uploadError;
      const { error: updateError } = await db.from("post_slides").update({ rendered_path: path }).eq("id", slide.id);
      if (updateError) throw updateError;
    }),
  );
}
