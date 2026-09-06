import type { CSSProperties, ReactNode } from "react";

export interface OptionRowProps {
  /** The Options themselves. */
  children: ReactNode;
  /** Quiet caption in the fixed left column. Omit for a bare glyph cluster. */
  label?: string;
  /** The 1px `--border` hairline that opens the row. Default true. */
  rule?: boolean;
  /** Use `radiogroup` when the Options inside carry `role="radio"`. */
  role?: "group" | "radiogroup";
  /** Accessible name for the group; falls back to `label`. */
  ariaLabel?: string;
  /** Width of the caption column. Default `7rem` (the old `w-28`). */
  labelWidth?: string;
  id?: string;
  className?: string;
  style?: CSSProperties;
}

/**
 * A labelled row of Options: one hairline, one quiet caption column, then the
 * words. §C1 and §G2.7 — rows are separated by a 1px `--border` rule and
 * nothing else. No zebra, no grouping box, no card, no fill, no radius, and no
 * container drawn around the option cluster itself.
 *
 * The options wrap on `gap-y-1` and stay baseline-aligned with the caption, so
 * a long Russian label list flows to a second line without the row growing a
 * scrollbar or the caption drifting off the first word's baseline.
 *
 * This replaces every settings "card" (`rounded-2xl p-4 ring-1` over
 * `--surface-card`, with a second `--surface-card-active` fill for the changed
 * state) — the app's canonical two-axis fill+ring state model. Changed state
 * now lives in the VALUE's colour, not in the row's background.
 */
export function OptionRow({
  children,
  label,
  rule = true,
  role,
  ariaLabel,
  labelWidth = "7rem",
  id,
  className = "",
  style,
}: OptionRowProps) {
  return (
    <div
      id={id}
      role={role}
      aria-label={role ? (ariaLabel ?? label) : ariaLabel}
      data-ui="option-row"
      className={["flex flex-wrap items-baseline gap-x-6 gap-y-1", className]
        .filter(Boolean)
        .join(" ")}
      style={{
        borderTopWidth: rule ? "1px" : "0px",
        borderTopStyle: "solid",
        borderTopColor: "var(--border)",
        borderRadius: 0,
        ...style,
      }}
    >
      {label === undefined ? null : (
        <span
          data-ui="option-row-label"
          className="t-label text-tertiary shrink-0"
          style={{ width: labelWidth }}
        >
          {label}
        </span>
      )}
      <div className="flex flex-wrap items-baseline gap-x-6">{children}</div>
    </div>
  );
}
