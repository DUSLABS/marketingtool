// Shared slide model used by the campaign editor now and by the renderer (Phase 4).
// Coordinates are fractions of the 1080×1920 canvas; box x/y is the text box centre.

export const CANVAS = { width: 1080, height: 1920 } as const;

export type SlideKind = "hook" | "content" | "cta";
export type TextStyleId = "classic" | "box" | "minimal" | "editorial";
export type TextAlign = "left" | "center" | "right";

export type TextBox = { x: number; y: number; w: number };

export type SlideLayout = {
  libraryId: string | null;
  style: TextStyleId;
  align: TextAlign;
  box: TextBox;
  /** Darkening overlay over the image, 0–0.7. */
  dim: number;
};

export type CampaignLayout = Record<SlideKind, SlideLayout>;

export const DEFAULT_LAYOUT: CampaignLayout = {
  hook: { libraryId: null, style: "classic", align: "center", box: { x: 0.5, y: 0.4, w: 0.84 }, dim: 0.15 },
  content: { libraryId: null, style: "classic", align: "center", box: { x: 0.5, y: 0.45, w: 0.84 }, dim: 0.2 },
  cta: { libraryId: null, style: "box", align: "center", box: { x: 0.5, y: 0.3, w: 0.8 }, dim: 0 },
};

export function withDefaults(layout: Partial<CampaignLayout> | null | undefined): CampaignLayout {
  return {
    hook: { ...DEFAULT_LAYOUT.hook, ...layout?.hook },
    content: { ...DEFAULT_LAYOUT.content, ...layout?.content },
    cta: { ...DEFAULT_LAYOUT.cta, ...layout?.cta },
  };
}

/** Regions covered by TikTok's UI in the For You feed (approximate), as canvas fractions. */
export const SAFE_AREA = { top: 0.09, bottom: 0.22, right: 0.14, left: 0.04 } as const;

/**
 * In the post view (opened from a profile, caption below the photo) TikTok shows only about a
 * 3:4 window from the top: everything below this fraction of the height is cut off.
 */
export const POST_VIEW_VISIBLE = 0.75;

/** How an image is framed inside the 9:16 slide: zoom and pan (fractions of the canvas). */
export type ImageCrop = { zoom: number; x: number; y: number };

export const DEFAULT_CROP: ImageCrop = { zoom: 1, x: 0, y: 0 };

/** Keeps the pan within what the zoom allows, so the image always covers the slide. */
export function clampCrop(crop: ImageCrop): ImageCrop {
  const zoom = Math.min(2.5, Math.max(1, crop.zoom));
  const max = (zoom - 1) / 2;
  const clamp = (v: number) => Math.min(max, Math.max(-max, v));
  return { zoom, x: clamp(crop.x), y: clamp(crop.y) };
}
