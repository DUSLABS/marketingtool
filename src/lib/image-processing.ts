// Browser-side image normalisation before upload: HEIC → JPEG, EXIF rotation applied, size capped, thumbnail.
// Doing this client-side keeps originals out of Vercel's request size limit and avoids native deps on the server.

export const ACCEPTED_IMAGE_TYPES = "image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif";

const MAX_EDGE = 3000; // leaves room to crop/zoom into a 1080×1920 slide
const THUMB_EDGE = 480;

export type ProcessedImage = {
  full: Blob;
  thumb: Blob;
  width: number;
  height: number;
  sha256: string;
};

async function sha256Hex(blob: Blob) {
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function isHeicName(file: File) {
  return /\.(heic|heif)$/i.test(file.name) || file.type === "image/heic" || file.type === "image/heif";
}

async function decode(file: File): Promise<ImageBitmap> {
  if (isHeicName(file)) {
    const { heicTo } = await import("heic-to");
    return heicTo({ blob: file, type: "bitmap" });
  }
  return createImageBitmap(file, { imageOrientation: "from-image" });
}

async function encode(bitmap: ImageBitmap, maxEdge: number, quality: number) {
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, width, height);
  const blob = await canvas.convertToBlob({ type: "image/jpeg", quality });
  return { blob, width, height };
}

export async function processImage(file: File): Promise<ProcessedImage> {
  const [sha256, bitmap] = await Promise.all([sha256Hex(file), decode(file)]);
  try {
    const full = await encode(bitmap, MAX_EDGE, 0.9);
    const thumb = await encode(bitmap, THUMB_EDGE, 0.8);
    return { full: full.blob, thumb: thumb.blob, width: full.width, height: full.height, sha256 };
  } finally {
    bitmap.close();
  }
}
