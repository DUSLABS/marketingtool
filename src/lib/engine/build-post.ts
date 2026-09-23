import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateContentSlides, matchImages, researchTopic, type CampaignContext, type ProductContext } from "@/lib/ai/generate";
import { ctaPosition, withDefaults, type CampaignLayout, type SlideKind, type SlideLayout } from "@/lib/slides/types";

// Builds one post from a campaign's rules: rotate hook/CTA, write fresh content, pick images.
// Runs with the admin client (also used by the scheduler), so every query is scoped to the workspace.

export class CampaignNotReadyError extends Error {}

type Candidate = { id: string; favorite: boolean; description: string | null };
type PlannedSlide = { kind: SlideKind; text: string; layout: Omit<SlideLayout, "libraryId">; libraryId: string };

const HISTORY_POSTS = 200;
/** How many of the least recently used images per library the AI may choose from (keeps variety). */
const MATCH_POOL = 12;

function pickLeastUsed<T extends { id: string }>(items: T[], usage: Map<string, number>): T {
  const min = Math.min(...items.map((i) => usage.get(i.id) ?? 0));
  const pool = items.filter((i) => (usage.get(i.id) ?? 0) === min);
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Least-recently-used with some randomness: never-used images first, then oldest use.
 * Picks from the stalest third (at least 3), favorites weighted double.
 */
function pickImage(candidates: Candidate[], lastUsed: Map<string, number>, taken: Set<string>, previous: string | null): string {
  const free = candidates.filter((c) => !taken.has(c.id));
  // Library smaller than the post: allow repeats, but never the same image on consecutive slides.
  const notPrevious = candidates.filter((c) => c.id !== previous);
  const source = free.length > 0 ? free : notPrevious.length > 0 ? notPrevious : candidates;
  const sorted = [...source].sort((a, b) => (lastUsed.get(a.id) ?? 0) - (lastUsed.get(b.id) ?? 0));
  const pool = sorted.slice(0, Math.max(3, Math.ceil(sorted.length / 3)));
  const weighted = pool.flatMap((c) => (c.favorite ? [c, c] : [c]));
  return weighted[Math.floor(Math.random() * weighted.length)].id;
}

export async function buildPost(
  db: SupabaseClient,
  { workspaceId, campaignId, status = "preview", scheduledFor = null }: {
    workspaceId: string;
    campaignId: string;
    status?: "preview" | "queued";
    scheduledFor?: string | null;
  },
): Promise<string> {
  const { data: c, error } = await db
    .from("campaigns")
    .select("*, product:products(name, description, facts, voice, avoid)")
    .eq("id", campaignId)
    .eq("workspace_id", workspaceId)
    .single();
  if (error) throw error;
  const layout: CampaignLayout = withDefaults(c.layout);

  const [{ data: hooks }, { data: ctas }, { data: history }] = await Promise.all([
    db.from("campaign_hooks").select("id, text").eq("campaign_id", campaignId).eq("enabled", true),
    db.from("campaign_ctas").select("id, text").eq("campaign_id", campaignId).eq("enabled", true),
    db
      .from("posts")
      .select("hook_id, cta_id, created_at, post_slides(asset_id)")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: false })
      .limit(HISTORY_POSTS),
  ]);

  if (!hooks?.length) throw new CampaignNotReadyError("Add at least one active hook.");
  const kinds: SlideKind[] = ["hook", "content", ...(c.cta_enabled ? (["cta"] as const) : [])];
  for (const kind of kinds) {
    if (!layout[kind].libraryId) throw new CampaignNotReadyError(`Choose an image library for the ${kind} slides.`);
  }

  // ─── Usage history ───────────────────────────────────────────────────────
  const hookUsage = new Map<string, number>();
  const ctaUsage = new Map<string, number>();
  const assetLastUsed = new Map<string, number>();
  for (const p of history ?? []) {
    if (p.hook_id) hookUsage.set(p.hook_id, (hookUsage.get(p.hook_id) ?? 0) + 1);
    if (p.cta_id) ctaUsage.set(p.cta_id, (ctaUsage.get(p.cta_id) ?? 0) + 1);
    const t = new Date(p.created_at).getTime();
    for (const s of p.post_slides as { asset_id: string | null }[]) {
      if (s.asset_id && t > (assetLastUsed.get(s.asset_id) ?? 0)) assetLastUsed.set(s.asset_id, t);
    }
  }

  const hook = pickLeastUsed(hooks, hookUsage);
  const cta = c.cta_enabled && ctas?.length ? pickLeastUsed(ctas, ctaUsage) : null;

  // ─── Content ─────────────────────────────────────────────────────────────
  const campaign: CampaignContext = {
    language: c.language,
    contentPrompt: c.content_prompt,
    contentSlideCount: c.content_slide_count,
    contentFormat: c.content_format,
    contentLength: c.content_length,
    tone: c.tone,
    productMention: c.product_mention ?? "cta",
    styleExamples: c.style_examples ?? "",
  };
  const product = (c.product as ProductContext | null) ?? null;
  const research = c.web_research
    ? await researchTopic({ topic: c.content_prompt, hook: hook.text, language: c.language })
    : undefined;
  const { slides: contentTexts, caption } = await generateContentSlides({ product, campaign, hook: hook.text, research });

  const snapshot = (kind: SlideKind) => {
    const { libraryId, ...rest } = layout[kind];
    return { libraryId: libraryId!, layout: rest };
  };
  const planned: PlannedSlide[] = [
    { kind: "hook", text: hook.text, ...snapshot("hook") },
    ...contentTexts.map((text) => ({ kind: "content" as const, text, ...snapshot("content") })),
  ];
  if (c.cta_enabled) {
    planned.splice(ctaPosition(layout.cta.placement, contentTexts.length), 0, { kind: "cta", text: cta?.text ?? "", ...snapshot("cta") });
  }

  // ─── Images ──────────────────────────────────────────────────────────────
  const libraryIds = [...new Set(planned.map((s) => s.libraryId))];
  const { data: libraryAssets, error: laError } = await db
    .from("library_assets")
    .select("library_id, asset:assets!inner(id, favorite, description, locked, workspace_id)")
    .in("library_id", libraryIds)
    .eq("asset.workspace_id", workspaceId)
    .eq("asset.locked", false);
  if (laError) throw laError;

  const candidatesByLibrary = new Map<string, Candidate[]>();
  for (const row of libraryAssets ?? []) {
    const a = row.asset as unknown as Candidate;
    candidatesByLibrary.set(row.library_id, [...(candidatesByLibrary.get(row.library_id) ?? []), a]);
  }

  for (const s of planned) {
    if (!candidatesByLibrary.get(s.libraryId)?.length) {
      throw new CampaignNotReadyError(`The ${s.kind} library has no usable (unlocked) images.`);
    }
  }

  // AI matching: the least recently used, described images of each library are offered per
  // slide and the AI picks the best fit. Slides it can't match fall back to rotation.
  let matched: (string | null)[] = planned.map(() => null);
  if (c.image_matching !== false) {
    const pools = planned.map((s) =>
      [...candidatesByLibrary.get(s.libraryId)!]
        .filter((a) => a.description)
        .sort((a, b) => (assetLastUsed.get(a.id) ?? 0) - (assetLastUsed.get(b.id) ?? 0))
        .slice(0, MATCH_POOL),
    );
    if (pools.every((p) => p.length > 0)) {
      try {
        matched = await matchImages(
          planned.map((s, i) => ({
            kind: s.kind,
            text: s.text,
            candidates: pools[i].map((a) => ({ id: a.id, description: a.description!, favorite: a.favorite })),
          })),
        );
      } catch (e) {
        console.error("Image matching failed, falling back to rotation", e);
      }
    }
  }

  const taken = new Set<string>(matched.filter((id): id is string => !!id));
  const assetIds: string[] = [];
  planned.forEach((s, i) => {
    const id = matched[i] ?? pickImage(candidatesByLibrary.get(s.libraryId)!, assetLastUsed, taken, assetIds.at(-1) ?? null);
    taken.add(id);
    assetIds.push(id);
  });

  // ─── Persist ─────────────────────────────────────────────────────────────
  const combinationHash = createHash("sha256")
    .update([hook.id, cta?.id ?? "", ...assetIds].join("|"))
    .digest("hex");

  const { data: post, error: postError } = await db
    .from("posts")
    .insert({
      workspace_id: workspaceId,
      campaign_id: campaignId,
      tiktok_account_id: c.tiktok_account_id,
      status,
      scheduled_for: scheduledFor,
      hook_id: hook.id,
      cta_id: cta?.id ?? null,
      caption,
      combination_hash: combinationHash,
    })
    .select("id")
    .single();
  if (postError) throw postError;

  const { error: slidesError } = await db.from("post_slides").insert(
    planned.map((s, position) => ({
      post_id: post.id,
      position,
      kind: s.kind,
      asset_id: assetIds[position],
      text: s.text,
      layout: s.layout,
    })),
  );
  if (slidesError) {
    await db.from("posts").delete().eq("id", post.id);
    throw slidesError;
  }

  return post.id as string;
}
