import { z } from "zod";

export const imageSettingsSchema = z.object({
  image_mode: z.enum(["library", "auto"]),
  image_style: z.string().trim().max(2000),
  image_max_uses: z.number().int().min(1).max(20),
  image_cooldown_days: z.number().int().min(0).max(365),
});

export type ImageSettings = z.infer<typeof imageSettingsSchema>;

export const DEFAULT_IMAGE_SETTINGS: ImageSettings = {
  image_mode: "auto",
  image_style: "Natural, candid photography. Warm natural light, believable everyday scenes, consistent colors. No text, logos or watermarks.",
  image_max_uses: 3,
  image_cooldown_days: 7,
};

export function canReuseImage(
  usage: { uses: number; lastUsed: number },
  settings: Pick<ImageSettings, "image_max_uses" | "image_cooldown_days">,
  now = Date.now(),
) {
  return usage.uses < settings.image_max_uses &&
    (usage.uses === 0 || now - usage.lastUsed >= settings.image_cooldown_days * 86_400_000);
}
