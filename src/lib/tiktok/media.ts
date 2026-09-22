import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// Public, unguessable URLs for rendered slides on our own (TikTok-verified) domain, so TikTok can
// pull them with PULL_FROM_URL. Format: /media/<signature>/<storage path in the renders bucket>.

function signature(path: string) {
  return createHmac("sha256", process.env.SUPABASE_SECRET_KEY!).update(`media:${path}`).digest("base64url").slice(0, 32);
}

export function publicBaseUrl() {
  return process.env.PUBLIC_BASE_URL ?? "https://marketingtool.duslabs.de";
}

export function mediaUrl(renderPath: string) {
  return `${publicBaseUrl()}/media/${signature(renderPath)}/${renderPath}`;
}

export function verifyMediaSignature(renderPath: string, sig: string) {
  const expected = Buffer.from(signature(renderPath));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
