import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// Short-lived signed tokens that let the headless browser open /render/<postId> without a session.
const TTL_SECONDS = 5 * 60;

function sign(postId: string, exp: number) {
  return createHmac("sha256", process.env.SUPABASE_SECRET_KEY!).update(`render:${postId}:${exp}`).digest("base64url");
}

export function createRenderToken(postId: string) {
  const exp = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  return `${exp}.${sign(postId, exp)}`;
}

export function verifyRenderToken(postId: string, token: string | undefined) {
  const [expRaw, sig] = (token ?? "").split(".");
  const exp = Number(expRaw);
  if (!sig || !Number.isFinite(exp) || exp < Date.now() / 1000) return false;
  const expected = Buffer.from(sign(postId, exp));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
