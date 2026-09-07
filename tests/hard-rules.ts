import { expect } from "vitest";

/**
 * THE TWO HARD RULES, IN ONE PLACE.
 *
 * Six test files had each grown their own copy of this walk, and the copies had
 * drifted on the one question that decides whether a fill is a violation:
 * three exempted `background-color: transparent` and three did not. That is not
 * a matter of taste — `transparent` is the DECLARATION that an element does not
 * paint (the underline input states it explicitly so no user-agent field
 * background can leak in), so counting it as a fill would have made the app's
 * one input form illegal while the three lenient copies passed. Transparent is
 * the absence of a fill; it is legal, and it is legal here for everyone.
 *
 * The rules, restated:
 *   L1  border-radius 0 on every rectangle. The only curves are true circles —
 *       an element that says `data-shape="circle"` or that is exactly as wide
 *       as it is tall — and contours drawn inside an SVG, which this walk never
 *       sees as a radius.
 *   L2  no background fill on a container or control outside the carve-outs,
 *       and a carve-out must NAME itself with `data-fill`. An undeclared paint
 *       is a violation even when it happens to be a legal colour, because
 *       `data-fill` is the audit surface the whole inventory is queried through
 *       (C21).
 * Plus the treatments the language retired outright: rings, shadows, tracked-out
 * caps, `backdrop-blur` anywhere but a scrim, and the raw `tabular-nums`
 * utility, which `.num` replaced (C25).
 */

/**
 * The complete fill inventory. Every value here is one of §5's carve-outs or a
 * mark whose paint IS its meaning:
 *
 *   commit   the one solid rectangle/circle per screen (§5.C)
 *   panel    the one flat `--surface` panel per modal (§5.B)
 *   scrim    the wash that removes the page under a modal (§5.A)
 *   meter    a value meter's filled segments and its empty ground (§5.D)
 *   dot      a position mark — pager dot, intensity bead, leader mark (§8.1c)
 *   glow     the neutral halo behind a drink (§6.2)
 *   contact  the 1px contact darkening under a glass base (§6.2)
 *   rule     a hairline, and the 1px-gap mosaic ground a grid shows through
 *   underline the amendment's FOURTH permitted gradient surface (2026-09-07):
 *            the lit selection underline, which a family may paint with
 *            `--underline-fill` as a 1px strip over the accent border the slot
 *            already reserves. It is named apart from `rule` because it is a
 *            STATE — it exists only while a word is chosen — and because
 *            selection is still the word plus a lit line, never a fill.
 *   ground   a mosaic CELL repainting the page ground (§S4.1/§S4.3) — held to
 *            exactly `var(--bg)` below, so it can never become a licence for a
 *            tint
 *   magnitude the §5.D value tint: a proportional wash whose HEIGHT is the
 *            quantity. It is named apart from `glow` because a glow is the
 *            neutral halo behind a drink and this one is accent-coloured — a
 *            query for neutral halos must not return an accent block.
 */
export const CARVE_OUTS: ReadonlySet<string> = new Set([
  "commit",
  "panel",
  "scrim",
  "meter",
  "dot",
  "glow",
  "contact",
  "rule",
  "underline",
  "ground",
  "magnitude",
]);

export interface HardRuleOptions {
  /**
   * Narrow the allowlist. A tab body, for instance, is ground only — §5.B's
   * flat panel is a modal privilege — so the settings surface asserts against
   * `["commit", "meter", "rule"]` rather than the full inventory. Widening it
   * past `CARVE_OUTS` is not a thing any surface may do: a fill the language
   * does not have is a violation wherever it is drawn.
   */
  fills?: Iterable<string>;
}

/** A class attribute that works for HTML and SVG alike (`className` on an SVG
 *  element is an SVGAnimatedString and stringifies to `[object …]`). */
function classOf(el: Element): string {
  return el.getAttribute("class") ?? "";
}

/**
 * Walk a rendered tree and report every breach of the two hard rules, as
 * human-readable strings. Descendants of `root` are inspected; `root` itself is
 * the test harness's own container and is not.
 *
 * Returns an empty array when the tree is clean, so a caller can assert with
 * `expect(hardRuleViolations(container)).toEqual([])` and read the whole list
 * of what is wrong in one failure rather than one item at a time.
 */
export function hardRuleViolations(
  root: HTMLElement,
  options: HardRuleOptions = {},
): string[] {
  const legal = options.fills ? new Set(options.fills) : CARVE_OUTS;
  const found: string[] = [];

  for (const el of Array.from(root.querySelectorAll<HTMLElement>("*"))) {
    const cls = classOf(el);
    const style = el.style ?? ({} as CSSStyleDeclaration);
    const where = `${el.tagName.toLowerCase()}${cls ? `.${cls}` : ""}`;

    // ── L1: no curve that is not a circle ────────────────────────────────
    if (/(^|\s)rounded/.test(cls)) found.push(`rounded class on ${where}`);
    const radius = style.borderRadius ?? "";
    if (radius !== "" && radius !== "0px" && radius !== "0") {
      const circle =
        el.getAttribute("data-shape") === "circle" ||
        (style.width !== "" && style.width === style.height);
      if (radius !== "50%" || !circle) {
        found.push(
          `radius ${radius} on ${where} — only a true circle (data-shape="circle" ` +
            `or width === height) may curve`,
        );
      }
    }

    // ── L2: no fill that has not declared itself ─────────────────────────
    const bg = style.backgroundColor ?? "";
    // `transparent` is the absence of a fill, stated out loud. Not a fill.
    const paints = (bg !== "" && bg !== "transparent") || (style.backgroundImage ?? "") !== "";
    const declared = el.getAttribute("data-fill");
    if (paints && (declared === null || !legal.has(declared))) {
      found.push(`undeclared fill on ${where} → data-fill=${declared ?? "(none)"}`);
    }
    if (declared === "ground" && bg !== "var(--bg)") {
      found.push(`"ground" fill on ${where} that is not the page ground: ${bg}`);
    }

    // ── The retired treatments ───────────────────────────────────────────
    if (/(^|\s)ring-/.test(cls)) found.push(`ring class on ${where}`);
    if (/(^|\s)shadow-/.test(cls)) found.push(`shadow class on ${where}`);
    const shadow = style.boxShadow ?? "";
    if (shadow !== "" && shadow !== "none") found.push(`box-shadow on ${where}: ${shadow}`);
    if (/(^|\s)tracking-/.test(cls)) found.push(`tracking class on ${where}`);
    if (/(^|\s)uppercase(\s|$)/.test(cls)) found.push(`uppercase class on ${where}`);
    if ((style.letterSpacing ?? "") !== "") {
      found.push(`inline letter-spacing on ${where}: ${style.letterSpacing}`);
    }
    // §5.A: the blur belongs to the scrim and to nothing else.
    if (/(^|\s)backdrop-blur/.test(cls) && declared !== "scrim") {
      found.push(`backdrop-blur outside a scrim on ${where}`);
    }
    // C25: `.num` is the one spelling of "tabular".
    if (/(^|\s)tabular-nums(\s|$)/.test(cls)) found.push(`tabular-nums class on ${where}`);
  }

  return found;
}

/**
 * Assert the two hard rules over a rendered tree. Equivalent to asserting
 * `hardRuleViolations` is empty, and named for the six call sites that used to
 * spell it that way.
 */
export function assertHardRules(root: HTMLElement, options: HardRuleOptions = {}): void {
  expect(hardRuleViolations(root, options)).toEqual([]);
}
