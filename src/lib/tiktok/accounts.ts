import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { refreshToken, TikTokError, type TokenResponse } from "./api";

const REFRESH_MARGIN_MS = 10 * 60 * 1000;

export async function saveTokens(db: SupabaseClient, accountId: string, t: TokenResponse) {
  const now = Date.now();
  const { error } = await db.from("tiktok_tokens").upsert({
    account_id: accountId,
    access_token: t.access_token,
    refresh_token: t.refresh_token,
    access_expires_at: new Date(now + t.expires_in * 1000).toISOString(),
    refresh_expires_at: new Date(now + t.refresh_expires_in * 1000).toISOString(),
    updated_at: new Date(now).toISOString(),
  });
  if (error) throw error;
}

/** Returns a valid access token for the account, refreshing it when it is about to expire. */
export async function getAccessToken(db: SupabaseClient, accountId: string): Promise<string> {
  const { data: tokens, error } = await db.from("tiktok_tokens").select("*").eq("account_id", accountId).single();
  if (error || !tokens) throw new TikTokError("no_token", "This TikTok account is not connected. Reconnect it under Connections.");

  if (new Date(tokens.access_expires_at).getTime() - Date.now() > REFRESH_MARGIN_MS) return tokens.access_token;

  try {
    const fresh = await refreshToken(tokens.refresh_token);
    await saveTokens(db, accountId, fresh);
    await db.from("tiktok_accounts").update({ status: "active", last_error: null }).eq("id", accountId);
    return fresh.access_token;
  } catch (e) {
    await db
      .from("tiktok_accounts")
      .update({ status: "expired", last_error: e instanceof Error ? e.message : "Token refresh failed" })
      .eq("id", accountId);
    throw new TikTokError("token_expired", "The TikTok login expired. Reconnect the account under Connections.");
  }
}
