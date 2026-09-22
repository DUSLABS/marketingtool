"use client";

import { useRef, type PointerEvent } from "react";
import { CANVAS, type ImageCrop, type SlideKind, type SlideLayout, type TextBox } from "@/lib/slides/types";
import { ScaledSlide, Slide } from "./slide";

const SNAP = 0.015;
const MIN_W = 0.3;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

type Drag = { mode: "move" | "left" | "right"; startX: number; startY: number; box: TextBox };

/** A scaled slide whose text box can be dragged (position) and resized (width) with the pointer. */
export function EditableSlide({
  width,
  kind,
  layout,
  text,
  imageUrl,
  imageCrop,
  showSafeArea,
  onBoxChange,
}: {
  width: number;
  kind: SlideKind;
  layout: SlideLayout;
  text: string;
  imageUrl: string | null;
  imageCrop?: ImageCrop | null;
  showSafeArea: boolean;
  onBoxChange: (box: TextBox) => void;
}) {
  const drag = useRef<Drag | null>(null);
  const height = width * (CANVAS.height / CANVAS.width);

  function start(e: PointerEvent<HTMLElement>) {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const mode = (e.currentTarget.dataset.drag ?? "move") as Drag["mode"];
    drag.current = { mode, startX: e.clientX, startY: e.clientY, box: layout.box };
  }

  function move(e: PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.startX) / width;
    const dy = (e.clientY - d.startY) / height;

    if (d.mode === "move") {
      let x = clamp(d.box.x + dx, d.box.w / 2, 1 - d.box.w / 2);
      if (Math.abs(x - 0.5) < SNAP) x = 0.5;
      onBoxChange({ ...d.box, x, y: clamp(d.box.y + dy, 0.04, 0.96) });
    } else {
      // Resizing is symmetric around the centre, so the box stays where it was placed.
      const delta = d.mode === "right" ? dx : -dx;
      const w = clamp(d.box.w + delta * 2, MIN_W, 1);
      onBoxChange({ ...d.box, w, x: clamp(d.box.x, w / 2, 1 - w / 2) });
    }
  }

  function end() {
    drag.current = null;
  }

  const handle = (side: "left" | "right") => (
    <div
      data-drag={side}
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={end}
      style={{
        position: "absolute",
        top: "50%",
        [side]: -22,
        width: 40,
        height: 96,
        transform: "translateY(-50%)",
        borderRadius: 20,
        background: "#5bffb7",
        cursor: "ew-resize",
        touchAction: "none",
      }}
    />
  );

  return (
    <ScaledSlide width={width}>
      <Slide
        kind={kind}
        layout={layout}
        text={text || " "}
        imageUrl={imageUrl}
        imageCrop={imageCrop}
        showSafeArea={showSafeArea}
        textBoxProps={{
          onPointerDown: start,
          onPointerMove: move,
          onPointerUp: end,
          style: { cursor: "move", outline: "4px dashed rgba(91,255,183,.85)", outlineOffset: 12, touchAction: "none", userSelect: "none" },
        }}
        textBoxChildren={
          <>
            {handle("left")}
            {handle("right")}
          </>
        }
      />
    </ScaledSlide>
  );
}
