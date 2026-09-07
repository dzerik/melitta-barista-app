import type { CSSProperties, ReactNode } from "react";

export type GlyphSize = "row" | "state";

/**
 * The whole ladder, and there is no third rung.
 *
 *  row   — 20px, the glyph that leads a settings or maintenance row.
 *  state — 80px, the glyph that stands over an empty, blocked or offline page.
 *
 * The audit found five sizes for the state glyph (96/80/80/80/64 with four
 * different opacities) and two for the row glyph (24 raw against 20 with a
 * knock-down), for two roles (C27, C28).
 */
export const GLYPH_PX: Record<GlyphSize, number> = {
  row: 20,
  state: 80,
};

/** §6.6: one opacity knock-down, and this is it. */
export const GLYPH_OPACITY = 0.6;

/** An unlit row glyph — a state, not a size (§C3.3 keeps the row's space). */
export const GLYPH_OPACITY_UNLIT = 0.45;

export interface GlyphProps {
  /** A raster asset. Give either this or `children`, never both. */
  src?: string;
  /**
   * The accessible name. Pass `""` for a purely decorative mark — it then
   * carries `alt=""` and is hidden from the accessibility tree, which is what
   * a glyph beside a headline that already says the same thing needs.
   */
  alt?: string;
  /** A lucide node, for the empties that have no raster asset. */
  children?: ReactNode;
  /** Default `row`. */
  size?: GlyphSize;
  /**
   * Row-rung state: lit at full opacity, unlit knocked to 0.45. Ignored on the
   * `state` rung, which is always the one 0.6 knock-down.
   */
  lit?: boolean;
  /** §9.3 busy-with-no-measure: the breathing pulse, never a spinner. */
  pulse?: boolean;
  id?: string;
  className?: string;
  style?: CSSProperties;
}

/**
 * The non-drink glyph — the raster mark that leads a settings row and the
 * larger one that stands over an empty or blocked page (§6.6).
 *
 * It is deliberately NOT `CoffeeIcon`: a drink is the hero of its cell and
 * gets the `DrinkStage` ground, the truth scale and the reflection. This is
 * the other thing — a fixed square at one of two sizes with one opacity
 * knock-down, no glow, no ground, no reflection, no radius and no fill.
 *
 * It accepts a lucide node instead of a `src` so the sommelier empties stop
 * being a third idiom: the box and the ink are identical whichever way the
 * mark is drawn.
 */
export function Glyph({
  src,
  alt = "",
  children,
  size = "row",
  lit = true,
  pulse = false,
  id,
  className = "",
  style,
}: GlyphProps) {
  const px = GLYPH_PX[size];
  const opacity =
    size === "state" ? GLYPH_OPACITY : lit ? 1 : GLYPH_OPACITY_UNLIT;

  const shared: CSSProperties = {
    width: px,
    height: px,
    opacity,
    borderRadius: 0,
    ...style,
  };

  const classes = [
    "shrink-0 object-contain",
    pulse ? "status-icon-pulse" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (src !== undefined) {
    return (
      <img
        id={id}
        src={src}
        alt={alt}
        aria-hidden={alt === "" ? "true" : undefined}
        draggable={false}
        data-ui="glyph"
        data-size={size}
        className={classes}
        style={shared}
      />
    );
  }

  return (
    <span
      id={id}
      role={alt === "" ? undefined : "img"}
      aria-label={alt === "" ? undefined : alt}
      aria-hidden={alt === "" ? "true" : undefined}
      data-ui="glyph"
      data-size={size}
      className={["inline-flex items-center justify-center", classes].join(" ")}
      style={shared}
    >
      {children}
    </span>
  );
}
