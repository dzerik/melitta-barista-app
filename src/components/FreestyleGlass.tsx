/**
 * Dynamic glass visualization for freestyle drink builder.
 * Shows layers filling up based on component portions and processes.
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
  const vbW = 100;
  const vbH = 130;

  // Tall glass geometry
  const cupTopW = 40;
  const cupBotW = 32;
  const cupH = 72;
  const cupTop = 22;
  const cupBot = cupTop + cupH;
  const cx = 50;

  const topL = cx - cupTopW / 2;
  const topR = cx + cupTopW / 2;
  const botL = cx - cupBotW / 2;
  const botR = cx + cupBotW / 2;

  const r = 4;
  const glassPath = `
    M ${topL} ${cupTop}
    L ${botL + r} ${cupBot - r}
    Q ${botL} ${cupBot} ${botL + r} ${cupBot}
    L ${botR - r} ${cupBot}
    Q ${botR} ${cupBot} ${botR - r} ${cupBot - r}
    L ${topR} ${cupTop}
  `;

  const inset = 1.5;
  const ciTopL = topL + inset;
  const ciTopR = topR - inset;
  const ciBotL = botL + inset + r * 0.3;
  const ciBotR = botR - inset - r * 0.3;
  const ciTop = cupTop + inset;
  const ciBot = cupBot - inset;
  const ciR = r * 0.7;

  const lerpX = (y: number, isLeft: boolean) => {
    const t = (y - ciTop) / (ciBot - ciTop);
    return isLeft
      ? ciTopL + (ciBotL - ciTopL) * t
      : ciTopR + (ciBotR - ciTopR) * t;
  };

  // Calculate fill fractions (max total = 250ml mapped to full glass)
  const maxMl = 250;
  const total = Math.min(portion1 + portion2, maxMl);
  const frac1 = total > 0 ? (portion1 / maxMl) * 0.85 : 0;
  const frac2 = total > 0 ? (portion2 / maxMl) * 0.85 : 0;

  // Build layers bottom-up: component 1 on bottom, component 2 on top
  const layers: { color: string; frac: number }[] = [];
  if (frac1 > 0 && process1 !== "none") {
    layers.push({ color: getProcessColor(process1, intensity1), frac: frac1 });
  }
  if (frac2 > 0 && process2 !== "none") {
    layers.push({ color: getProcessColor(process2, intensity2), frac: frac2 });
  }

  let layerY = ciBot;
  const layerEls: React.ReactElement[] = [];

  for (let i = 0; i < layers.length; i++) {
    const { color, frac } = layers[i];
    const lh = cupH * frac;
    const y1 = layerY;
    const y0 = layerY - lh;
    layerY = y0;

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
            ? `M ${x0L} ${y0} L ${x1L + bR} ${y1 - bR} Q ${x1L} ${y1} ${x1L + bR} ${y1} L ${x1R - bR} ${y1} Q ${x1R} ${y1} ${x1R - bR} ${y1 - bR} L ${x0R} ${y0} Z`
            : `M ${x0L} ${y0} L ${x1L} ${y1} L ${x1R} ${y1} L ${x0R} ${y0} Z`
        }
        fill={color}
      />,
    );

    // Blend zone: overlay strip at boundary between this layer and the one below
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

  // Volume label
  const totalMl = portion1 + portion2;

  // Steam intensity: weighted average of temperature × volume fraction
  const heat1 = process1 !== "none" ? (TEMP_HEAT[temp1] || 0.5) * portion1 : 0;
  const heat2 = process2 !== "none" ? (TEMP_HEAT[temp2] || 0.5) * portion2 : 0;
  const avgHeat = totalMl > 0 ? (heat1 + heat2) / totalMl : 0;
  // Scale by volume (more liquid = more steam), cap at 1
  const volFactor = Math.min(totalMl / 200, 1);
  const steamIntensity = avgHeat * volFactor; // 0..1

  // Steam height and opacity proportional to intensity
  const steamH = 6 + steamIntensity * 14; // 6..20
  const steamOpacity = steamIntensity * 0.45; // 0..0.45

  return (
    <div className="flex flex-col items-center gap-2">
      <svg
        width={size}
        height={size * (vbH / vbW)}
        viewBox={`0 0 ${vbW} ${vbH}`}
        fill="none"
      >
        <defs>
          <clipPath id="fs-clip">
            <path d={`
              M ${ciTopL} ${ciTop}
              L ${ciBotL + ciR} ${ciBot - ciR}
              Q ${ciBotL} ${ciBot} ${ciBotL + ciR} ${ciBot}
              L ${ciBotR - ciR} ${ciBot}
              Q ${ciBotR} ${ciBot} ${ciBotR - ciR} ${ciBot - ciR}
              L ${ciTopR} ${ciTop}
              Z
            `} />
          </clipPath>
          <linearGradient id="fs-refl" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="white" stopOpacity="0.18" />
            <stop offset="15%" stopColor="white" stopOpacity="0.06" />
            <stop offset="50%" stopColor="white" stopOpacity="0" />
            <stop offset="80%" stopColor="white" stopOpacity="0.03" />
            <stop offset="100%" stopColor="white" stopOpacity="0.10" />
          </linearGradient>
          <linearGradient id="fs-spec" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="white" stopOpacity="0.35" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="fs-rfade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="white" stopOpacity="0.12" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </linearGradient>
          <mask id="fs-rmask">
            <rect x="0" y={cupBot + 1} width={vbW} height={cupH * 0.35} fill="url(#fs-rfade)" />
          </mask>
        </defs>

        {/* Steam — feTurbulence + feDisplacementMap for organic look */}
        {steamIntensity > 0.05 && (
          <g key={`steam-${steamH.toFixed(1)}-${steamOpacity.toFixed(2)}`}>
            {/* Steam filter: turbulence distortion + blur + fade mask */}
            <defs>
              <filter id="fs-steam-filter" x="-30%" y="-10%" width="160%" height="120%">
                <feTurbulence type="fractalNoise" baseFrequency="0.04 0.06" numOctaves={3} seed={2} result="noise">
                  <animate attributeName="seed" from="1" to="100" dur="40s" repeatCount="indefinite" />
                </feTurbulence>
                <feDisplacementMap in="SourceGraphic" in2="noise" scale={4} xChannelSelector="R" yChannelSelector="G" result="displaced" />
                <feGaussianBlur in="displaced" stdDeviation="1.2" />
              </filter>
              {/* Fade mask: steam fades out at top */}
              <linearGradient id="fs-steam-fade" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor="white" stopOpacity="1" />
                <stop offset="60%" stopColor="white" stopOpacity="0.6" />
                <stop offset="100%" stopColor="white" stopOpacity="0" />
              </linearGradient>
              <mask id="fs-steam-mask">
                <rect
                  x={topL}
                  y={cupTop - steamH}
                  width={cupTopW}
                  height={steamH}
                  fill="url(#fs-steam-fade)"
                />
              </mask>
            </defs>

            <g filter="url(#fs-steam-filter)" mask="url(#fs-steam-mask)" opacity={steamOpacity}>
              {/* Steam wisps spanning full glass width */}
              <ellipse cx={cx - 8} cy={cupTop - steamH * 0.35} rx={5} ry={steamH * 0.3} fill="rgba(255,255,255,0.5)">
                <animate attributeName="cy" dur="15s" repeatCount="indefinite"
                  values={`${cupTop - steamH * 0.25};${cupTop - steamH * 0.45};${cupTop - steamH * 0.25}`} />
                <animate attributeName="rx" dur="15s" repeatCount="indefinite"
                  values="5;7;5" />
              </ellipse>
              <ellipse cx={cx} cy={cupTop - steamH * 0.45} rx={6} ry={steamH * 0.35} fill="rgba(255,255,255,0.45)">
                <animate attributeName="cy" dur="12.5s" repeatCount="indefinite"
                  values={`${cupTop - steamH * 0.35};${cupTop - steamH * 0.55};${cupTop - steamH * 0.35}`} />
                <animate attributeName="rx" dur="12.5s" repeatCount="indefinite"
                  values="6;9;6" />
              </ellipse>
              <ellipse cx={cx + 8} cy={cupTop - steamH * 0.3} rx={5} ry={steamH * 0.25} fill="rgba(255,255,255,0.4)">
                <animate attributeName="cy" dur="17.5s" repeatCount="indefinite"
                  values={`${cupTop - steamH * 0.2};${cupTop - steamH * 0.4};${cupTop - steamH * 0.2}`} />
                <animate attributeName="rx" dur="17.5s" repeatCount="indefinite"
                  values="5;7;5" />
              </ellipse>
            </g>
          </g>
        )}

        {/* Glass body */}
        <path
          d={glassPath}
          fill="rgba(255,255,255,0.05)"
          stroke="rgba(255,255,255,0.4)"
          strokeWidth={1.2}
          strokeLinejoin="round"
        />

        {/* Drink layers */}
        <g clipPath="url(#fs-clip)">
          {layerEls}
        </g>

        {/* Glass reflections */}
        <path d={glassPath} fill="url(#fs-refl)" clipPath="url(#fs-clip)" />
        <path
          d={`
            M ${topL + 1.5} ${cupTop + 3}
            L ${botL + 2.5} ${cupBot - 5}
            L ${botL + 6.5} ${cupBot - 5}
            L ${topL + 5.5} ${cupTop + 3}
            Z
          `}
          fill="url(#fs-spec)"
        />
        <line
          x1={topR - 2.5} y1={cupTop + 5}
          x2={botR - 3} y2={cupBot - 7}
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={2}
          strokeLinecap="round"
        />
        <line
          x1={topL + 3} y1={cupTop + 0.5}
          x2={topR - 3} y2={cupTop + 0.5}
          stroke="rgba(255,255,255,0.15)"
          strokeWidth={0.8}
          strokeLinecap="round"
        />

        {/* Handle */}
        <path
          d={`M ${topR} ${cupTop + cupH * 0.18} C ${topR + 11} ${cupTop + cupH * 0.16}, ${topR + 11} ${cupTop + cupH * 0.67}, ${topR} ${cupTop + cupH * 0.65}`}
          stroke="rgba(255,255,255,0.4)"
          strokeWidth={1.2}
          fill="none"
          strokeLinecap="round"
        />

        {/* Reflection below */}
        <g mask="url(#fs-rmask)">
          <g transform={`translate(0, ${cupBot * 2 + 2}) scale(1, -1)`}>
            <path
              d={glassPath}
              fill="rgba(255,255,255,0.03)"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth={0.8}
              strokeLinejoin="round"
            />
            <g clipPath="url(#fs-clip)" opacity={0.4}>
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
