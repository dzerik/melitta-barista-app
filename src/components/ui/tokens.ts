import type { CSSProperties } from "react";

/**
 * The measures the primitives share, each declared exactly ONCE.
 *
 * Every value here is a `var(--…)` reference rather than a literal, so the
 * declaration in `src/index.css` is the single source of truth and a token is
 * never "nearly orphaned" again (C24). If you find yourself typing `"1px"`,
 * `"calc(var(--rail) + 10px)"` or `"var(--input-border)"` into a component,
 * the constant you wanted is in this file.
 */

/* ── The underline slot (§C3.1, §C3.2, owner decision 1) ────────────────── */

/** Value / option level. Mirrors `--underline-w`. */
export const UNDERLINE_W = "var(--underline-w)";
/** Navigation / tab level. Mirrors `--underline-w-nav`. */
export const UNDERLINE_W_NAV = "var(--underline-w-nav)";

/**
 * The same two measures as resolved pixels. They exist ONLY for the `literal`
 * escape below and must be changed together with the CSS declarations.
 */
export const UNDERLINE_W_PX = 1;
export const UNDERLINE_W_NAV_PX = 2;

export interface UnderlineSlotOptions {
  /**
   * Emit `"1px"` / `"2px"` instead of the `var()` reference.
   *
   * Wanted by nobody, needed by one caller: `Option` is asserted through
   * `el.style.borderBottomWidth === "1px"` by tests that live outside this
   * directory (`tests/preferences.test.tsx`, and the on/off comparison in
   * `tests/settings-section.tsx`), and jsdom stores a `var()` reference
   * verbatim rather than resolving it. Rather than let `Option` keep a private
   * literal — which is exactly the drift C24 names — the decision lives here,
   * in one place, with the reason attached. Flip the caller and that one
   * assertion together and this option can be deleted.
   */
  literal?: boolean;
}

/**
 * The reserved underline slot: always declared, inked only when chosen, so
 * selection never shifts a pixel of layout.
 *
 * This is the ONLY way an underline is written in this app. `--underline-w`
 * was honoured at five sites and spelled `"1px"` by hand at fifteen others
 * (C24) because there was nowhere to put the decision; it is here now.
 *
 * An ACTION never calls this. An underline says "chosen" in this language, so
 * a word that performs rather than selects wears none — that is why `Word`
 * has no underline at all and no prop to grow one.
 */
export function underlineSlot(
  lit: boolean,
  level: "option" | "nav" = "option",
  { literal = false }: UnderlineSlotOptions = {},
): CSSProperties {
  const nav = level === "nav";
  return {
    borderBottomWidth: literal
      ? `${nav ? UNDERLINE_W_NAV_PX : UNDERLINE_W_PX}px`
      : nav
        ? UNDERLINE_W_NAV
        : UNDERLINE_W,
    borderBottomStyle: "solid",
    borderBottomColor: lit ? "var(--accent)" : "transparent",
    borderRadius: 0,
  };
}

/**
 * The material a family paints ON the lit underline — the amendment's third
 * permitted gradient surface. `none` in cappuccino and caramel, where the flat
 * `--accent` border the slot already reserves shows through untouched.
 */
export const UNDERLINE_FILL = "var(--underline-fill)";

/**
 * The 1px (2px at nav level) strip that carries `--underline-fill` over the
 * reserved border, for the ONE state that may show it: chosen.
 *
 * It is a second element rather than a `background-image` on the control
 * because a border cannot hold a gradient, and it is laid OVER the border
 * rather than replacing it so `borderBottomColor === "var(--accent)"` — the
 * contract five test files assert and every flat family renders — is never
 * disturbed. A family whose fill must not be backlit by the accent underneath
 * carries its own opaque ground layer inside the token (obsidian does exactly
 * that); a family with `none` paints nothing at all and the strip is invisible.
 *
 * The strip is positioned against the control's PADDING box, so it is pushed
 * down by exactly the underline's own width to land on the border it covers,
 * and it occupies precisely `--underline-w` (`--underline-w-nav`) — the same
 * measure `underlineSlot` reserves in both states, so a gradient underline
 * shifts no more layout than a flat one does.
 *
 * The caller must be a positioned ancestor, and must render this ONLY when
 * chosen: an unchosen word reserves its slot with a transparent border and
 * paints nothing, in every family.
 */
export function underlineFill(level: "option" | "nav" = "option"): CSSProperties {
  const w = level === "nav" ? UNDERLINE_W_NAV : UNDERLINE_W;
  return {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: `calc(-1 * ${w})`,
    height: w,
    backgroundImage: UNDERLINE_FILL,
    borderRadius: 0,
    pointerEvents: "none",
  };
}

/* ── The input rule (§R1.6, C6) ─────────────────────────────────────────── */

/**
 * The ONE hairline colour under every text and number field in the app.
 * `--border` and `--border-hover` are content dividers; an input's rule is the
 * line you write on and it has its own token in both themes.
 */
export const INPUT_RULE = "var(--input-border)";

/* ── The 10px text hang (§G2.1, C23) ────────────────────────────────────── */

/**
 * First text pixel measured from the viewport edge: the rail the rules span,
 * plus the 10px the content hangs inside it.
 */
export const RAIL_TEXT = "calc(var(--rail) + var(--hang))";

/**
 * The same hang, spelled for content that already sits inside a rail-padded
 * parent. Replaces the bare `"10px"`, the `ROW_INSET` constant and `px-2.5`.
 */
export const HANG = "var(--hang)";

/* ── Panel gutters (§5.B, C7/C8) ────────────────────────────────────────── */

/** The one horizontal gutter a panel header and its action band share. */
export const PANEL_PAD = "var(--panel-pad)";

/* ── Imagery (§6.1, §6.3, §6.6) ─────────────────────────────────────────── */

/** CoffeeIcon draws at 1080×720: a drawn drink is 2/3 as tall as it is wide. */
export const DRINK_ASPECT = 720 / 1080;

/** §6.3 truth scale — a glass never shrinks past 0.55× or grows past 1.0×. */
export const TRUTH_FLOOR = 0.55;
export const TRUTH_CEIL = 1;

/**
 * Where no `total_ml` / IconSpec is served there is no truth to scale to, so
 * the drink renders at a fixed 0.80× rather than pretending to be the largest
 * thing on the shelf (§6.3).
 */
export const TRUTH_UNSERVED = 0.8;

/**
 * §6.3: a 0–1 magnitude against the row's maximum, mapped onto the permitted
 * scale band. Exported so the icon, the stat tile and the tests all agree.
 */
export function truthScale(fraction: number): number {
  const f = Math.max(0, Math.min(1, Number.isFinite(fraction) ? fraction : 0));
  return TRUTH_FLOOR + (TRUTH_CEIL - TRUTH_FLOOR) * f;
}

/* ── Numerals (C25) ─────────────────────────────────────────────────────── */

/**
 * The canonical way to say "tabular". `.num` is the app's own utility and the
 * only spelling; the raw Tailwind `tabular-nums` utility is retired.
 */
export const NUM = "num";
