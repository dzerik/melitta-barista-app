import type { IconSpec } from "../lib/contract";
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

const RECIPE_IMAGES: Record<string, string> = {
  Espresso: imgEspresso,
  Ristretto: imgRistretto,
  Lungo: imgLungo,
  "Espresso Doppio": imgEspressoDoppio,
  "Ristretto Doppio": imgRistrettoDoppio,
  "Café Crème": imgCafeCreme,
  "Café Crème Doppio": imgCafeCremeDoppio,
  Americano: imgAmericano,
  "Americano Extra": imgAmericanoExtra,
  "Long Black": imgLongBlack,
  "Red Eye": imgRedEye,
  "Black Eye": imgBlackEye,
  "Dead Eye": imgDeadEye,
  Cappuccino: imgCappuccino,
  "Espresso Macchiato": imgEspressoMacchiato,
  "Caffè Latte": imgCaffeLatte,
  "Café au Lait": imgCafeAuLait,
  "Flat White": imgFlatWhite,
  "Latte Macchiato": imgLatteMacchiato,
  "Latte Macchiato Extra": imgLatteMacchiatoExtra,
  "Latte Macchiato Triple": imgLatteMacchiatoTriple,
  Milk: imgMilk,
  "Milk Froth": imgMilkFroth,
  "Hot Water": imgWater,
};

/**
 * Served `name_key` (§6.3.6) → local recipe asset. The stable-key twin of
 * RECIPE_IMAGES: display names may be renamed/localized server-side, the
 * name_key never moves (spec §6.3.6 pins the 24 Melitta keys).
 */
const NAME_KEY_IMAGES: Record<string, string> = {
  espresso: imgEspresso,
  ristretto: imgRistretto,
  lungo: imgLungo,
  espresso_doppio: imgEspressoDoppio,
  ristretto_doppio: imgRistrettoDoppio,
  cafe_creme: imgCafeCreme,
  cafe_creme_doppio: imgCafeCremeDoppio,
  americano: imgAmericano,
  americano_extra: imgAmericanoExtra,
  long_black: imgLongBlack,
  red_eye: imgRedEye,
  black_eye: imgBlackEye,
  dead_eye: imgDeadEye,
  cappuccino: imgCappuccino,
  espresso_macchiato: imgEspressoMacchiato,
  caffe_latte: imgCaffeLatte,
  cafe_au_lait: imgCafeAuLait,
  flat_white: imgFlatWhite,
  latte_macchiato: imgLatteMacchiato,
  latte_macchiato_extra: imgLatteMacchiatoExtra,
  latte_macchiato_triple: imgLatteMacchiatoTriple,
  milk: imgMilk,
  milk_froth: imgMilkFroth,
  hot_water: imgWater,
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
      </defs>
      {spec.steam && (
        <g data-steam="true" stroke="#9a9a9a" strokeOpacity={0.5} fill="none" strokeWidth={1.4} strokeLinecap="round">
          <path d={`M ${CX - 6} ${geo.topY - 3} q 3 -3.5 0 -7 q -3 -3.5 0 -7`} />
          <path d={`M ${CX + 6} ${geo.topY - 3} q 3 -3.5 0 -7 q -3 -3.5 0 -7`} />
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
}

/**
 * Drink icon with the v1 fallback chain: a renderable served IconSpec is
 * drawn (§3.6); otherwise the local PNG is looked up by served `name_key`,
 * then by English display name, then the freestyle placeholder — so a
 * pre-contract integration renders byte-identically to the legacy app.
 */
export function CoffeeIcon({ recipe, size = 80, icon = null, nameKey }: Props) {
  if (isRenderableIconSpec(icon)) {
    return <IconSpecDrawing spec={icon} label={recipe} size={size} />;
  }

  const src =
    (nameKey !== undefined ? NAME_KEY_IMAGES[nameKey] : undefined) ||
    RECIPE_IMAGES[recipe] ||
    imgFreestyle;

  return (
    <img
      src={src}
      alt={recipe}
      width={size}
      height={Math.round(size * (720 / 1080))}
      style={{ objectFit: "contain" }}
      draggable={false}
    />
  );
}
