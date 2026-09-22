import { notFound } from "next/navigation";
import { Slide } from "@/components/slides/slide";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyRenderToken } from "@/lib/render/token";
import type { ImageCrop, SlideKind, SlideLayout } from "@/lib/slides/types";

// Internal page opened by the headless browser to screenshot a post's slides. Protected by a
// short-lived signed token instead of a session.
export default async function RenderPage({ params, searchParams }: PageProps<"/render/[postId]">) {
  const { postId } = await params;
  const { token } = await searchParams;
  if (!verifyRenderToken(postId, typeof token === "string" ? token : undefined)) notFound();

  const db = createAdminClient();
  const { data: slides, error } = await db
    .from("post_slides")
    .select("position, kind, text, layout, asset:assets(storage_path, crop)")
    .eq("post_id", postId)
    .order("position");
  if (error) throw error;

  const assets = slides.map((s) => s.asset as unknown as { storage_path: string; crop: ImageCrop | null } | null);
  const paths = assets.map((a) => a?.storage_path ?? null);
  const signed = paths.some(Boolean)
    ? await db.storage.from("assets").createSignedUrls(paths.filter((p): p is string => !!p), 300)
    : { data: [] };
  const urlByPath = new Map((signed.data ?? []).map((d) => [d.path, d.signedUrl]));

  return (
    <div style={{ background: "#000" }}>
      {slides.map((s, i) => (
        <div key={s.position} id={`slide-${i}`} style={{ width: 1080, height: 1920 }}>
          <Slide
            kind={s.kind as SlideKind}
            layout={{ ...(s.layout as Omit<SlideLayout, "libraryId">), libraryId: null }}
            text={s.text}
            imageUrl={paths[i] ? (urlByPath.get(paths[i]) ?? null) : null}
            imageCrop={assets[i]?.crop}
          />
        </div>
      ))}
    </div>
  );
}
