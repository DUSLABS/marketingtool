import "server-only";
import { z } from "zod";

export const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL?.trim() || "gpt-image-2";

export function requireImageGenerationKey() {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error("Automatic images need OPENAI_API_KEY in the server environment.");
  return key;
}

const responseSchema = z.object({ data: z.array(z.object({ b64_json: z.string().min(1) })).min(1) });

/** One image per call. Retries are persisted per slide by the worker, never hidden here. */
export async function generateImage(prompt: string): Promise<Buffer> {
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${requireImageGenerationKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: IMAGE_MODEL,
      prompt,
      n: 1,
      size: "1152x2048",
      quality: "medium",
      output_format: "jpeg",
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) {
    // Do not echo provider payloads (which may contain prompts or credential details).
    if (response.status === 401) throw new Error("The OpenAI image API key is invalid.");
    if (response.status === 429) throw new Error("OpenAI image quota or rate limit reached. Check the API account.");
    throw new Error(`Image generation failed (${response.status}). Check the model's access and the image brief.`);
  }
  const parsed = responseSchema.parse(await response.json());
  const bytes = Buffer.from(parsed.data[0].b64_json, "base64");
  if (bytes.length < 100 || bytes.length > 30_000_000) throw new Error("The image API returned an invalid image.");
  return bytes;
}
