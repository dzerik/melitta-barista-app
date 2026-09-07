/**
 * The complete control vocabulary of the app.
 *
 * These shapes are the ONLY ones the interface has. Every rectangle here is
 * `border-radius: 0`; the only curves are true circles (`Dot`) and the drawn
 * contour of a glass. Nothing paints a background except the four carve-outs —
 * the modal scrim, the one flat `--surface` panel per modal, the one
 * `--accent` commit rectangle per screen, and a meter's filled segments (where
 * the paint IS the value). If a screen needs a shape that is not here, the
 * answer is a word, a glyph, a meter or a rule — not a new container.
 *
 * WHICH SHAPE, IN ONE LINE EACH
 *   Option / OptionRow — choosing. A word plus a reserved underline slot.
 *   Word               — acting. A word, and deliberately NO underline.
 *   Commit             — the ONE committing action on a screen. The one fill.
 *   ActionBand         — the arrangement Commit and Word sit in.
 *   Field              — writing. One hairline under every input in the app.
 *   Meter / MeterField — a quantity. The paint IS the value.
 *   TickRing           — a KNOWN-duration countdown, full-screen only.
 *   Panel              — a modal: scrim + one flat surface + one header.
 *   Heading            — naming a group of controls.
 *   Glyph              — a non-drink mark: a row's icon, an empty page's icon.
 *   Dot                — a position mark.
 *   DrinkStage         — the ground, glow, horizon and reflection behind a drink.
 *   Rule               — a boundary.
 *
 * Note for callers: set fills with `backgroundColor`, never the `background`
 * shorthand — jsdom drops `background: var(--x)` entirely, so a shorthand fill
 * is invisible to every test in this repo.
 *
 * Note for callers, 2: every machine number takes the `.num` utility. The raw
 * Tailwind `tabular-nums` class is retired (C25).
 */
export { Option } from "./Option";
export type { OptionProps, OptionLevel, OptionRole } from "./Option";

export { OptionRow } from "./OptionRow";
export type { OptionRowProps } from "./OptionRow";

export { Word } from "./Word";
export type { WordProps, WordTone } from "./Word";

export { Commit } from "./Commit";
export type { CommitProps } from "./Commit";

export { ActionBand } from "./ActionBand";
export type { ActionBandProps, ActionBandInset } from "./ActionBand";

export { Field } from "./Field";
export type { FieldProps, FieldType } from "./Field";

export { Meter, MeterField, filledSegments } from "./Meter";
export type { MeterProps, MeterFieldProps, MeterTone } from "./Meter";

export { TickRing, completedTicks, TICK_COUNT, TICK_PITCH_DEG } from "./TickRing";
export type { TickRingProps } from "./TickRing";

export { Panel } from "./Panel";
export type { PanelProps, PanelMeasure } from "./Panel";

export { Heading } from "./Heading";
export type { HeadingProps, HeadingHang } from "./Heading";

export { Glyph, GLYPH_PX, GLYPH_OPACITY, GLYPH_OPACITY_UNLIT, rowGlyph } from "./Glyph";
export type { GlyphProps, GlyphSize } from "./Glyph";

export { Dot } from "./Dot";
export type { DotProps } from "./Dot";

export { DrinkStage } from "./DrinkStage";
export type { DrinkStageProps } from "./DrinkStage";

export { Mosaic } from "./Mosaic";
export { Rule } from "./Rule";
export type { RuleProps, RuleTone } from "./Rule";

export {
  UNDERLINE_W,
  UNDERLINE_W_NAV,
  UNDERLINE_W_PX,
  UNDERLINE_W_NAV_PX,
  underlineSlot,
  UNDERLINE_FILL,
  underlineFill,
  INPUT_RULE,
  RAIL_TEXT,
  HANG,
  PANEL_PAD,
  DRINK_ASPECT,
  TRUTH_FLOOR,
  TRUTH_CEIL,
  TRUTH_UNSERVED,
  truthScale,
  NUM,
} from "./tokens";
export type { UnderlineSlotOptions } from "./tokens";

export { usePrefersReducedMotion } from "./reduced-motion";
