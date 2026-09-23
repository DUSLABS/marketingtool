import { notFound } from "next/navigation";
import { getWorkspace } from "@/lib/workspace";
import { signPaths } from "@/lib/storage";
import { withDefaults, type CampaignLayout, type ImageCrop } from "@/lib/slides/types";
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

  const [hooks, ctas, products, libraries, accounts, slots, posts] = await Promise.all([
    supabase.from("campaign_hooks").select("id, text, enabled, source, style").eq("campaign_id", id).order("created_at"),
    supabase.from("campaign_ctas").select("id, text, enabled, source").eq("campaign_id", id).order("created_at"),
    supabase.from("products").select("id, name").order("created_at"),
    supabase
      .from("libraries")
      .select(`id, name, library_assets(asset:assets(thumb_path, crop, locked))`)
      .order("created_at")
      .limit(SAMPLES_PER_LIBRARY, { foreignTable: "library_assets" }),
    supabase.from("tiktok_accounts").select("id, username, display_name, status").order("created_at"),
    supabase.from("schedule_slots").select("id, time_of_day, weekdays").eq("campaign_id", id).order("time_of_day"),
    supabase.from("posts").select("id", { count: "exact", head: true }).eq("campaign_id", id),
  ]);
  for (const r of [hooks, ctas, products, libraries, accounts, slots]) if (r.error) throw r.error;

  // Preview images: a sample of unlocked thumbnails per library.
  const libraryRows = (libraries.data ?? []).map((lib) => ({
    id: lib.id as string,
    name: lib.name as string,
    assets: (lib.library_assets as unknown as { asset: { thumb_path: string | null; crop: ImageCrop | null; locked: boolean } | null }[])
      .map((la) => la.asset)
      .filter((a) => a && !a.locked && a.thumb_path)
      .map((a) => ({ path: a!.thumb_path!, crop: a!.crop })),
  }));
  const urls = await signPaths(supabase, "assets", libraryRows.flatMap((l) => l.assets.map((a) => a.path)));
  const editorLibraries: EditorLibrary[] = libraryRows.map((l) => ({
    id: l.id,
    name: l.name,
    images: l.assets.filter((a) => urls.has(a.path)).map((a) => ({ url: urls.get(a.path)!, crop: a.crop })),
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
    product_mention: campaign.product_mention ?? "cta",
    style_examples: campaign.style_examples ?? "",
    image_matching: campaign.image_matching ?? true,
    layout: withDefaults(campaign.layout as Partial<CampaignLayout>),
    tiktok_account_id: campaign.tiktok_account_id,
    publish_mode: campaign.publish_mode,
    privacy_level: campaign.privacy_level,
    allow_comments: campaign.allow_comments,
    disclose_commercial: campaign.disclose_commercial,
    ai_label: campaign.ai_label,
    timezone: campaign.timezone,
    max_posts_per_day: campaign.max_posts_per_day,
  };

  return (
    <CampaignEditor
      campaign={editorCampaign}
      hooks={hooks.data as CopyItem[]}
      ctas={ctas.data as CopyItem[]}
      products={products.data ?? []}
      libraries={editorLibraries}
      accounts={(accounts.data ?? []).map((a) => ({
        id: a.id,
        name: a.username ? `@${a.username}` : (a.display_name ?? "TikTok account"),
        status: a.status,
      }))}
      slots={slots.data ?? []}
      postCount={posts.count ?? 0}
    />
  );
}
