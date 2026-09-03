/**
 * Freestyle parameter resolution (UI Contract v2 adoption, §6.1).
 *
 * Per parameter family, independently, the PWA resolves its option sources
 * through three tiers (§6.1.5 adapted to this app's surfaces):
 *
 *   1. **contract** — `parameters.<family>` (0.92+ servers), honoring the
 *      §6.1.1 rules: unknown `kind` is ignored, a descriptor whose `scope`
 *      lacks `"freestyle"` is not rendered as freestyle UI.
 *   2. **entity** — the freestyle select-entity `options` attribute (the
 *      PWA's current pre-contract source; server-filtered, so a 0.91 server
 *      lands exactly on today's behaviour). Portion ranges have no select
 *      twin; their tier 2 is the v1 `limits.portion_ml` block.
 *   3. **const** — the hardcoded client lists below (the PWA's current
 *      RecipeEditModal consts), reached only with neither of the above.
 *
 * Also home to the pure FreestyleGlass color/heat helpers: legacy token maps
 * stay authoritative for the frozen v1 tokens (byte-identical rendering), and
 * tokens outside them are interpolated by their **ordinal position** in the
 * resolved token list — so served vocabularies that grow or shrink still
 * render sensibly without a client release.
 */
import { readParameters, type UiContract } from "./contract";

// ---------------------------------------------------------------------------
// Tier-3 consts (the PWA's current hardcoded lists — a permanent fixture)
// ---------------------------------------------------------------------------

/** Hardcoded tier-3 freestyle enum token lists (§6.1.5 client consts). */
export const CONST_FREESTYLE_TOKENS: Record<string, readonly string[]> = {
  process: ["none", "coffee", "milk", "water"],
  intensity: ["very_mild", "mild", "medium", "strong", "very_strong"],
  aroma: ["standard", "intense"],
  temperature: ["cold", "normal", "high"],
  shots: ["none", "one", "two", "three"],
};

/** One inclusive slider range. */
export interface PortionRange {
  min: number;
  max: number;
  step: number;
}

/** Hardcoded tier-3 portion ranges (the PWA's current slider bounds). */
export const CONST_PORTION_RANGES: Record<"c1" | "c2", PortionRange> = {
  c1: { min: 5, max: 250, step: 5 },
  c2: { min: 0, max: 250, step: 5 },
};

// ---------------------------------------------------------------------------
// Three-tier resolution
// ---------------------------------------------------------------------------

/** Which tier produced a resolved parameter (for tests/diagnostics). */
export type ParameterSource = "contract" | "entity" | "const";

/** A resolved enum parameter: ordered tokens plus their source tier. */
export interface ResolvedEnum {
  tokens: string[];
  source: ParameterSource;
}

/** A resolved portion range plus its source tier. */
export interface ResolvedRange extends PortionRange {
  source: ParameterSource;
}

function contractEnumTokens(
  contract: UiContract | null,
  family: string,
): string[] | null {
  const desc = readParameters(contract)?.[family];
  if (!desc) return null;
  // §6.1.1: unknown kind → per-parameter fallback; a descriptor not scoped
  // for freestyle (e.g. Nivona's brew_override intensity) is not freestyle UI.
  if (desc.kind !== "enum") return null;
  if (!Array.isArray(desc.scope) || !desc.scope.includes("freestyle")) return null;
  const tokens = desc.tokens;
  if (
    !Array.isArray(tokens) ||
    tokens.length === 0 ||
    !tokens.every((t) => typeof t === "string")
  ) {
    return null;
  }
  return tokens;
}

/**
 * Resolve one freestyle enum family through the three tiers:
 * contract `parameters` → select-entity options → hardcoded consts.
 *
 * `entityOptions` is the freestyle select entity's `options` attribute for
 * the rendering component (empty/omitted when the entity is absent — e.g.
 * the RecipeEditModal, whose own legacy tier is the consts).
 */
export function resolveEnumTokens(
  contract: UiContract | null,
  family: string,
  entityOptions?: string[],
): ResolvedEnum {
  const served = contractEnumTokens(contract, family);
  if (served !== null) return { tokens: [...served], source: "contract" };
  if (entityOptions && entityOptions.length > 0) {
    return { tokens: [...entityOptions], source: "entity" };
  }
  return { tokens: [...(CONST_FREESTYLE_TOKENS[family] ?? [])], source: "const" };
}

/**
 * Resolve the process tokens for one freestyle component.
 *
 * Component 1 never offers `none` (the machine requires a first component;
 * the server's own process-1 select carries the same asymmetry) — the filter
 * applies to whichever tier resolved, keeping the served single `process`
 * family usable for both pickers.
 */
export function resolveProcessTokens(
  contract: UiContract | null,
  component: 1 | 2,
  entityOptions?: string[],
): ResolvedEnum {
  const resolved = resolveEnumTokens(contract, "process", entityOptions);
  if (component === 1) {
    return { ...resolved, tokens: resolved.tokens.filter((t) => t !== "none") };
  }
  return resolved;
}

function isValidRange(v: unknown): v is PortionRange {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as PortionRange).min === "number" &&
    typeof (v as PortionRange).max === "number" &&
    typeof (v as PortionRange).step === "number" &&
    (v as PortionRange).step > 0 &&
    (v as PortionRange).max >= (v as PortionRange).min
  );
}

/**
 * Resolve one component's portion slider range: `parameters.portion_ml`
 * (per-component, freestyle-scoped) → v1 `limits.portion_ml` → consts.
 */
export function resolvePortionRange(
  contract: UiContract | null,
  component: "c1" | "c2",
): ResolvedRange {
  const desc = readParameters(contract)?.portion_ml;
  if (
    desc &&
    desc.kind === "range" &&
    Array.isArray(desc.scope) &&
    desc.scope.includes("freestyle") &&
    desc.per_component === true &&
    isValidRange(desc[component])
  ) {
    return { ...(desc[component] as PortionRange), source: "contract" };
  }
  const v1 = contract?.limits?.portion_ml?.[component];
  if (isValidRange(v1)) return { ...v1, source: "entity" };
  return { ...CONST_PORTION_RANGES[component], source: "const" };
}

// ---------------------------------------------------------------------------
// FreestyleGlass color/heat model — legacy maps + ordinal interpolation
// ---------------------------------------------------------------------------

/** Frozen legacy intensity → coffee color map (byte-identical rendering). */
export const COFFEE_INTENSITY_COLORS: Record<string, string> = {
  very_mild: "#8B6B4A",
  mild: "#6B4A2E",
  medium: "#4A2A14",
  strong: "#3E1F0D",
  very_strong: "#1A0D04",
  extra_strong: "#0F0803",
};

/** Frozen legacy temperature → heat factor map. */
export const TEMP_HEAT: Record<string, number> = {
  cold: 0.2,
  low: 0.2,
  normal: 0.6,
  high: 1.0,
};

const INTENSITY_LIGHTEST = "#8B6B4A";
const INTENSITY_DARKEST = "#1A0D04";

/**
 * Ordinal position of a token within its resolved scale, as a 0..1 fraction.
 *
 * Returns null when the token is absent from the scale (or the scale is
 * empty); a single-token scale centers at 0.5.
 */
export function ordinalFraction(
  token: string,
  scale: readonly string[] | undefined,
): number | null {
  if (!scale || scale.length === 0) return null;
  const idx = scale.indexOf(token);
  if (idx < 0) return null;
  if (scale.length === 1) return 0.5;
  return idx / (scale.length - 1);
}

function lerpHex(from: string, to: string, f: number): string {
  const a = parseInt(from.slice(1), 16);
  const b = parseInt(to.slice(1), 16);
  const ch = (shift: number) => {
    const x = (a >> shift) & 0xff;
    const y = (b >> shift) & 0xff;
    return Math.round(x + (y - x) * f);
  };
  const rgb = (ch(16) << 16) | (ch(8) << 8) | ch(0);
  return `#${rgb.toString(16).padStart(6, "0").toUpperCase()}`;
}

/**
 * Coffee body color for an intensity token: the frozen legacy map first
 * (byte-identical for every v1 token), then ordinal interpolation across the
 * legacy light→dark ramp for tokens outside it, then the legacy medium.
 */
export function intensityColor(
  intensity: string,
  scale?: readonly string[],
): string {
  const known = COFFEE_INTENSITY_COLORS[intensity];
  if (known) return known;
  const f = ordinalFraction(intensity, scale);
  if (f !== null) return lerpHex(INTENSITY_LIGHTEST, INTENSITY_DARKEST, f);
  return COFFEE_INTENSITY_COLORS.medium;
}

/**
 * Crema color for an intensity token: legacy buckets for the frozen tokens,
 * ordinal thirds (light / golden / dark) for tokens outside them.
 */
export function cremaColor(intensity: string, scale?: readonly string[]): string {
  if (intensity === "very_mild" || intensity === "mild") return "#D4A860";
  if (
    intensity === "strong" ||
    intensity === "very_strong" ||
    intensity === "extra_strong"
  ) {
    return "#8B6030";
  }
  if (intensity === "medium") return "#C49545";
  const f = ordinalFraction(intensity, scale);
  if (f !== null) {
    if (f <= 0.34) return "#D4A860";
    if (f >= 0.66) return "#8B6030";
  }
  return "#C49545"; // golden — the legacy default
}

/**
 * Steam heat factor for a temperature token: the frozen legacy map first,
 * ordinal interpolation across the legacy 0.2..1.0 span for tokens outside
 * it, then the legacy 0.5 default.
 */
export function heatFor(temp: string, scale?: readonly string[]): number {
  const known = TEMP_HEAT[temp];
  if (known !== undefined) return known;
  const f = ordinalFraction(temp, scale);
  if (f !== null) return 0.2 + f * 0.8;
  return 0.5;
}

/**
 * Fill color for one glass layer: coffee darkness by intensity (see
 * intensityColor), the frozen milk/water colors, transparent otherwise.
 */
export function processColor(
  process: string,
  intensity: string,
  intensityScale?: readonly string[],
): string {
  if (process === "coffee") return intensityColor(intensity, intensityScale);
  if (process === "milk") return "#F0E6D8";
  if (process === "water") return "#9DC4D8";
  return "transparent";
}
