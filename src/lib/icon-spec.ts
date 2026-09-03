/**
 * Pure IconSpec helpers (UI Contract §3.6 client rendering contract):
 * structural validation, fraction normalization, fill-level resolution and
 * vertical layout. The SVG drawing itself lives in `CoffeeIcon.tsx`; this
 * module owns everything unit-testable without a DOM.
 */
import type { IconSpec, IconLayer } from "./contract";

/** Nominal glass volumes, normative for spec_version 1 (§3.6). */
export const GLASS_NOMINAL_ML: Record<string, number> = {
  espresso_cup: 60,
  cup: 220,
  tall_glass: 320,
};

/**
 * Structural check: can this value be drawn as a spec_version-1 IconSpec?
 *
 * `icon: null`, a malformed spec, or an **unknown spec_version** all return
 * false → the caller falls back to the existing PNG lookup (§5.3.2 — never
 * throw, never render a broken glass).
 */
export function isRenderableIconSpec(spec: unknown): spec is IconSpec {
  if (typeof spec !== "object" || spec === null || Array.isArray(spec)) return false;
  const s = spec as Record<string, unknown>;
  if (s.spec_version !== 1) return false;
  if (typeof s.glass !== "string") return false;
  if (typeof s.total_ml !== "number" || !Number.isFinite(s.total_ml)) return false;
  if (!Array.isArray(s.layers) || s.layers.length === 0) return false;
  for (const layer of s.layers) {
    if (typeof layer !== "object" || layer === null) return false;
    const l = layer as Record<string, unknown>;
    if (typeof l.role !== "string") return false;
    if (typeof l.fraction !== "number" || !Number.isFinite(l.fraction)) return false;
  }
  const foam = s.foam;
  if (foam !== null && foam !== undefined) {
    if (typeof foam !== "object" || Array.isArray(foam)) return false;
    const f = foam as Record<string, unknown>;
    if (typeof f.fraction !== "number" || !Number.isFinite(f.fraction)) return false;
  }
  return true;
}

/** One drawable stacked segment (bottom → top). */
export interface IconSegment {
  role: string;
  fraction: number;
  intensity: number;
  crema: boolean;
  colorHint: string | null;
}

const COLOR_HINT_RE = /^#[0-9a-fA-F]{6}$/;

/**
 * Stack layers + foam bottom→top and normalize fractions per §3.6: fractions
 * sum to 1 ± 0.02, the client folds the remainder into the last segment.
 */
export function normalizeIconLayers(spec: IconSpec): IconSegment[] {
  const entries: IconLayer[] = [...spec.layers];
  if (spec.foam) entries.push(spec.foam);
  const segments: IconSegment[] = entries.map((l) => ({
    role: typeof l.role === "string" ? l.role : "unknown",
    fraction: Math.max(0, Number.isFinite(l.fraction) ? l.fraction : 0),
    intensity:
      typeof l.intensity === "number" && Number.isFinite(l.intensity)
        ? Math.min(1, Math.max(0, l.intensity))
        : 0.5,
    crema: l.crema === true,
    colorHint:
      typeof l.color_hint === "string" && COLOR_HINT_RE.test(l.color_hint)
        ? l.color_hint
        : null,
  }));
  const sum = segments.reduce((acc, s) => acc + s.fraction, 0);
  const last = segments[segments.length - 1];
  if (sum <= 0) {
    last.fraction = 1;
  } else {
    last.fraction = Math.max(0, last.fraction + (1 - sum));
  }
  return segments;
}

/**
 * Effective fill level: the served `fill_level`, clamped; when missing,
 * computed from the glass nominal volume — unknown glass tokens use the
 * `cup` nominal (§3.6).
 */
export function iconFillLevel(spec: IconSpec): number {
  const raw =
    typeof spec.fill_level === "number" && Number.isFinite(spec.fill_level)
      ? spec.fill_level
      : Math.min(1, spec.total_ml / (GLASS_NOMINAL_ML[spec.glass] ?? GLASS_NOMINAL_ML.cup));
  return Math.min(1, Math.max(0.05, raw));
}

/** A segment with its resolved vertical geometry inside the glass. */
export interface PositionedSegment extends IconSegment {
  /** Top edge (SVG y grows downward). */
  y: number;
  /** Segment height. */
  h: number;
}

/**
 * Lay segments out bottom-up inside the liquid region: `botY` is the glass
 * interior bottom, `liquidH` the total liquid height.
 */
export function layoutSegments(
  segments: IconSegment[],
  liquidH: number,
  botY: number,
): PositionedSegment[] {
  const out: PositionedSegment[] = [];
  let cursor = 0;
  for (const seg of segments) {
    const h = liquidH * seg.fraction;
    out.push({ ...seg, y: botY - cursor - h, h });
    cursor += h;
  }
  return out;
}
