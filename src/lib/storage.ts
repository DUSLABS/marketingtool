import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

const SIGNED_URL_TTL = 60 * 60; // 1 hour

// Batch-signs private storage paths; returns a path → URL map (missing paths are skipped).
export async function signPaths(supabase: SupabaseClient, bucket: string, paths: (string | null)[]) {
  const unique = [...new Set(paths.filter((p): p is string => !!p))];
  if (unique.length === 0) return new Map<string, string>();

  const { data, error } = await supabase.storage.from(bucket).createSignedUrls(unique, SIGNED_URL_TTL);
  if (error) throw error;
  return new Map(data.filter((d) => d.signedUrl && d.path).map((d) => [d.path!, d.signedUrl]));
}
