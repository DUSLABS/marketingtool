import { notFound } from "next/navigation";
import { getWorkspace } from "@/lib/workspace";
import { signPaths } from "@/lib/storage";
import { PostsView, type PostSummary } from "./posts-view";

export const metadata = { title: "Posts" };
// Generating a post (AI + rendering) runs inside this route's server action.
export const maxDuration = 300;

export default async function CampaignPostsPage({ params }: PageProps<"/campaigns/[id]/posts">) {
  const { id } = await params;
  const { supabase } = await getWorkspace();

  const { data: campaign } = await supabase.from("campaigns").select("id, name, tiktok_account_id").eq("id", id).maybeSingle();
  if (!campaign) notFound();

  const { data: rows, error } = await supabase
    .from("posts")
    .select("id, status, caption, error, created_at, scheduled_for, tiktok_publish_id, post_slides(id, position, kind, text, rendered_path)")
    .eq("campaign_id", id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;

  type SlideRow = { id: string; position: number; kind: string; text: string; rendered_path: string | null };
  const allPaths = rows.flatMap((p) => (p.post_slides as SlideRow[]).map((s) => s.rendered_path));
  const urls = await signPaths(supabase, "renders", allPaths);

  const posts: PostSummary[] = rows.map((p) => ({
    id: p.id,
    status: p.status,
    caption: p.caption ?? "",
    error: p.error,
    createdAt: p.created_at,
    scheduledFor: p.scheduled_for,
    sentToTikTok: !!p.tiktok_publish_id,
    slides: (p.post_slides as SlideRow[])
      .sort((a, b) => a.position - b.position)
      .map((s) => ({ id: s.id, kind: s.kind, text: s.text, url: s.rendered_path ? (urls.get(s.rendered_path) ?? null) : null })),
  }));

  return <PostsView campaign={{ id: campaign.id, name: campaign.name, hasAccount: !!campaign.tiktok_account_id }} posts={posts} />;
}
