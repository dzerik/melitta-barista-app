import type { CSSProperties, ReactNode } from "react";

export interface CommitProps {
  /** The verb, sentence case, already localized. */
  label: string;
  /** Fired on click. Never called while busy or disabled. */
  onCommit: () => void;
  /** §10 in-flight: the control drops to opacity 0.5 and stops accepting taps. */
  busy?: boolean;
  /**
   * The progressive verb shown while busy ("Завариваем…"). Localized by the
   * caller; without it the label simply stays put and only the opacity moves.
   */
  busyLabel?: string;
  /** §10 disabled: opacity 0.35, no pointer events, layout preserved. */
  disabled?: boolean;
  /** §7.7: `page` sets the label at `t-title`, `panel` at `t-body`. */
  scale?: "page" | "panel";
  /** Optional 18px glyph left of the verb. */
  icon?: ReactNode;
  type?: "button" | "submit";
  ariaLabel?: string;
  id?: string;
  className?: string;
  style?: CSSProperties;
}

/**
 * The one committing action on a screen: a solid `--accent` rectangle with
 * `border-radius: 0`, `min-height: var(--tap-lg)`, no shadow and no ring.
 *
 * §5.C is the whole argument. The references DO permit one saturated filled
 * shape per screen — Drankopties draws Start as a sharp-cornered orange
 * rectangle whose width and x-origin match the value tracks above it. So the
 * width here is `100%` of whatever the caller wraps it in: lock that wrapper to
 * an existing structural measure (the column's content width, or byte-identical
 * to the meter above it). Never `px-16`, never `max-w-xl mx-auto`, never a
 * percentage tuned to a carousel slide.
 *
 * Owner decision 3: the fill is `--accent` in BOTH themes — the light theme's
 * inverse near-black commit is retired — and the label rides on
 * `--text-inverse`, which is already near-black in dark and cream in light, so
 * one rule reads correctly on both grounds.
 *
 * EXACTLY ONE PER SCREEN. A second candidate action becomes a bare word with
 * an underline (an Option, or a plain `.tap` button). The rounded, shadowed,
 * `px-16`-padded slabs this replaces — RecipeGrid's `rounded-2xl` +
 * `--shadow-lift`, SommelierGenerate's `rounded-md px-16`, FreestyleSection's
 * `rounded-xl` with a hand-rolled `active:scale`, RecipeCarousel's 28%-wide
 * tracked-out amber strip — are the one thing all five reference panels agree
 * is wrong.
 */
export function Commit({
  label,
  onCommit,
  busy = false,
  busyLabel,
  disabled = false,
  scale = "page",
  icon,
  type = "button",
  ariaLabel,
  id,
  className = "",
  style,
}: CommitProps) {
  const shown = busy && busyLabel !== undefined ? busyLabel : label;
  const inert = busy || disabled;

  return (
    <button
      type={type}
      id={id}
      onClick={onCommit}
      disabled={inert}
      aria-busy={busy || undefined}
      aria-label={ariaLabel ?? shown}
      data-ui="commit"
      /** The single §5.C carve-out fill. Nothing else on the screen may paint. */
      data-fill="commit"
      data-busy={busy ? "true" : "false"}
      className={[
        "tap tap-lg press w-full gap-2",
        scale === "page" ? "t-title" : "t-body",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        backgroundColor: "var(--accent)",
        /*
          The amendment's fourth permitted gradient surface, and the ONE
          rectangle allowed to carry it. `none` in cappuccino and caramel, so
          those families keep the flat accent slab byte for byte; obsidian
          lays a brushed-metal ramp over it whose FIRST HARD STOP is the 1px
          light top edge. That edge is a stop, never a `box-shadow` — this
          language has no shadow, and the rectangle stays radius 0.
        */
        backgroundImage: "var(--commit-fill)",
        color: "var(--text-inverse)",
        minHeight: "var(--tap-lg)",
        borderRadius: 0,
        boxShadow: "none",
        /** The commit verb weighs what a chosen word weighs, per family. */
        fontWeight: "var(--w-chosen)",
        opacity: disabled ? 0.35 : busy ? 0.5 : 1,
        pointerEvents: inert ? "none" : undefined,
        ...style,
      }}
    >
      {icon ? (
        <span aria-hidden="true" style={{ display: "inline-flex" }}>
          {icon}
        </span>
      ) : null}
      <span>{shown}</span>
    </button>
  );
}
