import type { CSSProperties, ReactNode } from "react";
import { usePrefersReducedMotion } from "./reduced-motion";
import { DRINK_ASPECT } from "./tokens";

export interface DrinkStageProps {
  /** The drink itself — a `<CoffeeIcon />`. Rendered twice: once upright, once mirrored. */
  children: ReactNode;
  /** The drawn WIDTH in px. Drives the glow and reflection heights. */
  size?: number;
  /**
   * Drawn height ÷ drawn width. Defaults to CoffeeIcon's 720/1080, which is
   * wrong for anything else: `FreestyleGlass` draws a 120×150 viewBox, so it
   * passes `aspect={150 / 120}`. Getting this right is what lets one
   * implementation serve both, instead of the glass drawing a rival mirror of
   * its own inside the SVG.
   */
  aspect?: number;
  /**
   * Where the object's BASE sits inside the drawn box, as a 0–1 fraction of
   * the height. 1 (default) means the drawing ends at the base, as
   * `CoffeeIcon` does. `FreestyleGlass` parks its glass base at y=112 of a
   * 150-unit viewBox and leaves the rest empty, so it passes
   * `baseFraction={112 / 150}` and the horizon, the contact line and the
   * mirror all land on the glass rather than 38 units below it.
   */
  baseFraction?: number;
  /** The active cell's glow burns at 1×; every other cell idles at 0.55×. */
  active?: boolean;
  /** Drop the mirrored copy where vertical room is genuinely absent. */
  reflection?: boolean;
  id?: string;
  className?: string;
  style?: CSSProperties;
}

/**
 * The ground treatment behind a drink: a neutral radial glow, a horizon, a
 * mirrored reflection and a contact darkening. §6.2, adopted wholesale from
 * the reference panels.
 *
 * `radial-gradient(ellipse 62% 72% at 50% 44%, var(--drink-glow), transparent
 * 70%)` sits at z-0 with the drink at z-10. The glow is NEUTRAL — cool
 * grey-white in dark, warm-neutral in light — and never accent-tinted, so
 * neighbours read as separate lit objects on a black field rather than as
 * accent chips. It terminates hard at the base; below that horizon the glass
 * throws a `scaleY(-1)` copy `--reflection-height` of its height at
 * `--reflection-alpha`, masked to nothing, plus a 1px darkening one value step
 * below `--bg`.
 *
 * THE SURFACE IS A FAMILY DECISION, and it is expressed in three tokens rather
 * than three literals: `--drink-sheen` (a cold highlight raked across the glass,
 * laid on the glow layer so it adds no painted element), `--reflection-alpha`
 * and `--reflection-height`. Obsidian stands the glass on polished stone —
 * sheen on, a strong reflection falling far; caramel stands it on matte sugar —
 * no sheen, a short faint one; cappuccino keeps the 0.28 / 0.18 it shipped.
 *
 * THIS IS THE ONLY REFLECTION IN THE APP (C29, R6). The rival was drawn inside
 * `FreestyleGlass`'s SVG with hardcoded `rgba(255,255,255,0.02)` fill and
 * `rgba(255,255,255,0.06)` stroke — a white-on-white mirror that simply
 * vanishes on the porcelain light theme, and the reason one call site had to
 * pass `reflection={false}` to stop the two colliding. Mirroring a re-render
 * of the child needs no colour of its own and is therefore correct in both
 * themes by construction; `aspect` and `baseFraction` are what it needed to
 * serve the glass as well as the icon.
 *
 * This is also what says "this cell is active": glow alpha 0.55× → 1× over
 * 250ms, replacing `--surface-card-active`, RecipeCard's `inset 0 0 0 1px`
 * selection ring and the DirectKey tiles' background swap. The drink itself
 * never carries the selected state — unanimous across every real panel
 * examined: the drink render is identity and stays invariant. Nothing here
 * tints, filters, brightens, scales or badges the glyph it wraps.
 */
export function DrinkStage({
  children,
  size = 140,
  aspect = DRINK_ASPECT,
  baseFraction = 1,
  active = false,
  reflection = true,
  id,
  className = "",
  style,
}: DrinkStageProps) {
  const reduced = usePrefersReducedMotion();

  const drawnHeight = Math.round(size * aspect);
  const clampedBase = Math.max(0, Math.min(1, baseFraction));
  /** Distance from the top of the drawn box down to the object's base. */
  const baseY = Math.round(drawnHeight * clampedBase);
  /** Empty drawing below the base, which the horizon must be pulled up over. */
  const tail = drawnHeight - baseY;

  return (
    <div
      id={id}
      data-ui="drink-stage"
      data-active={active ? "true" : "false"}
      className={["relative flex w-full flex-col items-center", className]
        .filter(Boolean)
        .join(" ")}
      style={{ borderRadius: 0, ...style }}
    >
      <div
        aria-hidden="true"
        data-ui="drink-glow"
        /** §S4.4: the only per-item modulation of the ground, and it is neutral. */
        data-fill="glow"
        className="pointer-events-none absolute"
        style={{
          left: 0,
          right: 0,
          top: 0,
          height: baseY,
          zIndex: 0,
          /*
            Two layers on ONE element: the family's cold sheen raked across the
            glass, over the neutral halo. The sheen rides this layer rather than
            adding a painted element of its own, so it stays §S4.4 imagery and
            never becomes a container fill; `none` in the warm families leaves
            the halo exactly as it shipped.
          */
          backgroundImage:
            "var(--drink-sheen), radial-gradient(ellipse 62% 72% at 50% 44%, var(--drink-glow), transparent 70%)",
          opacity: active ? 1 : 0.55,
          transition: reduced ? "none" : "opacity 250ms var(--ease)",
          borderRadius: 0,
        }}
      />

      <div className="relative" style={{ zIndex: 10, lineHeight: 0 }}>
        {children}
      </div>

      <div
        aria-hidden="true"
        data-ui="drink-contact"
        data-fill="contact"
        className="pointer-events-none"
        style={{
          width: size,
          height: 1,
          zIndex: 10,
          // Pull the horizon up over any empty drawing below the base.
          marginTop: tail === 0 ? undefined : -tail,
          backgroundImage:
            "linear-gradient(90deg, transparent, var(--drink-contact), transparent)",
          borderRadius: 0,
        }}
      />

      {reflection ? (
        <div
          aria-hidden="true"
          data-ui="drink-reflection"
          className="pointer-events-none overflow-hidden"
          style={{
            /*
              How far the drink falls is a family decision: glass on polished
              stone throws further than a matte sugar surface does. The token is
              a unitless FRACTION of the drawn base height, multiplied here in
              CSS, so nothing in JavaScript ever has to resolve a custom
              property.
            */
            // max(1px, …) keeps the mirror from rounding away to nothing on a small
            // glass, which is what the old Math.max(1, …) guarded before the
            // ratio became a token.
            height: `max(1px, calc(var(--reflection-height) * ${baseY}px))`,
            zIndex: 0,
            lineHeight: 0,
          }}
        >
          {/*
            Flip first, then translate up by the empty tail: the child's y=baseY
            lands on y=0 of this clipped strip, so the mirror hangs from the
            horizon and dies out before the name band below it.
          */}
          <div
            style={{
              transform:
                tail === 0
                  ? "scaleY(-1)"
                  : `translateY(${-tail}px) scaleY(-1)`,
              /** How strongly the surface mirrors, per family (§6.2). */
              opacity: "var(--reflection-alpha)",
              WebkitMaskImage:
                "linear-gradient(to bottom, rgba(0,0,0,0.55), transparent)",
              maskImage:
                "linear-gradient(to bottom, rgba(0,0,0,0.55), transparent)",
            }}
          >
            {children}
          </div>
        </div>
      ) : null}
    </div>
  );
}
