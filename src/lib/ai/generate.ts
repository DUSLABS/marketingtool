import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

// All copy generation goes through here. Claude Opus 5 with structured outputs; on a safety
// decline the API re-runs the request on Anthropic's recommended fallback model server-side.

const MODEL = "claude-opus-5";
const client = new Anthropic();

export type ProductContext = {
  name: string;
  description: string;
  facts: string;
  voice: string;
  avoid: string;
};

export type CampaignContext = {
  language: string;
  contentPrompt: string;
  contentSlideCount: number;
  contentFormat: "numbered" | "steps" | "plain";
  contentLength: "short" | "medium" | "long";
  tone: "plain" | "punchy" | "expert" | "warm";
};

export const LENGTH_WORDS = {
  short: [5, 7],
  medium: [10, 12],
  long: [15, 20],
} as const satisfies Record<CampaignContext["contentLength"], readonly [number, number]>;

const LANGUAGES: Record<string, string> = { en: "English", de: "German" };

const SYSTEM = `You write copy for TikTok photo slideshows that promote apps. A slideshow is a hook slide, several content slides and an optional call-to-action slide. Text sits on top of a photo, so every slide must read in about two seconds.

How good slideshows work:
- The hook stops the scroll. It is specific, concrete and promises something the viewer has not heard a hundred times. Numbered hooks ("6 things…") work well when the content delivers exactly that many items.
- Content slides deliver on the hook's promise, one idea per slide, in plain spoken language. They give real value on their own; they are not an ad.
- The CTA puts the product in front of someone who just got value for free. It is short and low-pressure.

Rules that always apply:
- Only state product features that appear in the product facts. Never invent features, prices, numbers, statistics, studies or testimonials.
- No hashtags, no emojis and no quotation marks around slide text unless the campaign explicitly asks for them.
- Avoid generic AI phrasing ("unlock", "elevate", "game-changer", "in today's fast-paced world", "let's dive in").
- Follow the brand voice and never use anything on the avoid list.
- Write in the requested language, the way a native speaker would say it on TikTok.`;

function productBlock(p: ProductContext | null) {
  if (!p) return "<product>No product details provided. Do not mention product features.</product>";
  return `<product>
Name: ${p.name}
What it is: ${p.description || "(not provided)"}
Facts & features (the only claims you may make):
${p.facts || "(none provided: do not claim any features)"}
Brand voice: ${p.voice || "(not specified)"}
Avoid: ${p.avoid || "(nothing specified)"}
</product>`;
}

function campaignBlock(c: CampaignContext) {
  const [min, max] = LENGTH_WORDS[c.contentLength];
  return `<campaign>
Language: ${LANGUAGES[c.language] ?? c.language}
What the posts are about: ${c.contentPrompt || "(not specified)"}
Content slides per post: ${c.contentSlideCount}
Content format: ${c.contentFormat}
Words per content slide: ${min}-${max}
Tone: ${c.tone}
</campaign>`;
}

async function parse<T extends z.ZodType>(schema: T, prompt: string, maxTokens = 4000): Promise<z.infer<T>> {
  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: maxTokens,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: betaZodOutputFormat(schema) },
    system: SYSTEM,
    messages: [{ role: "user", content: prompt }],
  });

  if (response.stop_reason === "refusal") throw new Error("The AI declined this request. Try rephrasing the prompt.");
  if (response.stop_reason === "max_tokens") throw new Error("The AI response was cut off. Try again.");
  if (!response.parsed_output) throw new Error("The AI returned an unexpected format. Try again.");
  return response.parsed_output;
}

const HOOK_STYLES = ["listicle", "pov", "contrarian", "question", "story", "secret", "mistake"] as const;

export async function generateHooks(input: {
  product: ProductContext | null;
  campaign: CampaignContext;
  existing: string[];
  count: number;
}) {
  const { hooks } = await parse(
    z.object({
      hooks: z.array(z.object({ text: z.string(), style: z.enum(HOOK_STYLES) })),
    }),
    `${productBlock(input.product)}

${campaignBlock(input.campaign)}

<existing_hooks>
${input.existing.join("\n") || "(none yet)"}
</existing_hooks>

Write ${input.count} new hook slide texts for this campaign. Mix different angles and label each with its style. Keep each under 12 words. ${
      input.campaign.contentFormat === "numbered"
        ? `Numbered hooks must promise exactly ${input.campaign.contentSlideCount} items, because that is how many content slides follow.`
        : ""
    } Do not repeat or lightly reword the existing hooks.`,
  );
  return hooks;
}

export async function generateCtas(input: { product: ProductContext | null; campaign: CampaignContext; existing: string[]; count: number }) {
  const { ctas } = await parse(
    z.object({ ctas: z.array(z.string()) }),
    `${productBlock(input.product)}

${campaignBlock(input.campaign)}

<existing_ctas>
${input.existing.join("\n") || "(none yet)"}
</existing_ctas>

Write ${input.count} call-to-action slide texts for the final slide. Each names the product, stays under 10 words and feels like a natural next step rather than an ad. Vary between soft and direct. Do not repeat the existing ones.`,
  );
  return ctas;
}

export async function generateContentSlides(input: {
  product: ProductContext | null;
  campaign: CampaignContext;
  hook: string;
  research?: string;
}) {
  const { campaign } = input;
  const [min, max] = LENGTH_WORDS[campaign.contentLength];
  const format = {
    numbered: 'Start each slide with its number and a period ("1. ", "2. " …).',
    steps: 'Each slide is one step in order; start each with "Step N: ".',
    plain: "No numbering; each slide is a single sentence or two short ones.",
  }[campaign.contentFormat];

  // One named field per slide: structured outputs then guarantees exactly N slides (a plain
  // array can't be length-constrained and the model sometimes adds an extra item).
  const slideKeys = Array.from({ length: campaign.contentSlideCount }, (_, i) => `slide_${i + 1}`);
  const output = await parse(
    z.object({
      ...Object.fromEntries(slideKeys.map((k) => [k, z.string()])),
      caption: z.string(),
    }) as z.ZodType<Record<string, string>>,
    `${productBlock(input.product)}

${campaignBlock(campaign)}
${input.research ? `\n<research>\n${input.research}\n</research>\nYou may use facts from the research above, including numbers, but only where they appear there.\n` : ""}
<hook>${input.hook}</hook>

Write the ${campaign.contentSlideCount} content slides (slide_1 … slide_${campaign.contentSlideCount}) that follow this hook and deliver exactly what it promises. ${format} Each slide has ${min}-${max} words. Content slides give value on their own; mention the product at most once, and only if it fits naturally.

Also write the TikTok caption for this post: one or two short sentences that make people swipe through, followed by 3-5 relevant hashtags. Emojis are fine in the caption only.`,
  );

  return { slides: slideKeys.map((k) => output[k].trim()), caption: output.caption.trim() };
}

export async function optimizeContentPrompt(input: { product: ProductContext | null; prompt: string; language: string }) {
  const { prompt } = await parse(
    z.object({ prompt: z.string() }),
    `${productBlock(input.product)}

<draft_prompt>
${input.prompt || "(empty)"}
</draft_prompt>

This draft describes what the content slides of a TikTok slideshow campaign should be about. Rewrite it into a clear, specific brief of 2-4 sentences: the topic and angle, what makes a slide good (concrete, surprising, useful), and any constraints. Keep the author's intent and write it in ${LANGUAGES[input.language] ?? input.language}.`,
    1500,
  );
  return prompt;
}

// Optional research step: web search results can't be combined with structured outputs in one
// call, so we gather notes first and pass them into content generation as plain text.
export async function researchTopic(input: { topic: string; hook: string; language: string }) {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    output_config: { effort: "medium" },
    tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 3 }],
    messages: [
      {
        role: "user",
        content: `Research facts for a TikTok slideshow.
Topic: ${input.topic}
Hook: ${input.hook}

Search the web and return 5-8 short, verifiable facts (with the number where there is one) that would make good slides for this hook. Plain bullet points with the source site in brackets. No introduction.`,
      },
    ],
  });
  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}
