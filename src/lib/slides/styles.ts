import type { CSSProperties } from "react";
import type { SlideKind, TextStyleId } from "./types";

// Font sizes are canvas pixels (1080 wide). Hooks are set larger than body slides.
const SIZE: Record<SlideKind, number> = { hook: 76, content: 58, cta: 60 };

export const TEXT_STYLES: Record<TextStyleId, { label: string; description: string }> = {
  classic: { label: "TikTok Classic", description: "White bold, black outline" },
  box: { label: "Text box", description: "Black on white highlight, like TikTok's native text" },
  minimal: { label: "Minimal", description: "White bold, soft shadow" },
  editorial: { label: "Editorial", description: "Serif, soft shadow" },
};

/** Styles for the block wrapper and the inline text span (the span carries per-line backgrounds). */
export function textStyle(style: TextStyleId, kind: SlideKind): { block: CSSProperties; span: CSSProperties } {
  const size = SIZE[kind];
  const base: CSSProperties = {
    fontFamily: "var(--font-slide-sans), system-ui, sans-serif",
    fontSize: size,
    fontWeight: 800,
    lineHeight: 1.18,
    color: "#fff",
    whiteSpace: "pre-wrap",
    overflowWrap: "break-word",
  };

  switch (style) {
    case "classic":
      return {
        block: base,
        span: { WebkitTextStroke: `${Math.round(size / 11)}px #000`, paintOrder: "stroke fill" },
      };
    case "box":
      return {
        block: { ...base, lineHeight: 1.45, fontWeight: 700 },
        span: {
          background: "#fff",
          color: "#000",
          padding: "0.08em 0.3em",
          borderRadius: "0.18em",
          boxDecorationBreak: "clone",
          WebkitBoxDecorationBreak: "clone",
        },
      };
    case "minimal":
      return { block: { ...base, fontWeight: 700 }, span: { textShadow: "0 4px 24px rgba(0,0,0,.55), 0 2px 6px rgba(0,0,0,.4)" } };
    case "editorial":
      return {
        block: {
          ...base,
          fontFamily: "var(--font-slide-serif), Georgia, serif",
          fontWeight: 400,
          fontSize: Math.round(size * 1.15),
          lineHeight: 1.1,
        },
        span: { textShadow: "0 4px 28px rgba(0,0,0,.6)" },
      };
  }
}
