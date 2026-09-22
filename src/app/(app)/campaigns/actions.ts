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
import type { CampaignLayout } from "@/lib/slides/types";

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
