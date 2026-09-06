/**
 * The complete control vocabulary of the app.
 *
 * These seven shapes are the ONLY ones the interface has. Every rectangle here
 * is `border-radius: 0`; the only curves are true circles and the drawn contour
 * of a glass. Nothing paints a background except the four carve-outs — the
 * modal scrim, the one flat `--surface` panel per modal, the one `--accent`
 * commit rectangle per screen, and a meter's filled segments (where the paint
 * IS the value). If a screen needs a shape that is not here, the answer is a
 * word, a glyph, a meter or a rule — not a new container.
 *
 * Note for callers: set fills with `backgroundColor`, never the `background`
 * shorthand — jsdom drops `background: var(--x)` entirely, so a shorthand fill
 * is invisible to every test in this repo.
 */
export { Option } from "./Option";
export type { OptionProps, OptionLevel, OptionRole } from "./Option";

export { OptionRow } from "./OptionRow";
export type { OptionRowProps } from "./OptionRow";

export { Commit } from "./Commit";
export type { CommitProps } from "./Commit";

export { Meter, MeterField, filledSegments } from "./Meter";
export type { MeterProps, MeterFieldProps, MeterTone } from "./Meter";

export { TickRing, completedTicks, TICK_COUNT, TICK_PITCH_DEG } from "./TickRing";
export type { TickRingProps } from "./TickRing";

export { DrinkStage } from "./DrinkStage";
export type { DrinkStageProps } from "./DrinkStage";

export { Rule } from "./Rule";
export type { RuleProps, RuleTone } from "./Rule";

export { usePrefersReducedMotion } from "./reduced-motion";
