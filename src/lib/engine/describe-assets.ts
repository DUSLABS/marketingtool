import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describeImage } from "@/lib/ai/generate";

const CONCURRENCY = 4;

/** Writes AI descriptions for images that have none yet. Returns how many were described. */
export async function describeAssets(db: SupabaseClient, { workspaceId, ids, limit = 40 }: { workspaceId: string; ids?: string[]; limit?: number }) {
  let query = db
    .from("assets")
    .select("id, thumb_path")
    .eq("workspace_id", workspaceId)
    .is("description", null)
    .not("thumb_path", "is", null)
    .limit(limit);
  if (ids) query = query.in("id", ids);
  const { data: assets, error } = await query;
  if (error) throw error;
  if (!assets.length) return 0;

  const { data: signed, error: signError } = await db.storage.from("assets").createSignedUrls(
    assets.map((a) => a.thumb_path!),
    600,
  );
  if (signError) throw signError;
  const urlByPath = new Map(signed.map((s) => [s.path, s.signedUrl]));

  let described = 0;
  const queue = [...assets];
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (let a = queue.shift(); a; a = queue.shift()) {
        const url = urlByPath.get(a.thumb_path!);
        if (!url) continue;
        try {
          const description = await describeImage(url);
          await db.from("assets").update({ description }).eq("id", a.id);
          described++;
        } catch (e) {
          console.error(`Describing asset ${a.id} failed`, e);
        }
      }
    }),
  );
  return described;
}
