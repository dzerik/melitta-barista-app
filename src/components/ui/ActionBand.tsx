import type { CSSProperties, ReactNode } from "react";
import { Rule } from "./Rule";
import { HANG, PANEL_PAD } from "./tokens";

export type ActionBandInset = "panel" | "rail" | "none";

export interface ActionBandProps {
  /**
   * The screen's ONE commit rectangle — a `<Commit>`. It takes the band's
   * remaining width, which is what locks the rectangle to a structural measure
   * instead of to padding (§5.C).
   */
  commit?: ReactNode;
  /**
   * Every other action on the screen, as `<Word>`s. They sit left of the
   * commit, shrink-to-fit, in reading order.
   */
  secondary?: ReactNode;
  /**
   * The 2px `--accent` rule that opens the band (§8.3) — the app's strongest
   * single graphic gesture and the one place an accent rule is justified.
   * Default true; drop it only where the band is already the bottom of a
   * `Panel` that has its own closing structure.
   */
  rule?: boolean;
  /**
   * `panel` gutters match a `Panel`'s header; `rail` hangs the band on the
   * page rail like every other full-width structure; `none` leaves the
   * measure to the caller's wrapper.
   */
  inset?: ActionBandInset;
  id?: string;
  className?: string;
  style?: CSSProperties;
}

const GUTTER: Record<ActionBandInset, string | undefined> = {
  panel: PANEL_PAD,
  rail: `calc(var(--rail) + ${HANG})`,
  none: undefined,
};

/**
 * The one arrangement for every screen that commits (C10).
 *
 * A 2px `--accent` rule, then a single row: the secondary words first at their
 * intrinsic width, the commit rectangle taking everything that is left. That
 * is one layout, not three — the audit found the same band drawn as a
 * right-aligned word ABOVE a full-width commit, as a word BESIDE a commit, and
 * as a commit with no rule at all, with three of six screens carrying no rule
 * whatsoever.
 *
 * The commit's width comes from this row, never from its own padding: that is
 * the whole of §5.C's "width locked to an existing structural measure". Put
 * exactly one `<Commit>` in here and any number of `<Word>`s; a second commit
 * on the same screen is the accent-budget breach §8.2 is written to prevent.
 */
export function ActionBand({
  commit,
  secondary,
  rule = true,
  inset = "panel",
  id,
  className = "",
  style,
}: ActionBandProps) {
  const gutter = GUTTER[inset];

  return (
    <div
      id={id}
      data-ui="action-band"
      className={["flex shrink-0 flex-col", className].filter(Boolean).join(" ")}
      style={{ borderRadius: 0, ...style }}
    >
      {rule ? <Rule weight={2} tone="accent" /> : null}
      <div
        data-ui="action-band-row"
        className="flex items-center gap-6 py-4"
        style={{ paddingLeft: gutter, paddingRight: gutter }}
      >
        {secondary ? (
          <div
            data-ui="action-band-secondary"
            className="flex shrink-0 items-center gap-6"
          >
            {secondary}
          </div>
        ) : null}
        {commit ? (
          <div data-ui="action-band-commit" className="min-w-0 flex-1">
            {commit}
          </div>
        ) : null}
      </div>
    </div>
  );
}
