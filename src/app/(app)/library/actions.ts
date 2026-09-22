"use server";

import { revalidatePath } from "next/cache";
import { getWorkspace } from "@/lib/workspace";

export async function createLibrary(name: string) {
  const { supabase, workspaceId } = await getWorkspace();
  const { data, error } = await supabase
    .from("libraries")
    .insert({ workspace_id: workspaceId, name: name.trim() || "Untitled library" })
    .select("id")
    .single();
  if (error) throw error;
  revalidatePath("/library");
  return data.id as string;
}

export async function renameLibrary(id: string, name: string) {
  const { supabase } = await getWorkspace();
  const { error } = await supabase.from("libraries").update({ name: name.trim() }).eq("id", id);
  if (error) throw error;
  revalidatePath("/library");
}

// Deleting a library keeps its images in the workspace; they stay visible under "All images".
export async function deleteLibrary(id: string) {
  const { supabase } = await getWorkspace();
  const { error } = await supabase.from("libraries").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/library");
}

// Returns sha256 → asset id for images already in the workspace, so re-uploads are skipped.
export async function findExistingAssets(hashes: string[]) {
  const { supabase, workspaceId } = await getWorkspace();
  if (hashes.length === 0) return {};
  const { data, error } = await supabase
    .from("assets")
    .select("id, sha256")
    .eq("workspace_id", workspaceId)
    .in("sha256", hashes);
  if (error) throw error;
  return Object.fromEntries(data.map((a) => [a.sha256 as string, a.id as string]));
}

export type NewAsset = {
  id: string;
  storagePath: string;
  thumbPath: string;
  width: number;
  height: number;
  sha256: string;
};

// Registers images the browser already uploaded to storage, and links them (plus any
// duplicates found earlier) to the current library.
export async function registerAssets(assets: NewAsset[], existingIds: string[], libraryId: string | null) {
  const { supabase, workspaceId } = await getWorkspace();

  if (assets.length > 0) {
    const { error } = await supabase.from("assets").insert(
      assets.map((a) => ({
        id: a.id,
        workspace_id: workspaceId,
        storage_path: a.storagePath,
        thumb_path: a.thumbPath,
        width: a.width,
        height: a.height,
        sha256: a.sha256,
      })),
    );
    if (error) throw error;
  }

  if (libraryId) {
    await linkAssets([...assets.map((a) => a.id), ...existingIds], libraryId);
  }
  revalidatePath("/library");
}

export async function linkAssets(assetIds: string[], libraryId: string) {
  const { supabase } = await getWorkspace();
  if (assetIds.length === 0) return;
  const { error } = await supabase
    .from("library_assets")
    .upsert(
      assetIds.map((asset_id) => ({ asset_id, library_id: libraryId })),
      { onConflict: "library_id,asset_id", ignoreDuplicates: true },
    );
  if (error) throw error;
  revalidatePath("/library");
}

export async function unlinkAssets(assetIds: string[], libraryId: string) {
  const { supabase } = await getWorkspace();
  const { error } = await supabase
    .from("library_assets")
    .delete()
    .eq("library_id", libraryId)
    .in("asset_id", assetIds);
  if (error) throw error;
  revalidatePath("/library");
}

export async function setAssetFlags(id: string, flags: { favorite?: boolean; locked?: boolean }) {
  const { supabase } = await getWorkspace();
  const { error } = await supabase.from("assets").update(flags).eq("id", id);
  if (error) throw error;
  revalidatePath("/library");
}

export async function deleteAssets(ids: string[]) {
  const { supabase } = await getWorkspace();
  const { data, error } = await supabase.from("assets").select("storage_path, thumb_path").in("id", ids);
  if (error) throw error;

  const paths = data.flatMap((a) => [a.storage_path, a.thumb_path]).filter(Boolean) as string[];
  if (paths.length > 0) {
    const { error: storageError } = await supabase.storage.from("assets").remove(paths);
    if (storageError) throw storageError;
  }

  const { error: deleteError } = await supabase.from("assets").delete().in("id", ids);
  if (deleteError) throw deleteError;
  revalidatePath("/library");
}
