import { PageHeader } from "@/components/app/page-header";
import { getWorkspace } from "@/lib/workspace";
import { signPaths } from "@/lib/storage";
import type { ImageCrop } from "@/lib/slides/types";
import { LibraryView, type LibraryAsset, type LibrarySummary } from "./library-view";

export const metadata = { title: "Library" };

type AssetRow = {
  id: string;
  thumb_path: string | null;
  width: number | null;
  height: number | null;
  favorite: boolean;
  locked: boolean;
  crop: ImageCrop | null;
};

const ASSET_COLUMNS = "id, thumb_path, width, height, favorite, locked, crop";

export default async function LibraryPage({ searchParams }: PageProps<"/library">) {
  const { l } = await searchParams;
  const { supabase, workspaceId } = await getWorkspace();

  const [{ data: libraryRows, error: libError }, { count: totalCount }] = await Promise.all([
    supabase.from("libraries").select("id, name, library_assets(count)").order("created_at"),
    supabase.from("assets").select("id", { count: "exact", head: true }),
  ]);
  if (libError) throw libError;

  const libraries: LibrarySummary[] = libraryRows.map((row) => ({
    id: row.id,
    name: row.name,
    count: (row.library_assets as unknown as { count: number }[])[0]?.count ?? 0,
  }));
  const selected = libraries.find((lib) => lib.id === l) ?? null;

  let rows: AssetRow[];
  if (selected) {
    const { data, error } = await supabase
      .from("library_assets")
      .select(`added_at, asset:assets(${ASSET_COLUMNS})`)
      .eq("library_id", selected.id)
      .order("added_at", { ascending: false });
    if (error) throw error;
    rows = data.map((r) => r.asset as unknown as AssetRow).filter(Boolean);
  } else {
    const { data, error } = await supabase
      .from("assets")
      .select(ASSET_COLUMNS)
      .order("created_at", { ascending: false });
    if (error) throw error;
    rows = data;
  }

  const urls = await signPaths(supabase, "assets", rows.map((r) => r.thumb_path));
  const assets: LibraryAsset[] = rows.map((r) => ({
    id: r.id,
    thumbUrl: r.thumb_path ? (urls.get(r.thumb_path) ?? null) : null,
    width: r.width,
    height: r.height,
    favorite: r.favorite,
    locked: r.locked,
    crop: r.crop,
  }));

  return (
    <>
      <PageHeader
        title="Library"
        description="Images campaigns rotate through. Build one library per slide type: hooks, content, CTA."
      />
      <LibraryView
        workspaceId={workspaceId}
        libraries={libraries}
        selected={selected}
        assets={assets}
        totalCount={totalCount ?? 0}
      />
    </>
  );
}
