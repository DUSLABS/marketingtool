"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Anthropic from "@anthropic-ai/sdk";
import { getWorkspace } from "@/lib/workspace";
import {
  generateContentSlides,
  generateCtas,
  generateHooks,
  optimizeContentPrompt,
  researchTopic,
  type CampaignContext,
  type ProductContext,
} from "@/lib/ai/generate";
import { withDefaults, type CampaignLayout } from "@/lib/slides/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAccessToken } from "@/lib/tiktok/accounts";
import { queryCreatorInfo } from "@/lib/tiktok/api";
import { publishErrorMessage } from "@/lib/engine/publish-post";

// ─── Campaign CRUD ───────────────────────────────────────────────────────────

export async function createCampaign(formData: FormData) {
  const { supabase, workspaceId } = await getWorkspace();
  const { data, error } = await supabase
    .from("campaigns")
    .insert({
      workspace_id: workspaceId,
      name: String(formData.get("name") ?? "").trim() || "Untitled campaign",
      product_id: String(formData.get("product_id") ?? "") || null,
    })
    .select("id")
    .single();
  if (error) throw error;
  redirect(`/campaigns/${data.id}`);
}

export type CampaignPatch = Partial<{
  name: string;
  product_id: string | null;
  language: string;
  content_prompt: string;
  content_slide_count: number;
  content_format: CampaignContext["contentFormat"];
  content_length: CampaignContext["contentLength"];
  tone: CampaignContext["tone"];
  web_research: boolean;
  cta_enabled: boolean;
  layout: CampaignLayout;
  tiktok_account_id: string | null;
  publish_mode: "draft" | "direct";
  privacy_level: string | null;
  allow_comments: boolean;
  disclose_commercial: boolean;
  ai_label: boolean;
  timezone: string;
  max_posts_per_day: number;
}>;

const PATCHABLE = new Set<keyof CampaignPatch>([
  "name",
  "product_id",
  "language",
  "content_prompt",
  "content_slide_count",
  "content_format",
  "content_length",
  "tone",
  "web_research",
  "cta_enabled",
  "layout",
  "tiktok_account_id",
  "publish_mode",
  "privacy_level",
  "allow_comments",
  "disclose_commercial",
  "ai_label",
  "timezone",
  "max_posts_per_day",
]);

export async function updateCampaign(id: string, patch: CampaignPatch) {
  const { supabase } = await getWorkspace();
  const clean = Object.fromEntries(Object.entries(patch).filter(([k]) => PATCHABLE.has(k as keyof CampaignPatch)));
  if (Object.keys(clean).length === 0) return;
  const { error } = await supabase
    .from("campaigns")
    .update({ ...clean, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteCampaign(id: string) {
  const { supabase } = await getWorkspace();
  const { error } = await supabase.from("campaigns").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/campaigns");
  redirect("/campaigns");
}

// ─── Hooks & CTAs ────────────────────────────────────────────────────────────

type Table = "campaign_hooks" | "campaign_ctas";
export type CopyItem = { id: string; text: string; enabled: boolean; source: "manual" | "ai"; style?: string | null };

async function insertItems(table: Table, campaignId: string, rows: { text: string; source: "manual" | "ai"; style?: string }[]) {
  const { supabase } = await getWorkspace();
  const { data, error } = await supabase
    .from(table)
    .insert(rows.map((r) => ({ campaign_id: campaignId, ...r })))
    .select("id, text, enabled, source" + (table === "campaign_hooks" ? ", style" : ""));
  if (error) throw error;
  return data as unknown as CopyItem[];
}

export async function addCopyItem(kind: "hook" | "cta", campaignId: string, text: string) {
  const table: Table = kind === "hook" ? "campaign_hooks" : "campaign_ctas";
  const [item] = await insertItems(table, campaignId, [{ text: text.trim(), source: "manual" }]);
  return item;
}

export async function updateCopyItem(kind: "hook" | "cta", id: string, patch: { text?: string; enabled?: boolean }) {
  const { supabase } = await getWorkspace();
  const { error } = await supabase
    .from(kind === "hook" ? "campaign_hooks" : "campaign_ctas")
    .update(patch)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteCopyItem(kind: "hook" | "cta", id: string) {
  const { supabase } = await getWorkspace();
  const { error } = await supabase.from(kind === "hook" ? "campaign_hooks" : "campaign_ctas").delete().eq("id", id);
  if (error) throw error;
}

// ─── AI ──────────────────────────────────────────────────────────────────────

export type AiResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function loadContext(campaignId: string) {
  const { supabase } = await getWorkspace();
  const { data: c, error } = await supabase
    .from("campaigns")
    .select(
      "language, content_prompt, content_slide_count, content_format, content_length, tone, web_research, product:products(name, description, facts, voice, avoid)",
    )
    .eq("id", campaignId)
    .single();
  if (error) throw error;

  const campaign: CampaignContext = {
    language: c.language,
    contentPrompt: c.content_prompt,
    contentSlideCount: c.content_slide_count,
    contentFormat: c.content_format,
    contentLength: c.content_length,
    tone: c.tone,
  };
  return { supabase, campaign, product: (c.product as unknown as ProductContext | null) ?? null, webResearch: c.web_research as boolean };
}

// Wraps AI calls so the client gets a readable message instead of a masked server error.
async function ai<T>(fn: () => Promise<T>): Promise<AiResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    console.error(e);
    if (e instanceof Anthropic.RateLimitError) return { ok: false, error: "AI rate limit reached. Wait a moment and try again." };
    if (e instanceof Anthropic.APIError && /credit balance/i.test(e.message)) {
      return { ok: false, error: "The Anthropic account has no credits left. Top up under Plans & Billing." };
    }
    if (e instanceof Anthropic.APIError) return { ok: false, error: `AI request failed (${e.status}).` };
    return { ok: false, error: e instanceof Error ? e.message : "AI request failed." };
  }
}

export async function aiGenerateHooks(campaignId: string, count = 8) {
  return ai(async () => {
    const { supabase, campaign, product } = await loadContext(campaignId);
    const { data: existing } = await supabase.from("campaign_hooks").select("text").eq("campaign_id", campaignId);
    const hooks = await generateHooks({ product, campaign, existing: (existing ?? []).map((h) => h.text), count });
    return insertItems(
      "campaign_hooks",
      campaignId,
      hooks.map((h) => ({ text: h.text, style: h.style, source: "ai" as const })),
    );
  });
}

export async function aiGenerateCtas(campaignId: string, count = 5) {
  return ai(async () => {
    const { supabase, campaign, product } = await loadContext(campaignId);
    const { data: existing } = await supabase.from("campaign_ctas").select("text").eq("campaign_id", campaignId);
    const ctas = await generateCtas({ product, campaign, existing: (existing ?? []).map((c) => c.text), count });
    return insertItems("campaign_ctas", campaignId, ctas.map((text) => ({ text, source: "ai" as const })));
  });
}

export async function aiOptimizePrompt(campaignId: string) {
  return ai(async () => {
    const { campaign, product } = await loadContext(campaignId);
    return optimizeContentPrompt({ product, prompt: campaign.contentPrompt, language: campaign.language });
  });
}

export async function aiPreviewContent(campaignId: string, hook: string) {
  return ai(async () => {
    const { campaign, product, webResearch } = await loadContext(campaignId);
    const research = webResearch
      ? await researchTopic({ topic: campaign.contentPrompt, hook, language: campaign.language })
      : undefined;
    const { slides } = await generateContentSlides({ product, campaign, hook, research });
    return slides;
  });
}

// ─── Publishing & schedule ───────────────────────────────────────────────────

export type Slot = { id: string; time_of_day: string; weekdays: number[] };

export async function addScheduleSlot(campaignId: string, time: string): Promise<Slot> {
  const { supabase } = await getWorkspace();
  const { data, error } = await supabase
    .from("schedule_slots")
    .insert({ campaign_id: campaignId, time_of_day: time })
    .select("id, time_of_day, weekdays")
    .single();
  if (error) throw error;
  return data;
}

export async function updateScheduleSlot(id: string, patch: { time_of_day?: string; weekdays?: number[] }) {
  const { supabase } = await getWorkspace();
  const { error } = await supabase.from("schedule_slots").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteScheduleSlot(id: string) {
  const { supabase } = await getWorkspace();
  const { error } = await supabase.from("schedule_slots").delete().eq("id", id);
  if (error) throw error;
}

/** Privacy options and account details TikTok currently allows for direct posts. */
export async function getCreatorOptions(accountId: string): Promise<AiResult<{ privacyLevels: string[]; commentsDisabled: boolean }>> {
  const { workspaceId } = await getWorkspace();
  const db = createAdminClient();
  const { data: account } = await db.from("tiktok_accounts").select("id").eq("id", accountId).eq("workspace_id", workspaceId).single();
  if (!account) return { ok: false, error: "Account not found" };
  try {
    const info = await queryCreatorInfo(await getAccessToken(db, accountId));
    return { ok: true, data: { privacyLevels: info.privacy_level_options, commentsDisabled: info.comment_disabled } };
  } catch (e) {
    return { ok: false, error: publishErrorMessage(e) };
  }
}

/** Starts or pauses a campaign. Starting checks everything the scheduler needs. */
export async function setCampaignStatus(campaignId: string, status: "active" | "paused"): Promise<AiResult<null>> {
  const { supabase } = await getWorkspace();
  if (status === "active") {
    const [{ data: c }, { count: hooks }, { count: slots }] = await Promise.all([
      supabase
        .from("campaigns")
        .select("layout, cta_enabled, content_prompt, publish_mode, privacy_level, account:tiktok_accounts(status)")
        .eq("id", campaignId)
        .single(),
      supabase.from("campaign_hooks").select("id", { count: "exact", head: true }).eq("campaign_id", campaignId).eq("enabled", true),
      supabase.from("schedule_slots").select("id", { count: "exact", head: true }).eq("campaign_id", campaignId),
    ]);
    if (!c) return { ok: false, error: "Campaign not found" };
    const layout = withDefaults(c.layout);
    const account = c.account as unknown as { status: string } | null;
    const problems = [
      !account && "choose a TikTok account",
      account && account.status !== "active" && "reconnect the TikTok account",
      c.publish_mode === "direct" && !c.privacy_level && "choose who can see the posts",
      !slots && "add at least one posting time",
      !hooks && "add at least one active hook",
      !c.content_prompt.trim() && "describe what the posts are about",
      !layout.hook.libraryId && "choose a hook image library",
      !layout.content.libraryId && "choose a content image library",
      c.cta_enabled && !layout.cta.libraryId && "choose a CTA image library",
    ].filter(Boolean);
    if (problems.length) return { ok: false, error: `Before starting: ${problems.join(", ")}.` };
  }
  const { error } = await supabase.from("campaigns").update({ status }).eq("id", campaignId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/campaigns");
  return { ok: true, data: null };
}
