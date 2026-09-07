import type { CSSProperties, ReactNode } from "react";

/** §9.1: 90 ticks on a 4° pitch — one full turn. */
// The ring's geometry is TypeScript, not CSS: the tick angles are computed,
// so the numbers have to live where the maths is. index.css used to declare
// --tick-* beside these and nothing read them — one shape, one source.
export const TICK_COUNT = 90;
export const TICK_PITCH_DEG = 360 / TICK_COUNT;

/** Geometry in the ring's own units; `size` scales the whole thing uniformly. */
const OUTER_R = 67;
const INNER_R = 56;
const TICK_W = 2;
const VIEWBOX = OUTER_R * 2;

/**
 * How many ticks are lit. Exported so tests and callers agree on the boundary.
 * The advance is tick-by-tick with no tween: `Math.round`, not a fractional
 * arc, is the whole animation model.
 */
export function completedTicks(value: number, min: number, max: number): number {
  if (!(max > min)) return 0;
  const fraction = (value - min) / (max - min);
  const done = Math.round(fraction * TICK_COUNT);
  return Math.min(TICK_COUNT, Math.max(0, done));
}

export interface TickRingProps {
  value: number;
  min?: number;
  max?: number;
  /** `service` desaturates the lit ticks for maintenance programmes (§9.4). */
  tone?: "accent" | "service";
  /** Painted diameter in px. Default 134 — the reference size. */
  size?: number;
  /** The centre slot: a drink glyph at ~50px, with a wide empty moat. */
  children?: ReactNode;
  ariaLabel?: string;
  id?: string;
  className?: string;
  style?: CSSProperties;
}

/**
 * The app's ONLY progress form, and a full-screen takeover only (owner
 * decision 4 — there is no second ring size; anywhere inline, progress is the
 * segmented Meter).
 *
 * §9.1: 90 radial ticks on a 4° pitch, each 2px wide × 11px long with
 * SQUARE-CUT ends and constant width, inner radius 56 / outer 67. Fill starts
 * at exactly 12 o'clock and advances clockwise. Completed ticks are `--accent`;
 * remaining ticks are `--text-tertiary` at 0.55. The boundary is ABRUPT — no
 * gradient, no glow, no leading indicator. There is no track circle behind the
 * ticks and no numeric percentage anywhere: the ring carries the message and
 * the status word below it only names it (§7.4).
 *
 * It replaces all three of the app's old bars at once — StatusOverlay's 192×6
 * `rounded-full` capsule with its hard-coded `bg-amber-400`, BrewSection's 1px
 * hairline track, and BrewWizard's `h-2 rounded-full`.
 */
export function TickRing({
  value,
  min = 0,
  max = 100,
  tone = "accent",
  size = 134,
  children,
  ariaLabel,
  id,
  className = "",
  style,
}: TickRingProps) {
  const completed = completedTicks(value, min, max);
  const litFill = tone === "service" ? "var(--text-secondary)" : "var(--accent)";
  const centre = OUTER_R;

  return (
    <div
      id={id}
      role="progressbar"
      aria-label={ariaLabel}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      data-ui="tick-ring"
      data-completed={completed}
      data-tick-count={TICK_COUNT}
      className={["relative", className].filter(Boolean).join(" ")}
      style={{ width: size, height: size, borderRadius: 0, ...style }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
        aria-hidden="true"
        data-ui="tick-ring-svg"
      >
        {Array.from({ length: TICK_COUNT }, (_, i) => {
          const done = i < completed;
          return (
            <rect
              key={i}
              data-tick={done ? "done" : "remaining"}
              x={centre - TICK_W / 2}
              y={centre - OUTER_R}
              width={TICK_W}
              height={OUTER_R - INNER_R}
              fill={done ? litFill : "var(--text-tertiary)"}
              fillOpacity={done ? 1 : 0.55}
              transform={`rotate(${i * TICK_PITCH_DEG} ${centre} ${centre})`}
            />
          );
        })}
      </svg>
      {children === undefined ? null : (
        <div
          data-ui="tick-ring-centre"
          className="absolute inset-0 flex items-center justify-center"
        >
          {children}
        </div>
      )}
    </div>
  );
}
