import type { HTMLAttributes, ReactNode } from "react";
import { CANVAS, SAFE_AREA, type SlideKind, type SlideLayout } from "@/lib/slides/types";
import { textStyle } from "@/lib/slides/styles";

type SlideProps = {
  kind: SlideKind;
  layout: SlideLayout;
  text: string;
  imageUrl: string | null;
  showSafeArea?: boolean;
  /** Extra props for the text box (the editor uses this for dragging). */
  textBoxProps?: HTMLAttributes<HTMLDivElement>;
  textBoxChildren?: ReactNode;
};

/**
 * One slide at its real size (1080×1920). This is the single source of truth for how a slide
 * looks: the editor shows it scaled down and the renderer screenshots it at full size.
 */
export function Slide({ kind, layout, text, imageUrl, showSafeArea, textBoxProps, textBoxChildren }: SlideProps) {
  const { block, span } = textStyle(layout.style, kind);
  const { x, y, w } = layout.box;

  return (
    <div
      style={{ width: CANVAS.width, height: CANVAS.height, position: "relative", overflow: "hidden", background: "#111" }}
    >
      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- rendered to an image, needs a plain <img>
        <img
          src={imageUrl}
          alt=""
          draggable={false}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
        />
      )}
      {layout.dim > 0 && <div style={{ position: "absolute", inset: 0, background: `rgba(0,0,0,${layout.dim})` }} />}

      {text && (
        <div
          {...textBoxProps}
          style={{
            position: "absolute",
            left: (x - w / 2) * CANVAS.width,
            top: y * CANVAS.height,
            width: w * CANVAS.width,
            transform: "translateY(-50%)",
            textAlign: layout.align,
            ...block,
            ...textBoxProps?.style,
          }}
        >
          <span style={span}>{text}</span>
          {textBoxChildren}
        </div>
      )}

      {showSafeArea && <SafeAreaOverlay />}
    </div>
  );
}

function SafeAreaOverlay() {
  const shade = "rgba(255, 91, 110, 0.18)";
  const edge = "2px dashed rgba(255, 91, 110, 0.7)";
  const { top, bottom, right, left } = SAFE_AREA;
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: `${top * 100}%`, background: shade, borderBottom: edge }} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: `${bottom * 100}%`, background: shade, borderTop: edge }} />
      <div
        style={{ position: "absolute", right: 0, top: `${top * 100}%`, bottom: `${bottom * 100}%`, width: `${right * 100}%`, background: shade, borderLeft: edge }}
      />
      <div
        style={{ position: "absolute", left: 0, top: `${top * 100}%`, bottom: `${bottom * 100}%`, width: `${left * 100}%`, background: shade, borderRight: edge }}
      />
    </div>
  );
}

/** Displays a slide scaled to `width` CSS pixels. */
export function ScaledSlide({ width, children }: { width: number; children: ReactNode }) {
  const scale = width / CANVAS.width;
  return (
    <div style={{ width, height: CANVAS.height * scale, overflow: "hidden", borderRadius: 14 * (width / 320) }}>
      <div style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: CANVAS.width, height: CANVAS.height }}>
        {children}
      </div>
    </div>
  );
}
