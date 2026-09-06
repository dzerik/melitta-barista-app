import type { CSSProperties, ReactNode } from "react";

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
 * word plus a reserved 1px underline slot. Chosen = `--text-primary` at weight
 * 600 with the underline lit in `--accent`; unchosen = `--text-secondary` with
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
  const underlineWidth = level === "nav" ? 2 : 1;

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
        "tap press t-body gap-2",
        level === "nav" ? "tap-lg" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        color: selected ? "var(--text-primary)" : "var(--text-secondary)",
        fontWeight: selected ? 600 : 400,
        borderBottomWidth: `${underlineWidth}px`,
        borderBottomStyle: "solid",
        borderBottomColor: selected ? "var(--accent)" : "transparent",
        borderRadius: 0,
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
    </button>
  );
}
