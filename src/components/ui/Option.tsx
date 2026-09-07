import type { CSSProperties, ReactNode } from "react";
import { underlineFill, underlineSlot } from "./tokens";

export type OptionLevel = "option" | "nav";
export type OptionRole = "button" | "radio";

export interface OptionProps {
  /** The word the user reads and chooses. Must already be localized. */
  label: string;
  /** Whether this is the chosen word in its row. */
  selected: boolean;
  /** Fired on click. Never called while `disabled`. */
  onSelect: () => void;
  /** §10: opacity 0.35, no pointer events, and the row keeps its space. */
  disabled?: boolean;
  /**
   * An optional 18–20px lucide glyph, drawn to the LEFT of the word. The
   * underline runs under the glyph+word pair, so pass the glyph here rather
   * than rendering it beside an Option.
   */
  icon?: ReactNode;
  /** Hide the word and keep it as the accessible name (glyph-only clusters). */
  hideLabel?: boolean;
  /** `option` = 1px underline (value level). `nav` = 2px (tab level). */
  level?: OptionLevel;
  /**
   * `button` emits `aria-pressed`; `radio` emits `role="radio"` +
   * `aria-checked` so an existing radiogroup test contract survives the
   * rebuild. Pick `radio` only inside an OptionRow with `role="radiogroup"`.
   */
  role?: OptionRole;
  /** Overrides the accessible name when the visible word is not enough. */
  ariaLabel?: string;
  title?: string;
  id?: string;
  className?: string;
  style?: CSSProperties;
}

/**
 * One selectable word — the app's only single-choice control.
 *
 * Embodies the owner's first binding decision and §C3.1–C3.3: a control is a
 * word plus a reserved 1px underline slot. Chosen = `--text-primary` at
 * `--w-chosen` with the underline lit in `--accent` (and, where the family
 * paints one, a `--underline-fill` strip laid over it); unchosen =
 * `--text-secondary` at `--w-body` with
 * the same underline declared `transparent`, so selection never shifts a
 * single pixel of layout. Accent TEXT is deliberately NOT used for the chosen
 * word — that ink is reserved for the label half of a value pair and for
 * position marks (decision 1), which is what keeps accent under 2% of a screen.
 *
 * The old shapes are gone because they spent container vocabulary on the least
 * important thing: SegmentPicker's `rounded-xl ring-1` capsule bar, the
 * `--surface-card` fill that marked an active view mode, the hand-rolled pill
 * switch in SettingsSection, and the `<select>` for five-or-fewer choices. Not
 * one real machine panel draws a selected state as a filled box; every one of
 * them draws it as the same mark in a brighter value.
 */
export function Option({
  label,
  selected,
  onSelect,
  disabled = false,
  icon,
  hideLabel = false,
  level = "option",
  role = "button",
  ariaLabel,
  title,
  id,
  className = "",
  style,
}: OptionProps) {
  const ariaState =
    role === "radio"
      ? ({ role: "radio", "aria-checked": selected } as const)
      : ({ "aria-pressed": selected } as const);

  return (
    <button
      type="button"
      id={id}
      title={title}
      onClick={onSelect}
      disabled={disabled}
      aria-label={ariaLabel ?? label}
      aria-current={level === "nav" && selected ? "page" : undefined}
      data-ui="option"
      data-level={level}
      data-selected={selected ? "true" : "false"}
      /** The visual contract other tests assert on: the slot is always there. */
      data-underline={selected ? "lit" : "reserved"}
      className={[
        // `relative` positions the material strip below against this box, and
        // costs nothing when the family paints none.
        "tap press t-body gap-2 relative",
        level === "nav" ? "tap-lg" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        color: selected ? "var(--text-primary)" : "var(--text-secondary)",
        /*
          Weight is a theme axis now. Cappuccino and caramel still say "chosen"
          with a heavier word (600 / 700); obsidian deliberately does not —
          it holds body and chosen a notch apart at 300/400 and lets colour and
          the lit underline carry the whole state, which is why this reads a
          token instead of the two literals it used to spell.
        */
        fontWeight: selected ? "var(--w-chosen)" : "var(--w-body)",
        // `literal` only because two tests outside components/ui assert the
        // resolved "1px"; the measure itself lives in tokens.ts / index.css.
        ...underlineSlot(selected, level, { literal: true }),
        opacity: disabled ? 0.35 : 1,
        pointerEvents: disabled ? "none" : undefined,
        // A nav underline sits ON the row's rule rather than under it.
        marginBottom: level === "nav" ? "-1px" : undefined,
        ...style,
      }}
      {...ariaState}
    >
      {icon ? (
        <span
          aria-hidden="true"
          data-ui="option-icon"
          style={{
            display: "inline-flex",
            color: selected ? "var(--text-primary)" : "var(--text-tertiary)",
            opacity: selected ? 1 : 0.5,
          }}
        >
          {icon}
        </span>
      ) : null}
      {hideLabel ? null : <span>{label}</span>}
      {selected ? (
        <span
          aria-hidden="true"
          data-ui="option-underline"
          /** The amendment's third permitted gradient surface (§C3.1). */
          data-fill="underline"
          style={underlineFill(level)}
        />
      ) : null}
    </button>
  );
}
