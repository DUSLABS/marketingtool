"use client";

import { useRef, useState, useTransition, type PointerEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SafeAreaOverlay, ScaledSlide, SlideImage } from "@/components/slides/slide";
import { CANVAS, clampCrop, DEFAULT_CROP, type ImageCrop } from "@/lib/slides/types";
import { setAssetCrop } from "./actions";

const WIDTH = 320;

/** Frame an image for 9:16 slides: drag to move, slider to zoom. */
export function CropDialog({
  asset,
  onClose,
}: {
  asset: { id: string; thumbUrl: string; crop: ImageCrop | null };
  onClose: () => void;
}) {
  const [crop, setCrop] = useState<ImageCrop>(asset.crop ?? DEFAULT_CROP);
  const [saving, start] = useTransition();
  const drag = useRef<{ x: number; y: number; crop: ImageCrop } | null>(null);
  const height = WIDTH * (CANVAS.height / CANVAS.width);

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, crop };
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d) return;
    setCrop(
      clampCrop({
        zoom: d.crop.zoom,
        x: d.crop.x + (e.clientX - d.x) / WIDTH,
        y: d.crop.y + (e.clientY - d.y) / height,
      }),
    );
  }

  function save(next: ImageCrop | null) {
    start(async () => {
      try {
        await setAssetCrop(asset.id, next);
        toast.success(next ? "Framing saved" : "Framing reset");
        onClose();
      } catch {
        toast.error("Could not save the framing");
      }
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust framing</DialogTitle>
          <DialogDescription>
            Drag to move, zoom to crop tighter. Keep what matters above the yellow line: TikTok&apos;s post view cuts off
            everything below it. Applies to every slide that uses this image.
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-center">
          <div
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={() => (drag.current = null)}
            className="cursor-grab touch-none active:cursor-grabbing"
          >
            <ScaledSlide width={WIDTH}>
              <div style={{ width: CANVAS.width, height: CANVAS.height, position: "relative", overflow: "hidden", background: "#111" }}>
                <SlideImage url={asset.thumbUrl} crop={crop} />
                <SafeAreaOverlay />
              </div>
            </ScaledSlide>
          </div>
        </div>

        <label className="flex items-center gap-3 text-sm">
          <span className="w-24 text-muted-foreground">Zoom · {Math.round(crop.zoom * 100)}%</span>
          <input
            type="range"
            min={1}
            max={2.5}
            step={0.05}
            value={crop.zoom}
            onChange={(e) => setCrop(clampCrop({ ...crop, zoom: Number(e.target.value) }))}
            className="flex-1 accent-[var(--accent-primary)]"
          />
        </label>

        <DialogFooter>
          <Button variant="ghost" onClick={() => save(null)} disabled={saving}>
            Reset
          </Button>
          <Button onClick={() => save(crop)} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
