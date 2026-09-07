import type { CSSProperties, ReactNode } from "react";

/**
 * The 80px list row shared by the settings tab and the maintenance tab.
 *
 * These two lists draw the same thing — a leading 20px mark, a label with an
 * optional quiet description under it, and a control on the right — and the
 * audit found them disagreeing on all three of its measures (C4): the label
 * was a raw `text-sm` here against `t-body` there, the gutter was `gap-3`
 * here against `gap-4` there, and the 10px hang was an inline `ROW_INSET`
 * constant here against a `px-2.5` class there. One role, one shape, declared
 * once — the same move `ParamRow` makes for the freestyle parameter rows.
 *
 * Nothing in here paints: §G2.7 separates rows with a single 1px `--border`
 * hairline and nothing else. No zebra, no grouping box, no card, no radius.
 */

/** §G2.7 row pitch: one setting is one 80px row. */
export const ROW_MIN_H = "80px";

/**
 * The 12px gutter between the row's mark, its label block and its control.
 * 12px is the survivor of C4's `gap-3` / `gap-4` split: it is the step the
 * field research pairs with a 20px mark, and it is what every row list in the
 * settings tab already used.
 */
export const ROW_GUTTER = "gap-3";

/**
 * The row label — `t-body` at weight 500, one of the four type steps (§7.1).
 * Never the raw 14px `text-sm` that used to sit here (H5): a fifth size off
 * the settled scale, for the one role that repeats most in the app.
 */
export const ROW_LABEL_CLASS = "t-body font-medium text-primary";

/** The quiet second line under a row label (§7.3 — captions and quiet meta). */
export const ROW_DESC_CLASS = "t-label text-tertiary leading-tight";

/**
 * One row's frame: the opening hairline, the 80px pitch and the §G2.1 10px
 * hang on both sides — spelled with the shared `--hang` token, which is the
 * whole of C23 for this list.
 *
 * `stagger` is the arrival delay for the `settings-card-enter` animation and
 * is the caller's index in the flattened row order.
 */
export function settingsRowStyle(index: number): CSSProperties {
  return {
    animationDelay: `${index * 60}ms`,
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: "var(--border)",
    borderRadius: 0,
    minHeight: ROW_MIN_H,
    paddingLeft: "var(--hang)",
    paddingRight: "var(--hang)",
  };
}

export interface RowHeadingProps {
  label: string;
  /** Omit or pass null to drop the second line entirely (§9.1.6 rule 3). */
  description?: string | null;
  children?: ReactNode;
}

/** The label block of a row: identity on top, quiet description beneath. */
export function RowHeading({ label, description }: RowHeadingProps) {
  return (
    <div className="flex-1 min-w-0">
      <div className={ROW_LABEL_CLASS}>{label}</div>
      {description !== null && description !== undefined && (
        <div className={`${ROW_DESC_CLASS} mt-0.5`}>{description}</div>
      )}
    </div>
  );
}
