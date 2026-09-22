import { notFound } from "next/navigation";
import { getWorkspace } from "@/lib/workspace";
import { signPaths } from "@/lib/storage";
import { withDefaults, type CampaignLayout } from "@/lib/slides/types";
import type { CopyItem } from "../actions";
import { CampaignEditor, type EditorCampaign, type EditorLibrary } from "./campaign-editor";

const SAMPLES_PER_LIBRARY = 24;
// Generating a post (AI + rendering) can run from this page too.
export const maxDuration = 300;

export default async function CampaignPage({ params }: PageProps<"/campaigns/[id]">) {
  const { id } = await params;
  const { supabase } = await getWorkspace();

  const { data: campaign } = await supabase.from("campaigns").select("*").eq("id", id).maybeSingle();
  if (!campaign) notFound();

  const [hooks, ctas, products, libraries] = await Promise.all([
    supabase.from("campaign_hooks").select("id, text, enabled, source, style").eq("campaign_id", id).order("created_at"),
    supabase.from("campaign_ctas").select("id, text, enabled, source").eq("campaign_id", id).order("created_at"),
    supabase.from("products").select("id, name").order("created_at"),
    supabase
      .from("libraries")
      .select(`id, name, library_assets(asset:assets(thumb_path, locked))`)
      .order("created_at")
      .limit(SAMPLES_PER_LIBRARY, { foreignTable: "library_assets" }),
  ]);
  for (const r of [hooks, ctas, products, libraries]) if (r.error) throw r.error;

  // Preview images: a sample of unlocked thumbnails per library.
  const libraryRows = (libraries.data ?? []).map((lib) => ({
    id: lib.id as string,
    name: lib.name as string,
    paths: (lib.library_assets as unknown as { asset: { thumb_path: string | null; locked: boolean } | null }[])
      .map((la) => la.asset)
      .filter((a) => a && !a.locked && a.thumb_path)
      .map((a) => a!.thumb_path!),
  }));
  const urls = await signPaths(supabase, "assets", libraryRows.flatMap((l) => l.paths));
  const editorLibraries: EditorLibrary[] = libraryRows.map((l) => ({
    id: l.id,
    name: l.name,
    images: l.paths.map((p) => urls.get(p)).filter((u): u is string => !!u),
  }));

  const editorCampaign: EditorCampaign = {
    id: campaign.id,
    name: campaign.name,
    status: campaign.status,
    product_id: campaign.product_id,
    language: campaign.language,
    content_prompt: campaign.content_prompt,
    content_slide_count: campaign.content_slide_count,
    content_format: campaign.content_format,
    content_length: campaign.content_length,
    tone: campaign.tone,
    web_research: campaign.web_research,
    cta_enabled: campaign.cta_enabled,
    layout: withDefaults(campaign.layout as Partial<CampaignLayout>),
  };

  return (
    <CampaignEditor
      campaign={editorCampaign}
      hooks={hooks.data as CopyItem[]}
      ctas={ctas.data as CopyItem[]}
      products={products.data ?? []}
      libraries={editorLibraries}
    />
  );
}
