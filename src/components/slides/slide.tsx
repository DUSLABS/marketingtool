import type { HTMLAttributes, ReactNode } from "react";
import {
  BADGE_ASPECT,
  BADGE_SRC,
  CANVAS,
  POST_VIEW_VISIBLE,
  SAFE_AREA,
  type ImageCrop,
  type SlideKind,
  type SlideLayout,
} from "@/lib/slides/types";
import { textStyle } from "@/lib/slides/styles";

type SlideProps = {
  kind: SlideKind;
  layout: SlideLayout;
  text: string;
  imageUrl: string | null;
  imageCrop?: ImageCrop | null;
  showSafeArea?: boolean;
  /** Extra props for the text box (the editor uses this for dragging). */
  textBoxProps?: HTMLAttributes<HTMLDivElement>;
  textBoxChildren?: ReactNode;
  /** Extra props for the App Store badge (the editor uses this for dragging). */
  badgeProps?: HTMLAttributes<HTMLDivElement>;
};

/**
 * One slide at its real size (1080×1920). This is the single source of truth for how a slide
 * looks: the editor shows it scaled down and the renderer screenshots it at full size.
 */
export function Slide({
  kind,
  layout,
  text,
  imageUrl,
  imageCrop,
  showSafeArea,
  textBoxProps,
  textBoxChildren,
  badgeProps,
}: SlideProps) {
  const badge = kind === "cta" && layout.badge?.enabled ? layout.badge : null;
  const { block, span } = textStyle(layout.style, kind);
  const { x, y, w } = layout.box;

  return (
    <div
      style={{ width: CANVAS.width, height: CANVAS.height, position: "relative", overflow: "hidden", background: "#111" }}
    >
      {imageUrl && <SlideImage url={imageUrl} crop={imageCrop} />}
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

      {badge && (
        <div
          {...badgeProps}
          style={{
            position: "absolute",
            left: (badge.x - badge.w / 2) * CANVAS.width,
            top: badge.y * CANVAS.height,
            width: badge.w * CANVAS.width,
            height: (badge.w * CANVAS.width) / BADGE_ASPECT,
            transform: "translateY(-50%)",
            ...badgeProps?.style,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- rendered to an image, needs a plain <img> */}
          <img
            src={BADGE_SRC}
            alt="Download on the App Store"
            draggable={false}
            style={{ width: "100%", height: "100%", display: "block", filter: badge.variant === "light" ? "invert(1)" : undefined }}
          />
        </div>
      )}

      {showSafeArea && <SafeAreaOverlay />}
    </div>
  );
}

/** The background image, cover-fitted, then zoomed and panned by the image's crop. */
export function SlideImage({ url, crop }: { url: string; crop?: ImageCrop | null }) {
  const { zoom, x, y } = crop ?? { zoom: 1, x: 0, y: 0 };
  return (
    // eslint-disable-next-line @next/next/no-img-element -- rendered to an image, needs a plain <img>
    <img
      src={url}
      alt=""
      draggable={false}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        objectFit: "cover",
        transform: `translate(${x * 100}%, ${y * 100}%) scale(${zoom})`,
      }}
    />
  );
}

export function SafeAreaOverlay() {
  const shade = "rgba(255, 91, 110, 0.12)";
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
      <SafeLabel top={`${(1 - bottom) * 100}%`} side="left" color="#ff5b6e">
        Feed: caption & buttons
      </SafeLabel>
      {/* Post view (opened from the profile) cuts everything below this line */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: `${POST_VIEW_VISIBLE * 100}%`,
          bottom: 0,
          background: "repeating-linear-gradient(135deg, rgba(255,203,107,.16) 0 24px, transparent 24px 48px)",
          borderTop: "4px dashed rgba(255, 203, 107, 0.9)",
        }}
      />
      <SafeLabel top={`${POST_VIEW_VISIBLE * 100}%`} side="right" color="#ffcb6b">
        Post view: cut off below
      </SafeLabel>
    </div>
  );
}

function SafeLabel({ top, side, color, children }: { top: string; side: "left" | "right"; color: string; children: ReactNode }) {
  return (
    <div
      style={{
        position: "absolute",
        top,
        [side]: 32,
        marginTop: side === "right" ? -62 : 14,
        padding: "6px 16px",
        borderRadius: 999,
        background: "rgba(0,0,0,.7)",
        color,
        fontFamily: "system-ui, sans-serif",
        fontSize: 30,
        fontWeight: 600,
      }}
    >
      {children}
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
