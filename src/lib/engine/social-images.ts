import "server-only";
import sharp from "sharp";
import { CANVAS, clampCrop, type ImageCrop } from "@/lib/slides/types";

/** Consistent platform canvas; review the cropped result, not the uncropped provider image. */
export async function prepareSocialImage(bytes: Buffer, crop?: ImageCrop | null) {
  const covered = await sharp(bytes, { limitInputPixels: 40_000_000 }).rotate()
    .resize(CANVAS.width, CANVAS.height, { fit: "cover", position: "centre" })
    .png().toBuffer();
  const { zoom, x, y } = clampCrop(crop ?? { zoom: 1, x: 0, y: 0 });
  const width = Math.round(CANVAS.width * zoom), height = Math.round(CANVAS.height * zoom);
  const image = await sharp(covered).resize(width, height).extract({
    left: Math.max(0, Math.min(width - CANVAS.width, Math.round((width - CANVAS.width) / 2 - x * CANVAS.width))),
    top: Math.max(0, Math.min(height - CANVAS.height, Math.round((height - CANVAS.height) / 2 - y * CANVAS.height))),
    width: CANVAS.width, height: CANVAS.height,
  }).jpeg({ quality: 90 }).toBuffer();
  const thumbnail = await sharp(image).resize(360, 640).jpeg({ quality: 80 }).toBuffer();
  return { image, thumbnail };
}

/** Reject invalid output before storage/upload; TikTok's image API accepts JPEG/WebP up to 20 MB. */
export async function validateSocialImage(bytes: Buffer) {
  if (bytes.length > 20_000_000) throw new Error("The rendered image exceeds TikTok's 20 MB limit.");
  const metadata = await sharp(bytes).metadata();
  if (metadata.format !== "jpeg" || metadata.width !== CANVAS.width || metadata.height !== CANVAS.height) {
    throw new Error("Expected a 1080 × 1920 JPEG for the TikTok slideshow.");
  }
}
