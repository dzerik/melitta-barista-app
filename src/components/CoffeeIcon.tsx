import type { IconSpec } from "../lib/contract";
import { DRINK_ASPECT, truthScale } from "./ui/tokens";
import {
  isRenderableIconSpec,
  normalizeIconLayers,
  iconFillLevel,
  layoutSegments,
  type IconSegment,
} from "../lib/icon-spec";
import imgEspresso from "../assets/recipes/espresso.png";
import imgRistretto from "../assets/recipes/ristretto.png";
import imgLungo from "../assets/recipes/lungo.png";
import imgEspressoDoppio from "../assets/recipes/espresso_doppio.png";
import imgRistrettoDoppio from "../assets/recipes/ristretto_doppio.png";
import imgCafeCreme from "../assets/recipes/cafe_creme.png";
import imgCafeCremeDoppio from "../assets/recipes/cafe_creme_doppio.png";
import imgAmericano from "../assets/recipes/americano.png";
import imgAmericanoExtra from "../assets/recipes/americano_extra_shot2.png";
import imgLongBlack from "../assets/recipes/long_black.png";
import imgRedEye from "../assets/recipes/red_eye.png";
import imgBlackEye from "../assets/recipes/black_eye.png";
import imgDeadEye from "../assets/recipes/dead_eye.png";
import imgCappuccino from "../assets/recipes/cappuccino.png";
import imgEspressoMacchiato from "../assets/recipes/espresso_macchiato.png";
import imgCaffeLatte from "../assets/recipes/caffe_latte.png";
import imgCafeAuLait from "../assets/recipes/cafe_au_lait.png";
import imgFlatWhite from "../assets/recipes/flat_white.png";
import imgLatteMacchiato from "../assets/recipes/latte_macchiato.png";
import imgLatteMacchiatoExtra from "../assets/recipes/latte_macchiato_extra_shot2.png";
import imgLatteMacchiatoTriple from "../assets/recipes/latte_macchiato_triple_shot2.png";
import imgMilk from "../assets/recipes/milk.png";
import imgMilkFroth from "../assets/recipes/milk_froth.png";
import imgWater from "../assets/recipes/water.png";
import imgFreestyle from "../assets/recipes/freestyle_placeholder.png";
import { DRINK_BOUNDS, FULL_BOUNDS, type DrinkBounds } from "../lib/drink-metrics";

/**
 * Display name → asset key. The key is the artwork's own basename, which is
 * also how `DRINK_BOUNDS` is keyed, so one lookup gives both the picture and
 * the glass's real bounds inside it.
 */
/** The artwork, keyed by its own basename. */
/**
 * Which artwork a drink resolves to, by the v1 fallback chain: served
 * `name_key` first (§6.3.6, the stable key), then the English display name,
 * then the freestyle placeholder.
 */
export function drinkAssetKey(recipe: string, nameKey?: string): string {
  return (
    (nameKey !== undefined ? NAME_KEY_ASSET[nameKey] : undefined) ??
    RECIPE_ASSET[recipe] ??
    "freestyle_placeholder"
  );
}

/**
 * Where the glass actually sits inside what will be drawn.
 *
 * A served IconSpec is drawn procedurally and fills its box, so it reports the
 * whole canvas. A PNG reports the measured bounds of its glass, because the
 * artwork places an espresso in 11% of its frame and a hot water in 57% — and
 * a halo or a reflection sized to the frame would sit around the light instead
 * of around the drink.
 */
export function drinkBounds(recipe: string, nameKey?: string, icon?: IconSpec | null): DrinkBounds {
  if (isRenderableIconSpec(icon)) return FULL_BOUNDS;
  return DRINK_BOUNDS[drinkAssetKey(recipe, nameKey)] ?? FULL_BOUNDS;
}

const ASSET_IMG: Record<string, string> = {
  "americano": imgAmericano,
  "americano_extra_shot2": imgAmericanoExtra,
  "black_eye": imgBlackEye,
  "cafe_au_lait": imgCafeAuLait,
  "cafe_creme": imgCafeCreme,
  "cafe_creme_doppio": imgCafeCremeDoppio,
  "caffe_latte": imgCaffeLatte,
  "cappuccino": imgCappuccino,
  "dead_eye": imgDeadEye,
  "espresso": imgEspresso,
  "espresso_doppio": imgEspressoDoppio,
  "espresso_macchiato": imgEspressoMacchiato,
  "flat_white": imgFlatWhite,
  "freestyle_placeholder": imgFreestyle,
  "latte_macchiato": imgLatteMacchiato,
  "latte_macchiato_extra_shot2": imgLatteMacchiatoExtra,
  "latte_macchiato_triple_shot2": imgLatteMacchiatoTriple,
  "long_black": imgLongBlack,
  "lungo": imgLungo,
  "milk": imgMilk,
  "milk_froth": imgMilkFroth,
  "red_eye": imgRedEye,
  "ristretto": imgRistretto,
  "ristretto_doppio": imgRistrettoDoppio,
  "water": imgWater,
};

const RECIPE_ASSET: Record<string, string> = {
  Espresso: "espresso",
  Ristretto: "ristretto",
  Lungo: "lungo",
  "Espresso Doppio": "espresso_doppio",
  "Ristretto Doppio": "ristretto_doppio",
  "Café Crème": "cafe_creme",
  "Café Crème Doppio": "cafe_creme_doppio",
  Americano: "americano",
  "Americano Extra": "americano_extra_shot2",
  "Long Black": "long_black",
  "Red Eye": "red_eye",
  "Black Eye": "black_eye",
  "Dead Eye": "dead_eye",
  Cappuccino: "cappuccino",
  "Espresso Macchiato": "espresso_macchiato",
  "Caffè Latte": "caffe_latte",
  "Café au Lait": "cafe_au_lait",
  "Flat White": "flat_white",
  "Latte Macchiato": "latte_macchiato",
  "Latte Macchiato Extra": "latte_macchiato_extra_shot2",
  "Latte Macchiato Triple": "latte_macchiato_triple_shot2",
  Milk: "milk",
  "Milk Froth": "milk_froth",
  "Hot Water": "water",
};

/**
 * Served `name_key` (§6.3.6) → local recipe asset. The stable-key twin of
 * RECIPE_IMAGES: display names may be renamed/localized server-side, the
 * name_key never moves (spec §6.3.6 pins the 24 Melitta keys).
 */
/** Served `name_key` → asset key (§6.3.6): the stable twin of RECIPE_ASSET. */
const NAME_KEY_ASSET: Record<string, string> = {
  espresso: "espresso",
  ristretto: "ristretto",
  lungo: "lungo",
  espresso_doppio: "espresso_doppio",
  ristretto_doppio: "ristretto_doppio",
  cafe_creme: "cafe_creme",
  cafe_creme_doppio: "cafe_creme_doppio",
  americano: "americano",
  americano_extra: "americano_extra_shot2",
  long_black: "long_black",
  red_eye: "red_eye",
  black_eye: "black_eye",
  dead_eye: "dead_eye",
  cappuccino: "cappuccino",
  espresso_macchiato: "espresso_macchiato",
  caffe_latte: "caffe_latte",
  cafe_au_lait: "cafe_au_lait",
  flat_white: "flat_white",
  latte_macchiato: "latte_macchiato",
  latte_macchiato_extra: "latte_macchiato_extra_shot2",
  latte_macchiato_triple: "latte_macchiato_triple_shot2",
  milk: "milk",
  milk_froth: "milk_froth",
  hot_water: "water",
};

// ---------------------------------------------------------------------------
// IconSpec rendering (§3.6 client rendering contract)
// ---------------------------------------------------------------------------

interface GlassGeometry {
  topY: number;
  botY: number;
  topW: number;
  botW: number;
  handle: boolean;
}

/** Glass silhouettes in the 108×72 viewBox; unknown glass → `cup` (§5.3.2). */
const GLASS_GEOMETRY: Record<string, GlassGeometry> = {
  espresso_cup: { topY: 38, botY: 64, topW: 34, botW: 26, handle: true },
  cup: { topY: 28, botY: 64, topW: 40, botW: 32, handle: true },
  tall_glass: { topY: 12, botY: 64, topW: 30, botW: 24, handle: false },
};

/**
 * Steam puffs: each leaves the drink surface, spreads as it climbs and
 * dissolves before the top of the frame. `dx` is relative to the cup centre,
 * `rise` the travel in viewBox units (capped by the headroom the glass leaves —
 * a tall glass has far less), `peak` the opacity it reaches. Negative `begin`
 * values start puffs mid-flight so the column is never caught empty.
 */
const STEAM_PUFFS = [
  { dx: -4, begin: 0, dur: 3.4, r0: 2.8, r1: 7.0, rise: 18, peak: 0.55 },
  { dx: 3, begin: -1.2, dur: 3.8, r0: 2.4, r1: 6.5, rise: 20, peak: 0.5 },
  { dx: 7, begin: -2.3, dur: 3.1, r0: 2.1, r1: 5.5, rise: 16, peak: 0.4 },
  { dx: -1, begin: -0.6, dur: 4.2, r0: 2.6, r1: 7.5, rise: 21, peak: 0.38 },
];

const CX = 54;

function segmentFill(seg: IconSegment): { fill: string; opacity: number } {
  switch (seg.role) {
    case "coffee": {
      const lightness = 58 - 40 * seg.intensity;
      return { fill: `hsl(28, 45%, ${Math.round(lightness)}%)`, opacity: 1 };
    }
    case "milk":
      return { fill: "#f5efe6", opacity: 1 };
    case "milk_foam":
      return { fill: "#faf6ee", opacity: 1 };
    case "water":
      return { fill: "#aacfe6", opacity: 0.4 };
    case "additive":
      return seg.colorHint
        ? { fill: seg.colorHint, opacity: 0.85 }
        : { fill: "#8a8a8a", opacity: 0.55 };
    default:
      // Unknown role → neutral grey layer of `intensity` (§5.3.2).
      return { fill: "#8a8a8a", opacity: 0.3 + 0.4 * seg.intensity };
  }
}

function IconSpecDrawing({
  spec,
  label,
  size,
}: {
  spec: IconSpec;
  label: string;
  size: number;
}) {
  const geo = GLASS_GEOMETRY[spec.glass] ?? GLASS_GEOMETRY.cup;
  const segments = normalizeIconLayers(spec);
  const fillLevel = iconFillLevel(spec);
  const interiorH = geo.botY - geo.topY;
  const liquidH = interiorH * fillLevel;
  const halfTop = geo.topW / 2;
  const halfBot = geo.botW / 2;
  const clipId = `glass-${spec.glass}-${geo.topW}`;
  const steamBlurId = `steam-blur-${spec.glass}-${geo.topW}`;
  const steamGradId = `steam-grad-${spec.glass}-${geo.topW}`;

  // Stack segments bottom → top inside the liquid region.
  const rects = layoutSegments(segments, liquidH, geo.botY).map((seg, i) => {
    const { fill, opacity } = segmentFill(seg);
    const cremaH = seg.crema ? Math.min(seg.h * 0.25, 2.2) : 0;
    return (
      <g key={i} data-role={seg.role}>
        <rect
          x={CX - halfTop}
          y={seg.y}
          width={geo.topW}
          height={seg.h}
          fill={fill}
          fillOpacity={opacity}
        />
        {cremaH > 0 && (
          <rect
            data-crema="true"
            x={CX - halfTop}
            y={seg.y}
            width={geo.topW}
            height={cremaH}
            fill="#d7a15c"
          />
        )}
      </g>
    );
  });

  const outline = `M ${CX - halfTop} ${geo.topY} L ${CX - halfBot} ${geo.botY} L ${CX + halfBot} ${geo.botY} L ${CX + halfTop} ${geo.topY}`;

  return (
    <svg
      role="img"
      aria-label={label}
      data-icon-spec="true"
      width={size}
      height={Math.round(size * (720 / 1080))}
      viewBox="0 0 108 72"
      style={{ objectFit: "contain" }}
    >
      <defs>
        <clipPath id={clipId}>
          <path d={`${outline} Z`} />
        </clipPath>
        {spec.steam && (
          <>
            <filter id={steamBlurId} x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="1.3" />
            </filter>
            <radialGradient id={steamGradId}>
              <stop offset="0%" stopColor="currentColor" stopOpacity={1} />
              <stop offset="55%" stopColor="currentColor" stopOpacity={0.5} />
              <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
            </radialGradient>
          </>
        )}
      </defs>
      {spec.steam && (
        <g
          data-steam="true"
          filter={`url(#${steamBlurId})`}
          style={{ color: "var(--text-secondary, #9a9a9a)" }}
        >
          {STEAM_PUFFS.map((puff, i) => {
            const rise = Math.min(puff.rise, Math.max(5, geo.topY - 2));
            const from = geo.topY - 1;
            const dur = `${puff.dur}s`;
            const begin = `${puff.begin}s`;
            return (
              <ellipse
                key={i}
                cx={CX + puff.dx}
                cy={from}
                rx={puff.r0}
                ry={puff.r0 * 0.7}
                fill={`url(#${steamGradId})`}
                opacity={0}
              >
                <animate attributeName="cy" values={`${from};${from - rise}`}
                  dur={dur} begin={begin} repeatCount="indefinite" />
                <animate attributeName="rx" values={`${puff.r0};${puff.r1}`}
                  dur={dur} begin={begin} repeatCount="indefinite" />
                <animate attributeName="ry" values={`${puff.r0 * 0.7};${puff.r1 * 0.85}`}
                  dur={dur} begin={begin} repeatCount="indefinite" />
                <animate attributeName="opacity"
                  values={`0;${puff.peak};${puff.peak * 0.5};0`} keyTimes="0;0.25;0.6;1"
                  dur={dur} begin={begin} repeatCount="indefinite" />
              </ellipse>
            );
          })}
        </g>
      )}
      <g clipPath={`url(#${clipId})`}>{rects}</g>
      <path
        d={outline}
        fill="none"
        stroke="var(--text-tertiary, #8a8a8a)"
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      {geo.handle && (
        <path
          d={`M ${CX + halfTop - 1} ${geo.topY + interiorH * 0.25} q 12 2 0 ${interiorH * 0.42}`}
          fill="none"
          stroke="var(--text-tertiary, #8a8a8a)"
          strokeWidth={1.6}
        />
      )}
    </svg>
  );
}

interface Props {
  recipe: string;
  size?: number;
  /** Served IconSpec (§3.6); absent/invalid → the PNG lookup below. */
  icon?: IconSpec | null;
  /** Served stable name_key (§6.3.6) for the asset lookup fallback tier. */
  nameKey?: string;
  /**
   * §6.3 TRUTH SCALE: this drink's real magnitude as a 0–1 fraction of the
   * row's maximum (`total_ml / rowMaxMl`).
   *
   * IT APPLIES TO A PROCEDURAL DRAWING ONLY, and this is the whole point: the
   * artwork already encodes true scale. The 25 recipe PNGs share one 1080×720
   * canvas, stand on one baseline, and draw each glass at its real relative
   * size — measured against the physical vessels, espresso comes out 0.44× a
   * latte macchiato in the artwork and 0.43× on the counter. Rendering every
   * file at the same width is therefore already the truth, and multiplying a
   * volume fraction on top of it counts the same fact twice: it made an
   * espresso beside a latte roughly half the size it should be.
   *
   * A served IconSpec has no such scale — the geometry is drawn to a fixed
   * glass silhouette — so there the code must supply it, and does.
   */
  scaleTo?: number;
  /**
   * Bottom-align the (possibly shrunken) drawing inside a box of the FULL
   * unscaled height, so every base in a row lands on one line and the tops
   * stay deliberately ragged. That ragged edge is the comparison, read before
   * any number is. Pair it with `scaleTo`: alone it only reserves the height.
   */
  baseline?: boolean;
}

/**
 * Drink icon with the v1 fallback chain: a renderable served IconSpec is
 * drawn (§3.6); otherwise the local PNG is looked up by served `name_key`,
 * then by English display name, then the freestyle placeholder — so a
 * pre-contract integration renders byte-identically to the legacy app.
 *
 * `scaleTo` and `baseline` implement §6.3, the reference panels' single
 * biggest move: within a row the glasses are NOT normalised to a uniform box.
 * The maths used to live hand-rolled in one section (`StatsSection`'s local
 * `truthScale`) while every other row in the app rendered flat; it lives here
 * now, and `truthScale` is exported from `components/ui/tokens` so the icon,
 * the stat tile and the tests all agree on the same band.
 */
export function CoffeeIcon({
  recipe,
  size = 80,
  icon = null,
  nameKey,
  scaleTo,
  baseline = false,
}: Props) {
  // The artwork carries its own scale; only a procedural drawing needs ours.
  const spec = isRenderableIconSpec(icon);
  const drawn =
    spec && scaleTo !== undefined ? Math.round(size * truthScale(scaleTo)) : size;

  const glyph = spec ? (
    <IconSpecDrawing spec={icon} label={recipe} size={drawn} />
  ) : (
    <img
      src={ASSET_IMG[drinkAssetKey(recipe, nameKey)] ?? imgFreestyle}
      alt={recipe}
      width={drawn}
      height={Math.round(drawn * DRINK_ASPECT)}
      style={{ objectFit: "contain" }}
      draggable={false}
    />
  );

  if (!baseline) return glyph;

  return (
    <span
      data-ui="coffee-icon-baseline"
      className="flex w-full items-end justify-center"
      style={{ height: Math.round(size * DRINK_ASPECT), lineHeight: 0 }}
    >
      {glyph}
    </span>
  );
}
