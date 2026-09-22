import "server-only";

// Thin client for the TikTok Login Kit and Content Posting API (v2).
// Docs: https://developers.tiktok.com/doc/content-posting-api-reference-photo-post

const API = "https://open.tiktokapis.com/v2";
export const AUTHORIZE_URL = "https://www.tiktok.com/v2/auth/authorize/";
export const SCOPES = ["user.info.basic", "video.upload", "video.publish"];
export const STATE_COOKIE = "tiktok_oauth_state";

export class TikTokError extends Error {
  constructor(
    public code: string,
    message: string,
    public logId?: string,
  ) {
    super(message);
  }
}

export function redirectUri() {
  return process.env.TIKTOK_REDIRECT_URI ?? "https://marketingtool.duslabs.de/api/tiktok/callback";
}

export type TokenResponse = {
  access_token: string;
  expires_in: number;
  open_id: string;
  refresh_token: string;
  refresh_expires_in: number;
  scope: string;
};

async function tokenRequest(params: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(`${API}/oauth/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY!,
      client_secret: process.env.TIKTOK_CLIENT_SECRET!,
      ...params,
    }),
  });
  const json = await res.json();
  if (!res.ok || json.error) {
    throw new TikTokError(json.error ?? String(res.status), json.error_description ?? "Token request failed", json.log_id);
  }
  return json as TokenResponse;
}

export const exchangeCode = (code: string) =>
  tokenRequest({ code, grant_type: "authorization_code", redirect_uri: redirectUri() });

export const refreshToken = (refresh_token: string) => tokenRequest({ refresh_token, grant_type: "refresh_token" });

export async function revokeToken(token: string) {
  await fetch(`${API}/oauth/revoke/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY!,
      client_secret: process.env.TIKTOK_CLIENT_SECRET!,
      token,
    }),
  });
}

async function call<T>(accessToken: string, path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: init.method ?? "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json; charset=UTF-8" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const json = await res.json().catch(() => ({}));
  const error = json.error as { code?: string; message?: string; log_id?: string } | undefined;
  if (!res.ok || (error?.code && error.code !== "ok")) {
    throw new TikTokError(error?.code ?? String(res.status), error?.message || `TikTok API error ${res.status}`, error?.log_id);
  }
  return json.data as T;
}

export const getUserInfo = (accessToken: string) =>
  call<{ user: { open_id: string; display_name?: string; avatar_url?: string } }>(
    accessToken,
    "/user/info/?fields=open_id,display_name,avatar_url",
    { method: "GET" },
  );

export type CreatorInfo = {
  creator_avatar_url: string;
  creator_username: string;
  creator_nickname: string;
  privacy_level_options: string[];
  comment_disabled: boolean;
};

export const queryCreatorInfo = (accessToken: string) =>
  call<CreatorInfo>(accessToken, "/post/publish/creator_info/query/", { body: {} });

export type PhotoPostInput = {
  mode: "draft" | "direct";
  imageUrls: string[];
  title: string;
  description: string;
  privacyLevel?: string;
  allowComments?: boolean;
  discloseCommercial?: boolean;
  isAigc?: boolean;
};

const clip = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

export function initPhotoPost(accessToken: string, input: PhotoPostInput) {
  const direct = input.mode === "direct";
  return call<{ publish_id: string }>(accessToken, "/post/publish/content/init/", {
    body: {
      media_type: "PHOTO",
      post_mode: direct ? "DIRECT_POST" : "MEDIA_UPLOAD",
      post_info: {
        title: clip(input.title, 90),
        description: clip(input.description, 4000),
        ...(direct && {
          privacy_level: input.privacyLevel,
          disable_comment: !input.allowComments,
          auto_add_music: true,
          brand_content_toggle: false,
          brand_organic_toggle: !!input.discloseCommercial,
        }),
      },
      source_info: { source: "PULL_FROM_URL", photo_images: input.imageUrls, photo_cover_index: 0 },
      ...(input.isAigc && { is_aigc: true }),
    },
  });
}

export type PublishStatus = {
  status: "PROCESSING_UPLOAD" | "PROCESSING_DOWNLOAD" | "SEND_TO_USER_INBOX" | "PUBLISH_COMPLETE" | "FAILED";
  fail_reason?: string;
  publicaly_available_post_id?: number[];
};

export const fetchPublishStatus = (accessToken: string, publishId: string) =>
  call<PublishStatus>(accessToken, "/post/publish/status/fetch/", { body: { publish_id: publishId } });
