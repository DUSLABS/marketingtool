import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { exchangeCode, getUserInfo, queryCreatorInfo, STATE_COOKIE } from "@/lib/tiktok/api";
import { saveTokens } from "@/lib/tiktok/accounts";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const back = (params: Record<string, string>) => {
    const target = new URL("/connections", request.url);
    for (const [k, v] of Object.entries(params)) target.searchParams.set(k, v);
    return NextResponse.redirect(target);
  };

  const jar = await cookies();
  const expectedState = jar.get(STATE_COOKIE)?.value;
  jar.delete({ name: STATE_COOKIE, path: "/api/tiktok" });

  if (url.searchParams.get("error")) {
    return back({ error: url.searchParams.get("error_description") ?? url.searchParams.get("error")! });
  }
  const code = url.searchParams.get("code");
  if (!code || !expectedState || url.searchParams.get("state") !== expectedState) {
    return back({ error: "The TikTok login could not be verified. Please try again." });
  }

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return NextResponse.redirect(new URL("/login", request.url));
  const { data: member } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", claims.claims.sub)
    .limit(1)
    .single();
  if (!member) return back({ error: "No workspace found for this user." });

  try {
    const tokens = await exchangeCode(code);
    const [{ user }, creator] = await Promise.all([
      getUserInfo(tokens.access_token),
      queryCreatorInfo(tokens.access_token).catch(() => null),
    ]);

    const db = createAdminClient();
    const { data: account, error } = await db
      .from("tiktok_accounts")
      .upsert(
        {
          workspace_id: member.workspace_id,
          open_id: tokens.open_id,
          username: creator?.creator_username ?? null,
          display_name: user.display_name ?? creator?.creator_nickname ?? null,
          avatar_url: user.avatar_url ?? creator?.creator_avatar_url ?? null,
          scopes: tokens.scope.split(","),
          status: "active",
          last_error: null,
        },
        { onConflict: "open_id" },
      )
      .select("id, username, display_name")
      .single();
    if (error) throw error;
    await saveTokens(db, account.id, tokens);

    return back({ connected: account.username ?? account.display_name ?? "account" });
  } catch (e) {
    console.error("TikTok callback failed", e);
    return back({ error: e instanceof Error ? e.message : "Connecting the TikTok account failed." });
  }
}
