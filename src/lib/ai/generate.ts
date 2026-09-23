import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { hookItemCount } from "@/lib/slides/hooks";

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
  /** "cta": the product only appears on the CTA slide; "last_slide": the last content slide ties the topic to it. */
  productMention?: "cta" | "last_slide";
  /** Slideshows the team likes, used as reference for tone and rhythm. */
  styleExamples?: string;
};

export const LENGTH_WORDS = {
  short: [5, 7],
  medium: [10, 12],
  long: [15, 20],
} as const satisfies Record<CampaignContext["contentLength"], readonly [number, number]>;

const LANGUAGES: Record<string, string> = { en: "English", de: "German" };

const TONES: Record<CampaignContext["tone"], string> = {
  plain: "plain and direct, like a friend telling you something useful",
  punchy: "punchy and a little cheeky, short sentences that land like punchlines",
  expert: "confident insider knowledge, like someone who has done this a hundred times",
  warm: "warm and emotional, but concrete, never cheesy",
};

const SYSTEM = `You write copy for TikTok photo slideshows that promote apps. A slideshow is a hook slide, several content slides and an optional call-to-action slide. Text sits on top of a photo, so every slide must read in about two seconds.

The one thing that matters: specificity. Generic slides get scrolled past; specific slides get saved and shared. The viewer should think "huh, I never thought of that" or "that is so true" on every slide.

What specific means:
- A concrete scene, object, number, name or moment instead of a category. Not "capture the emotional moments" but "the second your dad sees you in the dress, before he remembers to smile".
- Insider details only someone who has been there knows. Not "don't forget to eat" but "tell the caterer to box two plates for you. You will be starving at midnight."
- Something slightly surprising or counter-intuitive, or a truth people recognise but never say out loud.
- Actionable where the topic allows: the viewer could do it tomorrow.

Generic (never write like this) → specific (write like this):
- "Make memories that last forever" → "Hide a disposable camera under every chair at the ceremony"
- "The little moments matter most" → "The flower girl asleep on two chairs at 11pm"
- "Plan ahead for a stress-free day" → "Put your ring in your bra, not your bag. Bags get lost by 9pm"
- "Don't miss out on candid shots" → "Nobody photographs the kitchen crew. Ask them for a group photo at the end"

How good slideshows work:
- The hook stops the scroll with a specific promise. The content slides must deliver exactly that promise: if the hook promises photos, every slide is a photo moment; if it promises mistakes, every slide is a mistake.
- One idea per slide, in spoken language. Every slide can stand alone and still be interesting.
- The content gives real value for free; it is not an ad.
- The CTA is short and low-pressure.

Rules that always apply:
- Only state product features that appear in the product facts. Never invent features, prices, numbers, statistics, studies, testimonials or personal experiences ("we used", "my cousin", "our wedding") unless the brief explicitly asks for a first-person story.
- No hashtags, no emojis and no quotation marks in slide text. Apostrophes and normal punctuation are fine and must be correct ("mum's", "guests' photos").
- No filler or AI phrasing: "unlock", "elevate", "game-changer", "journey", "cherish", "treasure", "magical", "in today's world", "let's dive in", "trust me".
- No vague abstractions ("memories", "moments", "vibes") without a concrete picture attached.
- Follow the brand voice and never use anything on the avoid list.
- Write in the requested language like a native speaker on TikTok would say it, not like a translation.`;

function productBlock(p: ProductContext | null) {
  if (!p) return "<product>No product details provided. Do not mention product features.</product>";
  return `<product>
Name: ${p.name}
What it is: ${p.description || "(not provided)"}
Facts & features (the only claims you may make):
${p.facts || "(none provided: do not claim any specific features; describe it only as in 'What it is')"}
Brand voice: ${p.voice || "(not specified)"}
Avoid: ${p.avoid || "(nothing specified)"}
</product>`;
}

function campaignBlock(c: CampaignContext) {
  const [min, max] = LENGTH_WORDS[c.contentLength];
  return `<campaign>
Today: ${new Date().toISOString().slice(0, 10)} (use the current year for anything dated, e.g. hashtags)
Language: ${LANGUAGES[c.language] ?? c.language}
What the posts are about: ${c.contentPrompt || "(not specified)"}
Content slides per post: ${c.contentSlideCount}
Content format: ${c.contentFormat}
Words per content slide: ${min}-${max}
Tone: ${TONES[c.tone]}
</campaign>${
    c.styleExamples?.trim()
      ? `

<style_examples>
Slideshows the team likes. Match their tone, rhythm and level of specificity. Do not copy their content.
${c.styleExamples.trim()}
</style_examples>`
      : ""
  }`;
}

async function parse<T extends z.ZodType>(
  schema: T,
  prompt: string,
  { maxTokens = 4000, effort = "medium" }: { maxTokens?: number; effort?: "medium" | "high" } = {},
): Promise<z.infer<T>> {
  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: maxTokens,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort, format: betaZodOutputFormat(schema) },
    system: SYSTEM,
    messages: [{ role: "user", content: prompt }],
  });

  if (response.stop_reason === "refusal") throw new Error("The AI declined this request. Try rephrasing the prompt.");
  if (response.stop_reason === "max_tokens") throw new Error("The AI response was cut off. Try again.");
  if (!response.parsed_output) throw new Error("The AI returned an unexpected format. Try again.");
  return clean(response.parsed_output);
}

/** The model occasionally double-escapes non-ASCII characters ("\\u2014"); turn them back into text. */
function clean<T>(value: T): T {
  if (typeof value === "string") {
    return value.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16))) as T;
  }
  if (Array.isArray(value)) return value.map(clean) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, clean(v)])) as T;
  }
  return value;
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

Write ${input.count} new hook slide texts for this campaign. Mix different angles and label each with its style. Keep each under 12 words.
Every hook must make a specific promise the content slides can deliver with the brief above (a clear type of item: moments to photograph, mistakes, rules, secrets...). Avoid hooks that promise a personal story unless the brief asks for one. ${
      input.campaign.contentFormat === "numbered"
        ? `Numbered hooks must promise exactly ${input.campaign.contentSlideCount} items, because that is how many content slides follow.`
        : ""
    } Do not repeat or lightly reword the existing hooks.`,
    { effort: "high" },
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

Write ${input.count} call-to-action slide texts for the final slide. Each names the product, stays under 10 words and feels like a natural next step rather than an ad. Vary between soft and direct. Do not number them. Do not repeat the existing ones.`,
  );
  return ctas;
}

type ContentInput = {
  product: ProductContext | null;
  campaign: CampaignContext;
  hook: string;
  research?: string;
};

/**
 * Writes the content slides and caption for one post. The hook is the contract: a separate
 * review checks every slide against the hook's promise, and failing posts are rewritten once
 * with that feedback. Numbered hooks set the slide count ("6 ways…" → 6 slides).
 */
export async function generateContentSlides(input: ContentInput) {
  const campaign = { ...input.campaign, contentSlideCount: hookItemCount(input.hook) ?? input.campaign.contentSlideCount };
  const draft = await writeContent({ ...input, campaign });
  const productOnLastSlide = campaign.productMention === "last_slide" && input.product ? input.product.name : null;
  const problems = await reviewAgainstHook(input.hook, draft.slides, input.campaign.language, productOnLastSlide).catch((e) => {
    console.error("Hook review failed, keeping the draft", e);
    return [];
  });
  if (problems.length === 0) return draft;
  console.info("Hook review rejected slides, rewriting once", { hook: input.hook, problems });
  return writeContent({ ...input, campaign }, { previous: draft.slides, problems });
}

async function writeContent(
  input: ContentInput,
  feedback?: { previous: string[]; problems: { slide: number; reason: string }[] },
) {
  const { campaign } = input;
  const [min, max] = LENGTH_WORDS[campaign.contentLength];
  const n = campaign.contentSlideCount;
  const format = {
    numbered: 'Start each slide with its number and a period ("1. ", "2. " …).',
    steps: `Each slide is one step in order; start each with "${campaign.language === "de" ? "Schritt" : "Step"} N: ".`,
    plain: "No numbering; each slide is a single sentence or two short ones.",
  }[campaign.contentFormat];
  const productRule =
    campaign.productMention === "last_slide" && input.product
      ? `Slide ${n} is the last item of the list and ties it to ${input.product.name}: still an item that delivers the hook's promise, where ${input.product.name} is the natural answer, using only its facts. Slides 1-${n - 1} do not mention the product.`
      : "Do not mention the product in the content slides; it appears on the CTA slide.";
  const feedbackBlock = feedback
    ? `
<review>
A reviewer rejected the previous draft because some slides do not deliver the hook's promise:
${feedback.problems.map((p) => `- Slide ${p.slide}: ${p.reason}`).join("\n")}
Previous draft:
${feedback.previous.map((t, i) => `${i + 1}. ${t}`).join("\n")}
Write the post again. Keep slides that worked, replace the rejected ones.
</review>
`
    : "";

  // One named field per slide: structured outputs then guarantees exactly N slides. The
  // "promise" and "angle" fields come first so the model commits to them before writing.
  const slideKeys = Array.from({ length: n }, (_, i) => `slide_${i + 1}`);
  const output = await parse(
    z.object({
      promise: z.string(),
      angle: z.string(),
      ...Object.fromEntries(slideKeys.map((k) => [k, z.string()])),
      caption: z.string(),
    }) as z.ZodType<Record<string, string>>,
    `${productBlock(input.product)}

${campaignBlock(campaign)}
${input.research ? `\n<research>\n${input.research}\n</research>\nYou may use facts from the research above, including numbers, but only where they appear there.\n` : ""}
<hook>${input.hook}</hook>
${feedbackBlock}
The hook is the contract with the viewer. The campaign brief only sets the topic and background: where the brief and the hook point in different directions, follow the hook. A viewer who swipes through must feel that every single slide is exactly what the hook promised.

Fill in the fields in order:
- promise: in one sentence, exactly what the hook promises the viewer: the type of item (e.g. "moments to photograph", "mistakes", "things to pack"), how many, and for whom.
- angle: the specific, non-obvious angle that makes this post worth saving, in one sentence.
- slide_1 … slide_${n}: the content slides. Each is one item of exactly the type in "promise" (not a tip when the hook promises moments, not a moment when it promises tips), with a concrete detail a generic list would never have. No two slides make the same point. ${format} Each slide has ${min}-${max} words. ${productRule}
- caption: the TikTok caption. One or two short sentences that make people swipe, then 3-5 relevant hashtags. Emojis are allowed here. No first-person experiences unless the hook or brief asks for them, and any slide number you mention must match the slides above.

Before finalising, check every slide twice: does it deliver the promise, and could it appear in any generic listicle about this topic? Fix any slide that fails either check.`,
    { effort: "high", maxTokens: 6000 },
  );

  const slides = slideKeys.map((k, i) => withNumbering(output[k].trim(), campaign.contentFormat, i + 1, campaign.language));
  return { slides, caption: output.caption.trim() };
}

/** Independent check: which slides don't deliver what the hook promises? */
async function reviewAgainstHook(hook: string, slides: string[], language: string, productOnLastSlide: string | null) {
  const { problems } = await parse(
    z.object({ problems: z.array(z.object({ slide: z.number(), reason: z.string() })) }),
    `You are reviewing a TikTok slideshow before it is posted.

<hook>${hook}</hook>
<slides>
${slides.map((t, i) => `${i + 1}. ${t}`).join("\n")}
</slides>

A viewer reads the hook, then swipes through the slides. List every slide that breaks the hook's promise: a different type of item than promised (e.g. a tip or a product pitch when the hook promises moments to photograph), off-topic, or repeating another slide. If the hook implies a story or a specific situation, slides must stay inside it. ${
      productOnLastSlide
        ? `The last slide is meant to bring in ${productOnLastSlide}: accept it as long as it is still framed as an item of the promised type (e.g. a moment, a mistake) rather than a plain feature pitch. `
        : ""
    }Be strict but fair: a slide that clearly delivers the promise is fine even if you would have written it differently. Give short reasons in English. The post language is ${LANGUAGES[language] ?? language}. Return an empty list if every slide fits.`,
    { maxTokens: 1500 },
  );
  return problems.filter((p) => p.slide >= 1 && p.slide <= slides.length);
}

/** Guarantees the chosen numbering format, which the model occasionally drops. */
function withNumbering(text: string, format: CampaignContext["contentFormat"], n: number, language: string) {
  if (format === "numbered" && !/^\d+[.)]\s/.test(text)) return `${n}. ${text}`;
  if (format === "steps" && !/^(step|schritt)\s*\d+/i.test(text)) return `${language === "de" ? "Schritt" : "Step"} ${n}: ${text}`;
  return text;
}

export async function optimizeContentPrompt(input: { product: ProductContext | null; prompt: string; language: string }) {
  const { prompt } = await parse(
    z.object({ prompt: z.string() }),
    `${productBlock(input.product)}

<draft_prompt>
${input.prompt || "(empty)"}
</draft_prompt>

This draft describes what the content slides of a TikTok slideshow campaign should be about. Rewrite it into a clear, specific brief of 2-4 sentences: the audience, the topic and a non-obvious angle, what a great slide looks like (a concrete scene or insider detail, not generic advice), and any constraints. Keep the author's intent. Leave out where the product appears; that is a separate setting. Write it in ${LANGUAGES[input.language] ?? input.language}.`,
    { maxTokens: 1500 },
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

Search the web and return 5-8 short, verifiable facts (with the number where there is one) that would make good slides for this hook. Prefer surprising, specific facts over common knowledge. Plain bullet points with the source site in brackets. No introduction.`,
      },
    ],
  });
  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

/** Rewrites one slide of an existing post so it still fits the others. */
export async function rewriteSlide(input: {
  product: ProductContext | null;
  campaign: CampaignContext;
  slides: { kind: "hook" | "content" | "cta"; text: string }[];
  index: number;
}) {
  const { campaign, slides, index } = input;
  const target = slides[index];
  const [min, max] = LENGTH_WORDS[campaign.contentLength];
  const rules = {
    hook: "It is the hook: under 12 words, a specific promise the content slides already deliver.",
    content: `It is a content slide: ${min}-${max} words, same numbering/format as the other content slides, delivering the hook's promise with a concrete detail that is not already covered by the other slides.`,
    cta: "It is the call to action: names the product, under 10 words, a natural next step rather than an ad.",
  }[target.kind];

  const { text } = await parse(
    z.object({ text: z.string() }),
    `${productBlock(input.product)}

${campaignBlock(campaign)}

<post>
${slides.map((s, i) => `Slide ${i + 1} (${s.kind}): ${s.text || "(image only)"}`).join("\n")}
</post>

Rewrite slide ${index + 1}. ${rules} Make it clearly different from the current version and more specific.`,
    { maxTokens: 1500, effort: "high" },
  );
  return text.trim();
}

// ─── Images ──────────────────────────────────────────────────────────────────

/** A short, searchable description of a library image, written once and reused for matching. */
export async function describeImage(imageUrl: string) {
  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 1000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: betaZodOutputFormat(z.object({ description: z.string() })) },
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "url", url: imageUrl } },
          {
            type: "text",
            text: "Describe this photo in one or two sentences for picking slideshow backgrounds: who or what is in it, what is happening, the setting, the mood and the shot type (close-up, wide, detail). Plain English, no preamble.",
          },
        ],
      },
    ],
  });
  if (!response.parsed_output) throw new Error("Could not describe the image");
  return clean(response.parsed_output.description).trim();
}

export type MatchCandidate = { id: string; description: string; favorite: boolean };

/**
 * Picks the best-fitting image for every slide. Each slide has its own candidate list (its
 * library); the same image is never used twice. Returns one candidate id per slide (or null).
 */
export async function matchImages(slides: { kind: string; text: string; candidates: MatchCandidate[] }[]) {
  const catalogue = slides
    .map(
      (s, i) =>
        `<slide number="${i + 1}" kind="${s.kind}">
Text: ${s.text || "(no text)"}
Candidates:
${s.candidates.map((c, j) => `  ${j + 1}. ${c.description}${c.favorite ? " [favorite]" : ""}`).join("\n")}
</slide>`,
    )
    .join("\n\n");

  const { picks } = await parse(
    z.object({ picks: z.array(z.object({ slide: z.number(), candidate: z.number() })) }),
    `Choose a background photo for each slide of this TikTok slideshow.

${catalogue}

For every slide pick the candidate (by its number in that slide's list) whose photo best illustrates the slide text. The hook slide should get the most eye-catching photo. Prefer favorites when the fit is similar. Never use the same photo (same description in the same list) for two slides. Return one pick per slide.`,
    { maxTokens: 2000 },
  );

  const used = new Set<string>();
  return slides.map((s, i) => {
    const pick = picks.find((p) => p.slide === i + 1);
    const candidate = pick ? s.candidates[pick.candidate - 1] : undefined;
    if (!candidate || used.has(candidate.id)) return null;
    used.add(candidate.id);
    return candidate.id;
  });
}
