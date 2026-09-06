import type { CSSProperties, ReactNode } from "react";
import { usePrefersReducedMotion } from "./reduced-motion";

/** CoffeeIcon draws at 1080×720, so a drawn drink is 2/3 as tall as it is wide. */
const ICON_ASPECT = 720 / 1080;
/** §6.2: the mirrored copy is 18% of the glass's height. */
const REFLECTION_RATIO = 0.18;

export interface DrinkStageProps {
  /** The drink itself — a `<CoffeeIcon />`. Rendered twice: once upright, once mirrored. */
  children: ReactNode;
  /** The CoffeeIcon's `size` (its WIDTH). Drives the glow and reflection heights. */
  size?: number;
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
 * mirrored reflection and a contact darkening. §6.2, adopted wholesale from the
 * reference panels, and new to this app.
 *
 * `radial-gradient(ellipse 62% 72% at 50% 44%, var(--drink-glow), transparent
 * 70%)` sits at z-0 with the drink at z-10. The glow is NEUTRAL — cool
 * grey-white in dark, warm-neutral in light — and never accent-tinted, so
 * neighbours read as separate lit objects on a black field rather than as
 * accent chips. It terminates hard at the glass base; below that horizon the
 * glass throws a `scaleY(-1)` copy 18% of its height at `opacity: 0.28`, masked
 * to nothing, plus a 1px darkening one value step below `--bg`.
 *
 * This is what says "this cell is active": glow alpha 0.55× → 1× over 250ms,
 * which is precisely what replaces `--surface-card-active`, RecipeCard's
 * `inset 0 0 0 1px` selection ring and the DirectKey tiles' two-value
 * background swap. It is also the whole reason the drink itself never carries
 * the selected state — unanimous across every real panel examined: the drink
 * render is identity and stays invariant. Nothing here tints, filters,
 * brightens, scales or badges the glyph it wraps.
 */
export function DrinkStage({
  children,
  size = 140,
  active = false,
  reflection = true,
  id,
  className = "",
  style,
}: DrinkStageProps) {
  const reduced = usePrefersReducedMotion();
  const drawnHeight = Math.round(size * ICON_ASPECT);
  const reflectionHeight = Math.max(1, Math.round(drawnHeight * REFLECTION_RATIO));

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
          height: drawnHeight,
          zIndex: 0,
          backgroundImage:
            "radial-gradient(ellipse 62% 72% at 50% 44%, var(--drink-glow), transparent 70%)",
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
          style={{ height: reflectionHeight, zIndex: 0, lineHeight: 0 }}
        >
          {/*
            Default transform-origin (50% 50%) maps the glass base to the top of
            this clipped strip, so the mirror hangs from the horizon and dies out
            before the name band below it.
          */}
          <div
            style={{
              transform: "scaleY(-1)",
              opacity: 0.28,
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
