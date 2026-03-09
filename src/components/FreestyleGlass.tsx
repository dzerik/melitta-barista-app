/**
 * Dynamic glass visualization for freestyle drink builder.
 * Shape, reflections and shadows closely match the Melitta cafe_creme.png style —
 * a tall double-walled glass mug with a C-shaped handle.
 */

const COFFEE_INTENSITY_COLORS: Record<string, string> = {
  very_mild: "#8B6B4A",
  mild: "#6B4A2E",
  medium: "#4A2A14",
  strong: "#3E1F0D",
  very_strong: "#1A0D04",
  extra_strong: "#0F0803",
};

function getProcessColor(process: string, intensity: string): string {
  if (process === "coffee") return COFFEE_INTENSITY_COLORS[intensity] || COFFEE_INTENSITY_COLORS.medium;
  if (process === "milk") return "#F0E6D8";
  if (process === "water") return "#9DC4D8";
  return "transparent";
}

function getCoffeeCremaColor(intensity: string): string {
  if (intensity === "very_mild" || intensity === "mild") return "#D4A860";
  if (intensity === "strong" || intensity === "very_strong" || intensity === "extra_strong") return "#8B6030";
  return "#C49545"; // medium — golden
}

const TEMP_HEAT: Record<string, number> = {
  cold: 0.2,
  low: 0.2,
  normal: 0.6,
  high: 1.0,
};

interface Props {
  process1: string;
  intensity1: string;
  temp1: string;
  portion1: number;
  process2: string;
  intensity2: string;
  temp2: string;
  portion2: number;
  size?: number;
  hideVolume?: boolean;
}

export function FreestyleGlass({
  process1,
  intensity1,
  temp1,
  portion1,
  process2,
  intensity2,
  temp2,
  portion2,
  size = 300,
  hideVolume = false,
}: Props) {
  const vbW = 120;
  const vbH = 150;

  // Glass mug geometry — matches cafe_creme.png proportions
  const cupTopW = 48;
  const cupBotW = 38;
  const cupH = 80;
  const cupTop = 32;
  const cupBot = cupTop + cupH;
  const cx = 60; // centered on viewport axis; handle fits within vbW

  const topL = cx - cupTopW / 2;
  const topR = cx + cupTopW / 2;
  const botL = cx - cupBotW / 2;
  const botR = cx + cupBotW / 2;

  const r = 5; // bottom corner radius

  // Simpler outer path for fill/clip
  const glassOutlinePath = `
    M ${topL} ${cupTop}
    L ${botL} ${cupBot - r}
    Q ${botL} ${cupBot} ${botL + r} ${cupBot}
    L ${botR - r} ${cupBot}
    Q ${botR} ${cupBot} ${botR} ${cupBot - r}
    L ${topR} ${cupTop}
    Z
  `;

  // Inner wall (double-wall effect) — offset inward ~3px
  const dw = 3; // double-wall gap
  const iTopL = topL + dw;
  const iTopR = topR - dw;
  const iBotL = botL + dw;
  const iBotR = botR - dw;
  const iTop = cupTop + dw;
  const iBot = cupBot - dw;
  const iR = r * 0.6;

  const innerWallPath = `
    M ${iTopL} ${iTop}
    L ${iBotL} ${iBot - iR}
    Q ${iBotL} ${iBot} ${iBotL + iR} ${iBot}
    L ${iBotR - iR} ${iBot}
    Q ${iBotR} ${iBot} ${iBotR} ${iBot - iR}
    L ${iTopR} ${iTop}
  `;

  // Clip path uses inner wall for liquid fill
  const inset = dw + 0.5;
  const ciTopL = topL + inset;
  const ciTopR = topR - inset;
  const ciBotL = botL + inset;
  const ciBotR = botR - inset;
  const ciTop = cupTop + inset;
  const ciBot = cupBot - inset;
  const ciR = iR * 0.8;

  const clipInnerPath = `
    M ${ciTopL} ${ciTop}
    L ${ciBotL} ${ciBot - ciR}
    Q ${ciBotL} ${ciBot} ${ciBotL + ciR} ${ciBot}
    L ${ciBotR - ciR} ${ciBot}
    Q ${ciBotR} ${ciBot} ${ciBotR} ${ciBot - ciR}
    L ${ciTopR} ${ciTop}
    Z
  `;

  const lerpX = (y: number, isLeft: boolean) => {
    const t = (y - ciTop) / (ciBot - ciTop);
    return isLeft
      ? ciTopL + (ciBotL - ciTopL) * t
      : ciTopR + (ciBotR - ciTopR) * t;
  };

  // Calculate fill fractions
  // Glass fills up to maxFill; once full — proportions redistribute within the glass
  const maxFill = 0.93;
  const capacityMl = 250;
  const total = portion1 + portion2;
  const rawFill = total > 0 ? total / capacityMl : 0;
  const fillScale = rawFill > maxFill ? maxFill / rawFill : 1;
  const totalFill = Math.min(rawFill, maxFill);
  const frac1 = total > 0 ? (portion1 / capacityMl) * fillScale : 0;
  const frac2 = total > 0 ? (portion2 / capacityMl) * fillScale : 0;

  // Build layers bottom-up: component 1 on bottom, component 2 on top
  const layers: { color: string; frac: number; process: string; intensity: string }[] = [];
  if (frac1 > 0 && process1 !== "none") {
    layers.push({ color: getProcessColor(process1, intensity1), frac: frac1, process: process1, intensity: intensity1 });
  }
  if (frac2 > 0 && process2 !== "none") {
    layers.push({ color: getProcessColor(process2, intensity2), frac: frac2, process: process2, intensity: intensity2 });
  }

  let layerY = ciBot;
  const layerEls: React.ReactElement[] = [];
  let topLayerProcess = "";
  let topLayerIntensity = "medium";
  let topLayerY = ciBot;
  let topLayerH = 0;

  for (let i = 0; i < layers.length; i++) {
    const { color, frac, process, intensity } = layers[i];
    const lh = cupH * frac;
    const y1 = layerY;
    const y0 = layerY - lh;
    layerY = y0;

    if (i === layers.length - 1) {
      topLayerProcess = process;
      topLayerIntensity = intensity;
      topLayerY = y0;
      topLayerH = lh;
    }

    const x0L = lerpX(y0, true);
    const x0R = lerpX(y0, false);
    const x1L = lerpX(y1, true);
    const x1R = lerpX(y1, false);

    const isBottom = i === 0;
    const bR = isBottom ? ciR : 0;

    layerEls.push(
      <path
        key={i}
        d={
          isBottom
            ? `M ${x0L} ${y0} L ${x1L} ${y1 - bR} Q ${x1L} ${y1} ${x1L + bR} ${y1} L ${x1R - bR} ${y1} Q ${x1R} ${y1} ${x1R} ${y1 - bR} L ${x0R} ${y0} Z`
            : `M ${x0L} ${y0} L ${x1L} ${y1} L ${x1R} ${y1} L ${x0R} ${y0} Z`
        }
        fill={color}
      />,
    );

    // Blend zone between layers
    if (layers.length > 1 && i > 0) {
      const prevColor = layers[i - 1].color;
      const blendId = `blend-${i}`;
      const blendH = Math.min(lh * 0.4, cupH * 0.06);
      const by0 = y1 - blendH;
      const bx0L = lerpX(by0, true);
      const bx0R = lerpX(by0, false);
      const bx1L = lerpX(y1, true);
      const bx1R = lerpX(y1, false);

      layerEls.push(
        <defs key={`bd${i}`}>
          <linearGradient id={blendId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor={prevColor} />
          </linearGradient>
        </defs>,
        <path
          key={`bz${i}`}
          d={`M ${bx0L} ${by0} L ${bx1L} ${y1} L ${bx1R} ${y1} L ${bx0R} ${by0} Z`}
          fill={`url(#${blendId})`}
        />,
      );
    }
  }

  // Foam/crema on top — scales with top layer height, max 4px
  const foamH = Math.min(4, topLayerH * 0.15);
  const hasCoffeeOnTop = topLayerProcess === "coffee" && topLayerY < ciBot;
  const hasMilkOnTop = topLayerProcess === "milk" && topLayerY < ciBot;
  const hasFoam = hasCoffeeOnTop || hasMilkOnTop;
  const cremaColor = getCoffeeCremaColor(topLayerIntensity);
  const milkFoamColor = "#F5EDE3"; // warm white foam

  // Has any liquid?
  const hasLiquid = layers.length > 0;

  // Volume label
  const totalMl = portion1 + portion2;

  // Steam
  const heat1 = process1 !== "none" ? (TEMP_HEAT[temp1] || 0.5) * portion1 : 0;
  const heat2 = process2 !== "none" ? (TEMP_HEAT[temp2] || 0.5) * portion2 : 0;
  const avgHeat = totalMl > 0 ? (heat1 + heat2) / totalMl : 0;
  const volFactor = Math.min(totalMl / 200, 1);
  const steamIntensity = avgHeat * volFactor;
  const steamH = 4 + steamIntensity * 10;
  const steamOpacity = steamIntensity * 0.45;

  // Handle attachment points
  const hTop = cupTop + cupH * 0.15;
  const hBot = cupTop + cupH * 0.62;
  const hOut = topR + 14;

  // Liquid surface Y for meniscus highlight
  const liquidSurfaceY = hasLiquid ? topLayerY : ciBot;

  return (
    <div className="flex flex-col items-center gap-2">
      <svg
        width={size}
        height={size * (vbH / vbW)}
        viewBox={`0 0 ${vbW} ${vbH}`}
        fill="none"
      >
        <defs>
          {/* Clip path for liquid — inner wall bounds */}
          <clipPath id="fs-clip">
            <path d={clipInnerPath} />
          </clipPath>

          {/* Clip for glass outline */}
          <clipPath id="fs-glass-clip">
            <path d={glassOutlinePath} />
          </clipPath>

          {/* Left specular highlight gradient — sharp bright edge */}
          <linearGradient id="fs-spec-l" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="white" stopOpacity="0.70" />
            <stop offset="15%" stopColor="white" stopOpacity="0.25" />
            <stop offset="35%" stopColor="white" stopOpacity="0.05" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </linearGradient>

          {/* Right subtle edge reflection */}
          <linearGradient id="fs-spec-r" x1="1" y1="0" x2="0" y2="0">
            <stop offset="0%" stopColor="white" stopOpacity="0.20" />
            <stop offset="20%" stopColor="white" stopOpacity="0.06" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </linearGradient>

          {/* Full glass body reflection — cylindrical curvature */}
          <linearGradient id="fs-body-refl" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="white" stopOpacity="0.16" />
            <stop offset="10%" stopColor="white" stopOpacity="0.06" />
            <stop offset="40%" stopColor="white" stopOpacity="0" />
            <stop offset="60%" stopColor="white" stopOpacity="0" />
            <stop offset="90%" stopColor="white" stopOpacity="0.04" />
            <stop offset="100%" stopColor="white" stopOpacity="0.10" />
          </linearGradient>

          {/* Liquid edge darkening — simulates cylindrical glass curvature */}
          <linearGradient id="fs-liquid-depth" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="black" stopOpacity="0.35" />
            <stop offset="15%" stopColor="black" stopOpacity="0.10" />
            <stop offset="35%" stopColor="black" stopOpacity="0" />
            <stop offset="65%" stopColor="black" stopOpacity="0" />
            <stop offset="85%" stopColor="black" stopOpacity="0.10" />
            <stop offset="100%" stopColor="black" stopOpacity="0.30" />
          </linearGradient>

          {/* Liquid highlight — subtle lighter center strip */}
          <linearGradient id="fs-liquid-highlight" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="white" stopOpacity="0" />
            <stop offset="30%" stopColor="white" stopOpacity="0.04" />
            <stop offset="50%" stopColor="white" stopOpacity="0.08" />
            <stop offset="70%" stopColor="white" stopOpacity="0.04" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </linearGradient>

          {/* Inner bottom shadow — depth at glass floor */}
          <linearGradient id="fs-inner-bottom" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="black" stopOpacity="0" />
            <stop offset="70%" stopColor="black" stopOpacity="0" />
            <stop offset="100%" stopColor="black" stopOpacity="0.20" />
          </linearGradient>

          {/* Glass empty area — subtle depth tint */}
          <linearGradient id="fs-glass-empty" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="white" stopOpacity="0.03" />
            <stop offset="30%" stopColor="black" stopOpacity="0.02" />
            <stop offset="70%" stopColor="black" stopOpacity="0.02" />
            <stop offset="100%" stopColor="white" stopOpacity="0.03" />
          </linearGradient>

          {/* Meniscus highlight — liquid surface */}
          <linearGradient id="fs-meniscus" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="white" stopOpacity="0" />
            <stop offset="20%" stopColor="white" stopOpacity="0.15" />
            <stop offset="50%" stopColor="white" stopOpacity="0.25" />
            <stop offset="80%" stopColor="white" stopOpacity="0.15" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </linearGradient>

          {/* Bottom reflection fade */}
          <linearGradient id="fs-rfade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="white" stopOpacity="0.10" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </linearGradient>
          <mask id="fs-rmask">
            <rect x="0" y={cupBot + 2} width={vbW + 20} height={cupH * 0.3} fill="url(#fs-rfade)" />
          </mask>

          {/* Foam/crema gradient */}
          {hasFoam && (() => {
            const color = hasCoffeeOnTop ? cremaColor : milkFoamColor;
            return (
              <linearGradient id="fs-foam" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={color} stopOpacity="0.5" />
                <stop offset="20%" stopColor={color} stopOpacity="0.9" />
                <stop offset="50%" stopColor={color} stopOpacity="1" />
                <stop offset="80%" stopColor={color} stopOpacity="0.9" />
                <stop offset="100%" stopColor={color} stopOpacity="0.5" />
              </linearGradient>
            );
          })()}

          {/* Shadow ellipse gradient */}
          <radialGradient id="fs-shadow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="black" stopOpacity="0.15" />
            <stop offset="60%" stopColor="black" stopOpacity="0.06" />
            <stop offset="100%" stopColor="black" stopOpacity="0" />
          </radialGradient>

          {/* Double-wall gap gradient — visible depth between walls */}
          <linearGradient id="fs-dw-gap" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="white" stopOpacity="0.08" />
            <stop offset="15%" stopColor="white" stopOpacity="0.03" />
            <stop offset="50%" stopColor="black" stopOpacity="0.02" />
            <stop offset="85%" stopColor="white" stopOpacity="0.03" />
            <stop offset="100%" stopColor="white" stopOpacity="0.08" />
          </linearGradient>

          {/* Handle fill gradient for thickness */}
          <linearGradient id="fs-handle-fill" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="white" stopOpacity="0.04" />
            <stop offset="50%" stopColor="white" stopOpacity="0.02" />
            <stop offset="100%" stopColor="white" stopOpacity="0.06" />
          </linearGradient>
        </defs>

        {/* Steam */}
        {steamIntensity > 0.05 && (
          <g key={`steam-${steamH.toFixed(1)}-${steamOpacity.toFixed(2)}`}>
            <defs>
              <filter id="fs-steam-filter" x="-30%" y="-10%" width="160%" height="120%">
                <feTurbulence type="fractalNoise" baseFrequency="0.04 0.06" numOctaves={3} seed={2} result="noise">
                  <animate attributeName="seed" from="1" to="100" dur="40s" repeatCount="indefinite" />
                </feTurbulence>
                <feDisplacementMap in="SourceGraphic" in2="noise" scale={4} xChannelSelector="R" yChannelSelector="G" result="displaced" />
                <feGaussianBlur in="displaced" stdDeviation="1.2" />
              </filter>
              <linearGradient id="fs-steam-fade" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor="white" stopOpacity="1" />
                <stop offset="60%" stopColor="white" stopOpacity="0.6" />
                <stop offset="100%" stopColor="white" stopOpacity="0" />
              </linearGradient>
              <mask id="fs-steam-mask">
                <rect
                  x={topL - 10}
                  y={cupTop - steamH}
                  width={cupTopW + 20}
                  height={steamH + 2}
                  fill="url(#fs-steam-fade)"
                />
              </mask>
            </defs>
            <g filter="url(#fs-steam-filter)" mask="url(#fs-steam-mask)" opacity={steamOpacity}>
              <ellipse cx={cx - 12} cy={cupTop - steamH * 0.25} rx={8} ry={steamH * 0.3} fill="rgba(255,255,255,0.5)">
                <animate attributeName="cy" dur="15s" repeatCount="indefinite"
                  values={`${cupTop - steamH * 0.15};${cupTop - steamH * 0.35};${cupTop - steamH * 0.15}`} />
                <animate attributeName="rx" dur="15s" repeatCount="indefinite" values="8;11;8" />
              </ellipse>
              <ellipse cx={cx} cy={cupTop - steamH * 0.35} rx={10} ry={steamH * 0.35} fill="rgba(255,255,255,0.45)">
                <animate attributeName="cy" dur="12.5s" repeatCount="indefinite"
                  values={`${cupTop - steamH * 0.25};${cupTop - steamH * 0.45};${cupTop - steamH * 0.25}`} />
                <animate attributeName="rx" dur="12.5s" repeatCount="indefinite" values="10;14;10" />
              </ellipse>
              <ellipse cx={cx + 12} cy={cupTop - steamH * 0.2} rx={8} ry={steamH * 0.25} fill="rgba(255,255,255,0.4)">
                <animate attributeName="cy" dur="17.5s" repeatCount="indefinite"
                  values={`${cupTop - steamH * 0.1};${cupTop - steamH * 0.3};${cupTop - steamH * 0.1}`} />
                <animate attributeName="rx" dur="17.5s" repeatCount="indefinite" values="8;11;8" />
              </ellipse>
            </g>
          </g>
        )}

        {/* Base shadow on surface */}
        <ellipse cx={cx + 4} cy={cupBot + 5} rx={cupBotW * 0.75} ry={3.5} fill="url(#fs-shadow)" />

        {/* Outer glass body */}
        <path
          d={glassOutlinePath}
          fill="var(--glass-fill)"
          stroke="var(--glass-stroke)"
          strokeWidth={1.0}
          strokeLinejoin="round"
        />

        {/* Double-wall gap fill — visible depth between walls */}
        <path d={glassOutlinePath} fill="url(#fs-dw-gap)" />

        {/* Glass empty area depth tint */}
        <path d={glassOutlinePath} fill="url(#fs-glass-empty)" />

        {/* Inner wall contour — double-wall effect */}
        <path
          d={innerWallPath}
          fill="none"
          stroke="var(--glass-stroke)"
          strokeWidth={0.6}
          strokeLinejoin="round"
          opacity={0.40}
        />

        {/* Drink layers — clipped to inner wall */}
        <g clipPath="url(#fs-clip)">
          {layerEls}
        </g>

        {/* Liquid edge darkening — cylindrical depth */}
        {hasLiquid && (
          <g clipPath="url(#fs-clip)">
            <rect
              x={topL}
              y={topLayerY}
              width={cupTopW}
              height={ciBot - topLayerY}
              fill="url(#fs-liquid-depth)"
            />
          </g>
        )}

        {/* Liquid subtle center highlight */}
        {hasLiquid && (
          <g clipPath="url(#fs-clip)">
            <rect
              x={topL}
              y={topLayerY}
              width={cupTopW}
              height={ciBot - topLayerY}
              fill="url(#fs-liquid-highlight)"
            />
          </g>
        )}

        {/* Inner bottom shadow — depth at glass floor */}
        {hasLiquid && (
          <g clipPath="url(#fs-clip)">
            <rect
              x={botL}
              y={ciBot - 12}
              width={cupBotW}
              height={12}
              fill="url(#fs-inner-bottom)"
            />
          </g>
        )}

        {/* Foam layer on top — crema for coffee, milk foam for milk */}
        {hasFoam && (
          <g clipPath="url(#fs-clip)">
            {(() => {
              const surfaceY = Math.max(topLayerY, ciTop);
              const fy0 = surfaceY;
              const fy1 = surfaceY + foamH;
              const fx0L = lerpX(fy0, true);
              const fx0R = lerpX(fy0, false);
              const fx1L = lerpX(fy1, true);
              const fx1R = lerpX(fy1, false);
              const highlightColor = hasCoffeeOnTop ? cremaColor : "#FFFFFF";
              const highlightOpacity = hasCoffeeOnTop ? 0.4 : 0.3;
              return (
                <>
                  <path
                    d={`M ${fx0L} ${fy0} L ${fx1L} ${fy1} L ${fx1R} ${fy1} L ${fx0R} ${fy0} Z`}
                    fill="url(#fs-foam)"
                  />
                  {/* Foam highlight — lighter center */}
                  <ellipse
                    cx={cx}
                    cy={(fy0 + fy1) / 2}
                    rx={(fx0R - fx0L) * 0.25}
                    ry={foamH * 0.35}
                    fill={highlightColor}
                    opacity={highlightOpacity}
                  />
                </>
              );
            })()}
          </g>
        )}

        {/* Meniscus — liquid surface highlight */}
        {hasLiquid && (
          <g clipPath="url(#fs-clip)">
            {(() => {
              const mY = liquidSurfaceY;
              const mL = lerpX(mY, true);
              const mR = lerpX(mY, false);
              return (
                <line
                  x1={mL + 2} y1={mY + 0.5}
                  x2={mR - 2} y2={mY + 0.5}
                  stroke="url(#fs-meniscus)"
                  strokeWidth={1.2}
                  strokeLinecap="round"
                />
              );
            })()}
          </g>
        )}

        {/* Glass body reflection overlay */}
        <path d={glassOutlinePath} fill="url(#fs-body-refl)" />

        {/* Left specular highlight — narrow bright strip */}
        <path
          d={`
            M ${topL + 1} ${cupTop + 3}
            L ${botL + 1.5} ${cupBot - r - 2}
            L ${botL + 6} ${cupBot - r - 2}
            L ${topL + 5.5} ${cupTop + 3}
            Z
          `}
          fill="url(#fs-spec-l)"
        />

        {/* Secondary left highlight — softer, wider */}
        <path
          d={`
            M ${topL + 5} ${cupTop + 5}
            L ${botL + 5} ${cupBot - r - 4}
            L ${botL + 10} ${cupBot - r - 4}
            L ${topL + 10} ${cupTop + 5}
            Z
          `}
          fill="rgba(255,255,255,0.04)"
        />

        {/* Right edge subtle highlight */}
        <path
          d={`
            M ${topR - 5} ${cupTop + 3}
            L ${botR - 4} ${cupBot - r - 2}
            L ${botR - 1} ${cupBot - r - 2}
            L ${topR - 1} ${cupTop + 3}
            Z
          `}
          fill="url(#fs-spec-r)"
        />

        {/* Handle — C-shaped with visible thickness */}
        <path
          d={`
            M ${topR - 0.5} ${hTop}
            C ${topR + 6} ${hTop - 2},
              ${hOut} ${hTop + 8},
              ${hOut} ${(hTop + hBot) / 2}
            C ${hOut} ${hBot - 8},
              ${topR + 6} ${hBot + 2},
              ${topR - 0.5} ${hBot}
          `}
          stroke="var(--glass-stroke)"
          strokeWidth={2.5}
          fill="url(#fs-handle-fill)"
          strokeLinecap="round"
        />
        {/* Handle outer highlight */}
        <path
          d={`
            M ${topR + 2} ${hTop + 3}
            C ${topR + 6} ${hTop + 1},
              ${hOut + 1} ${hTop + 10},
              ${hOut + 1} ${(hTop + hBot) / 2}
            C ${hOut + 1} ${hBot - 10},
              ${topR + 6} ${hBot - 1},
              ${topR + 2} ${hBot - 3}
          `}
          stroke="rgba(255,255,255,0.10)"
          strokeWidth={0.5}
          fill="none"
          strokeLinecap="round"
        />
        {/* Handle inner shadow */}
        <path
          d={`
            M ${topR} ${hTop + 5}
            C ${topR + 4} ${hTop + 3},
              ${hOut - 3} ${hTop + 11},
              ${hOut - 3} ${(hTop + hBot) / 2}
            C ${hOut - 3} ${hBot - 11},
              ${topR + 4} ${hBot - 3},
              ${topR} ${hBot - 5}
          `}
          stroke="rgba(0,0,0,0.08)"
          strokeWidth={0.5}
          fill="none"
          strokeLinecap="round"
        />

        {/* Reflection below glass surface */}
        <g mask="url(#fs-rmask)">
          <g transform={`translate(0, ${cupBot * 2 + 4}) scale(1, -1)`}>
            <path
              d={glassOutlinePath}
              fill="rgba(255,255,255,0.02)"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={0.6}
              strokeLinejoin="round"
            />
            <g clipPath="url(#fs-clip)" opacity={0.3}>
              {layerEls}
            </g>
          </g>
        </g>
      </svg>

      {!hideVolume && (
        <span className="text-sm text-neutral-500 tabular-nums">{totalMl} ml</span>
      )}
    </div>
  );
}
