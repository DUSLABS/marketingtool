import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AUTHORIZE_URL, redirectUri, SCOPES, STATE_COOKIE } from "@/lib/tiktok/api";


// Starts the TikTok login. The state value is kept in an httpOnly cookie and checked in the callback.
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return NextResponse.redirect(new URL("/login", request.url));

  const state = randomBytes(24).toString("base64url");
  (await cookies()).set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/api/tiktok",
    maxAge: 10 * 60,
  });

  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_key", process.env.TIKTOK_CLIENT_KEY!);
  url.searchParams.set("scope", SCOPES.join(","));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri());
  url.searchParams.set("state", state);
  // Always show the account picker so a second account can be connected.
  url.searchParams.set("disable_auto_auth", "1");
  return NextResponse.redirect(url);
}
