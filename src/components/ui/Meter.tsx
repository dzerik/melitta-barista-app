import type { CSSProperties } from "react";

export type MeterTone = "accent" | "quiet";

/**
 * How many segments are painted for a value. Exported so a caller can align
 * something to the fill boundary and so tests can pin the arithmetic.
 *
 * For an ENUMERATED scale pass `segments = tokenCount`, `max = tokenCount`,
 * `value = chosenIndex + 1` — the maths is then exact, one segment per token.
 * For a CONTINUOUS value leave `segments` at its default 12.
 */
export function filledSegments(
  value: number,
  min: number,
  max: number,
  segments: number,
): number {
  if (!(max > min) || segments <= 0) return 0;
  const fraction = (value - min) / (max - min);
  const filled = Math.round(fraction * segments);
  return Math.min(segments, Math.max(0, filled));
}

export interface MeterProps {
  value: number;
  min?: number;
  max?: number;
  /** Number of square-cut segments. Default 12 (the continuous case). */
  segments?: number;
  /** `quiet` desaturates the fill for service/maintenance readouts (§9.4). */
  tone?: MeterTone;
  role?: "meter" | "progressbar";
  ariaLabel?: string;
  /** Set when a real control (MeterField's range input) owns the semantics. */
  ariaHidden?: boolean;
  id?: string;
  className?: string;
  style?: CSSProperties;
}

const SEGMENT_FILL: Record<MeterTone, string> = {
  accent: "var(--accent)",
  quiet: "var(--text-secondary)",
};

/**
 * The horizontal segmented value/progress indicator — the only filled
 * indicator in the app besides the commit rectangle, and the only inline
 * progress form (owner decision 4: the tick ring is a full-screen takeover
 * only, and there is no second ring size).
 *
 * §9.2 and §C-Numeric: `--meter-h` tall, N segments of equal width separated by
 * `--meter-gap` of bare ground, every end square-cut, `border-radius: 0`
 * throughout. Filled segments are `--accent`, empty are `--meter-empty`. There
 * is NO track, NO capsule, NO thumb, NO handle, NO shadow and NO numeric
 * readout on the bar — the number lives in the label row above it, and the
 * paint IS the value, which is why §5.D lets it be painted at all.
 *
 * This replaces every `rounded-full` slider track with its `rounded-full
 * shadow-lg` 16px thumb (FreestyleSection, RecipeEditModal, SettingsSection)
 * and every capsule progress bar (StatusOverlay's 192×6, BrewSection's
 * hairline, BrewWizard's `h-2`).
 */
export function Meter({
  value,
  min = 0,
  max = 100,
  segments = 12,
  tone = "accent",
  role = "meter",
  ariaLabel,
  ariaHidden = false,
  id,
  className = "",
  style,
}: MeterProps) {
  const filled = filledSegments(value, min, max, segments);

  return (
    <div
      id={id}
      role={ariaHidden ? undefined : role}
      aria-hidden={ariaHidden ? "true" : undefined}
      aria-label={ariaHidden ? undefined : ariaLabel}
      aria-valuenow={ariaHidden ? undefined : value}
      aria-valuemin={ariaHidden ? undefined : min}
      aria-valuemax={ariaHidden ? undefined : max}
      data-ui="meter"
      data-segments={segments}
      data-filled={filled}
      className={["flex w-full", className].filter(Boolean).join(" ")}
      style={{
        height: "var(--meter-h)",
        columnGap: "var(--meter-gap)",
        borderRadius: 0,
        // A meter that runs the full width of a settings row reads as a rule,
        // not as a quantity. A caller sets --meter-max on any ancestor to give
        // it a measure; unset, it still spans its container.
        maxWidth: "var(--meter-max, none)",
        marginLeft: "auto",
        ...style,
      }}
    >
      {Array.from({ length: segments }, (_, i) => (
        <span
          key={i}
          aria-hidden="true"
          /** §5.D: the fill IS the value, not a container tint. */
          data-fill="meter"
          data-segment={i < filled ? "filled" : "empty"}
          style={{
            flex: "1 1 0%",
            backgroundColor:
              i < filled ? SEGMENT_FILL[tone] : "var(--meter-empty)",
            borderRadius: 0,
          }}
        />
      ))}
    </div>
  );
}

export interface MeterFieldProps {
  /** The parameter's name, already localized. */
  label: string;
  value: number;
  max: number;
  min?: number;
  step?: number;
  onChange: (value: number) => void;
  segments?: number;
  /**
   * The formatted readout for the label row — "120 ml", "3", a token name.
   * Localized and unit-suffixed by the caller; defaults to the bare number.
   */
  displayValue?: string;
  /** §10 dirty/changed: the VALUE turns `--accent`; the row does not move. */
  changed?: boolean;
  disabled?: boolean;
  tone?: MeterTone;
  /**
   * Bare − / + glyphs flanking the meter, each in its own 48px reach. Pass the
   * localized accessible names; omit the prop to leave them off.
   */
  steppers?: { decrement: string; increment: string };
  ariaLabel?: string;
  id?: string;
  className?: string;
  style?: CSSProperties;
}

function StepperGlyph({ sign }: { sign: "minus" | "plus" }) {
  return (
    <svg width={10} height={10} viewBox="0 0 10 10" aria-hidden="true">
      <line x1={0} y1={5} x2={10} y2={5} stroke="currentColor" strokeWidth={2} />
      {sign === "plus" ? (
        <line x1={5} y1={0} x2={5} y2={10} stroke="currentColor" strokeWidth={2} />
      ) : null}
    </svg>
  );
}

/**
 * The complete §C-Numeric control: a label row carrying the readout, the
 * segmented Meter beneath it, and a native `<input type="range">` laid over the
 * paint at `opacity: 0` so drag, arrow keys and screen readers keep working
 * while the meter does all the drawing. That input is why the 48px reach
 * survives a 6px-tall indicator.
 *
 * The readout lives in the label row (right-aligned, tabular, bold), never on
 * the track — FreestyleSection already had this structure right and only the
 * shape was wrong. Optional bare − / + glyphs flank the meter with no circle,
 * no box and no divider around them.
 */
export function MeterField({
  label,
  value,
  max,
  min = 0,
  step = 1,
  onChange,
  segments = 12,
  displayValue,
  changed = false,
  disabled = false,
  tone = "accent",
  steppers,
  ariaLabel,
  id,
  className = "",
  style,
}: MeterFieldProps) {
  const clamp = (next: number) => Math.min(max, Math.max(min, next));

  return (
    <div
      id={id}
      data-ui="meter-field"
      data-changed={changed ? "true" : "false"}
      className={["space-y-1.5", className].filter(Boolean).join(" ")}
      style={{
        opacity: disabled ? 0.35 : 1,
        pointerEvents: disabled ? "none" : undefined,
        borderRadius: 0,
        ...style,
      }}
    >
      <div className="flex items-baseline justify-between">
        <span className="t-label text-primary">{label}</span>
        <span
          data-ui="meter-field-value"
          className="t-label num"
          style={{
            fontWeight: 600,
            color: changed ? "var(--accent)" : "var(--text-primary)",
          }}
        >
          {displayValue ?? String(value)}
        </span>
      </div>

      <div className="flex items-center gap-3">
        {steppers ? (
          <button
            type="button"
            className="tap press shrink-0"
            aria-label={steppers.decrement}
            disabled={disabled || value <= min}
            onClick={() => onChange(clamp(value - step))}
            style={{
              color: "var(--text-primary)",
              borderRadius: 0,
              opacity: value <= min ? 0.35 : 1,
            }}
          >
            <StepperGlyph sign="minus" />
          </button>
        ) : null}

        <div className="relative flex-1">
          <Meter
            value={value}
            min={min}
            max={max}
            segments={segments}
            tone={tone}
            ariaHidden
          />
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            disabled={disabled}
            aria-label={ariaLabel ?? label}
            onChange={(e) => onChange(Number(e.target.value))}
            data-ui="meter-driver"
            className="absolute left-0 w-full"
            style={{
              top: "50%",
              transform: "translateY(-50%)",
              height: "var(--tap)",
              opacity: 0,
              margin: 0,
              cursor: "pointer",
            }}
          />
        </div>

        {steppers ? (
          <button
            type="button"
            className="tap press shrink-0"
            aria-label={steppers.increment}
            disabled={disabled || value >= max}
            onClick={() => onChange(clamp(value + step))}
            style={{
              color: "var(--text-primary)",
              borderRadius: 0,
              opacity: value >= max ? 0.35 : 1,
            }}
          >
            <StepperGlyph sign="plus" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
