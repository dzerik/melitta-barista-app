/**
 * Schematic glass coffee cup icon inspired by Cafection commercial machine UI.
 * Transparent glass outline with visible drink layers, handle, and steam.
 */

interface Layer {
  color: string;
  height: number; // fraction 0..1
}

interface DrinkProfile {
  layers: Layer[];
  foam?: { color: string; height: number };
  tall?: boolean; // tall glass (latte macchiato) vs short cup
}

const DRINKS: Record<string, DrinkProfile> = {
  // === Black coffee — short cup ===
  Espresso: {
    layers: [{ color: "#3E1F0D", height: 0.30 }],
    foam: { color: "#C9A87C", height: 0.04 },
  },
  Ristretto: {
    layers: [{ color: "#1A0D04", height: 0.22 }],
    foam: { color: "#B89970", height: 0.03 },
  },
  Lungo: {
    layers: [{ color: "#4A2A14", height: 0.50 }],
    foam: { color: "#C9A87C", height: 0.04 },
  },
  "Espresso Doppio": {
    layers: [{ color: "#3E1F0D", height: 0.45 }],
    foam: { color: "#C9A87C", height: 0.04 },
  },
  "Ristretto Doppio": {
    layers: [{ color: "#1A0D04", height: 0.40 }],
    foam: { color: "#B89970", height: 0.03 },
  },
  "Café Crème": {
    layers: [{ color: "#5C3A1E", height: 0.50 }],
    foam: { color: "#E8D5B7", height: 0.08 },
  },
  "Café Crème Doppio": {
    layers: [{ color: "#5C3A1E", height: 0.58 }],
    foam: { color: "#E8D5B7", height: 0.08 },
  },
  Americano: {
    layers: [{ color: "#3E1F0D", height: 0.60 }],
  },
  "Americano Extra": {
    layers: [{ color: "#2C1507", height: 0.65 }],
  },
  "Long Black": {
    layers: [{ color: "#3E1F0D", height: 0.55 }],
    foam: { color: "#C9A87C", height: 0.05 },
  },
  "Red Eye": {
    layers: [{ color: "#2C1507", height: 0.60 }],
  },
  "Black Eye": {
    layers: [{ color: "#1A0D04", height: 0.65 }],
  },
  "Dead Eye": {
    layers: [{ color: "#0F0803", height: 0.70 }],
  },

  // === Milk drinks — tall glass for layered, short for others ===
  Cappuccino: {
    layers: [
      { color: "#3E1F0D", height: 0.28 },
      { color: "#D4B896", height: 0.22 },
    ],
    foam: { color: "#F5EDE0", height: 0.18 },
  },
  "Espresso Macchiato": {
    layers: [{ color: "#3E1F0D", height: 0.30 }],
    foam: { color: "#F5EDE0", height: 0.12 },
  },
  "Caffè Latte": {
    tall: true,
    layers: [
      { color: "#E8D5B7", height: 0.35 },
      { color: "#8B5A30", height: 0.18 },
    ],
    foam: { color: "#F5EDE0", height: 0.10 },
  },
  "Café au Lait": {
    layers: [
      { color: "#C9A87C", height: 0.50 },
    ],
    foam: { color: "#F0E6D8", height: 0.06 },
  },
  "Flat White": {
    layers: [
      { color: "#3E1F0D", height: 0.20 },
      { color: "#D4B896", height: 0.30 },
    ],
    foam: { color: "#F0E6D8", height: 0.05 },
  },
  "Latte Macchiato": {
    tall: true,
    layers: [
      { color: "#F0E6D8", height: 0.28 },
      { color: "#6B4226", height: 0.12 },
      { color: "#E8D5B7", height: 0.12 },
    ],
    foam: { color: "#FEFCFA", height: 0.15 },
  },
  "Latte Macchiato Extra": {
    tall: true,
    layers: [
      { color: "#F0E6D8", height: 0.25 },
      { color: "#5C3A1E", height: 0.16 },
      { color: "#E8D5B7", height: 0.12 },
    ],
    foam: { color: "#FEFCFA", height: 0.14 },
  },
  "Latte Macchiato Triple": {
    tall: true,
    layers: [
      { color: "#F0E6D8", height: 0.22 },
      { color: "#4A2A14", height: 0.20 },
      { color: "#E8D5B7", height: 0.10 },
    ],
    foam: { color: "#FEFCFA", height: 0.14 },
  },

  // === Other ===
  Milk: {
    tall: true,
    layers: [{ color: "#F0E6D8", height: 0.55 }],
  },
  "Milk Froth": {
    tall: true,
    layers: [{ color: "#F0E6D8", height: 0.15 }],
    foam: { color: "#FEFCFA", height: 0.40 },
  },
  "Hot Water": {
    layers: [{ color: "#9DC4D8", height: 0.50 }],
  },
};

const DEFAULT: DrinkProfile = {
  layers: [{ color: "#5C3A1E", height: 0.45 }],
};

interface Props {
  recipe: string;
  size?: number;
}

export function CoffeeIcon({ recipe, size = 80 }: Props) {
  const profile = DRINKS[recipe] || DEFAULT;
  const isTall = profile.tall;
  const uid = recipe.replaceAll(/[^a-zA-Z0-9]/g, "");

  // Viewbox — extra height for reflection below
  const vbW = 100;
  const vbH = 115;

  // Cup geometry — slightly tapered like a real glass
  const cupTopW = isTall ? 36 : 50;
  const cupBotW = isTall ? 30 : 42;
  const cupH = isTall ? 68 : 48;
  const cupTop = isTall ? 12 : 28;
  const cupBot = cupTop + cupH;
  const cx = isTall ? 50 : 46; // center x (shifted left for handle room)

  const topL = cx - cupTopW / 2;
  const topR = cx + cupTopW / 2;
  const botL = cx - cupBotW / 2;
  const botR = cx + cupBotW / 2;

  // Glass outline path (trapezoid with rounded bottom)
  const r = 4; // bottom corner radius
  const glassPath = `
    M ${topL} ${cupTop}
    L ${botL + r} ${cupBot - r}
    Q ${botL} ${cupBot} ${botL + r} ${cupBot}
    L ${botR - r} ${cupBot}
    Q ${botR} ${cupBot} ${botR - r} ${cupBot - r}
    L ${topR} ${cupTop}
  `;

  // Clip path for layers (same shape but inset)
  const inset = 1.5;
  const ciTopL = topL + inset;
  const ciTopR = topR - inset;
  const ciBotL = botL + inset + r * 0.3;
  const ciBotR = botR - inset - r * 0.3;
  const ciTop = cupTop + inset;
  const ciBot = cupBot - inset;
  const ciR = r * 0.7;

  // Build layers bottom-up
  let layerY = ciBot;
  const layerEls: React.ReactElement[] = [];

  // Helper: interpolate X at given Y between top and bottom of cup
  const lerpX = (y: number, isLeft: boolean) => {
    const t = (y - ciTop) / (ciBot - ciTop); // 0=top, 1=bottom
    return isLeft
      ? ciTopL + (ciBotL - ciTopL) * t
      : ciTopR + (ciBotR - ciTopR) * t;
  };

  // Liquid layers
  const allLayers = [...profile.layers];
  for (let i = allLayers.length - 1; i >= 0; i--) {
    const { color, height: frac } = allLayers[i];
    const lh = cupH * frac;
    const y1 = layerY;
    const y0 = layerY - lh;
    layerY = y0;

    const x0L = lerpX(y0, true);
    const x0R = lerpX(y0, false);
    const x1L = lerpX(y1, true);
    const x1R = lerpX(y1, false);

    // Is this the bottom-most visible layer?
    const isBottom = i === allLayers.length - 1;
    const bR = isBottom ? ciR : 0;

    layerEls.push(
      <path
        key={`l${i}`}
        d={
          isBottom
            ? `M ${x0L} ${y0} L ${x1L + bR} ${y1 - bR} Q ${x1L} ${y1} ${x1L + bR} ${y1} L ${x1R - bR} ${y1} Q ${x1R} ${y1} ${x1R - bR} ${y1 - bR} L ${x0R} ${y0} Z`
            : `M ${x0L} ${y0} L ${x1L} ${y1} L ${x1R} ${y1} L ${x0R} ${y0} Z`
        }
        fill={color}
      />,
    );
  }

  // Foam layer
  if (profile.foam) {
    const fh = cupH * profile.foam.height;
    const y1 = layerY;
    const y0 = layerY - fh;
    layerY = y0;

    const x0L = lerpX(y0, true);
    const x0R = lerpX(y0, false);
    const x1L = lerpX(y1, true);
    const x1R = lerpX(y1, false);

    layerEls.push(
      <path
        key="foam"
        d={`M ${x0L} ${y0} L ${x1L} ${y1} L ${x1R} ${y1} L ${x0R} ${y0} Z`}
        fill={profile.foam.color}
      />,
    );

    // Foam top surface highlight (subtle arc)
    layerEls.push(
      <ellipse
        key="foam-top"
        cx={(x0L + x0R) / 2}
        cy={y0 + 0.5}
        rx={(x0R - x0L) / 2 - 1}
        ry={1.5}
        fill="rgba(255,255,255,0.25)"
      />,
    );
  }

  // Handle
  const handleX = topR;
  const hTop = cupTop + cupH * 0.18;
  const hBot = cupTop + cupH * 0.65;
  const hOut = isTall ? 10 : 14;

  // Steam paths (reused for glow + main lines)
  const steamPath1 = `M ${cx - 6} ${cupTop - 2} Q ${cx - 8} ${cupTop - 10} ${cx - 5} ${cupTop - 16}`;
  const steamAnim1 = `${steamPath1};M ${cx - 6} ${cupTop - 2} Q ${cx - 4} ${cupTop - 10} ${cx - 7} ${cupTop - 16};${steamPath1}`;
  const steamPath2 = `M ${cx + 1} ${cupTop - 3} Q ${cx + 3} ${cupTop - 11} ${cx} ${cupTop - 18}`;
  const steamAnim2 = `${steamPath2};M ${cx + 1} ${cupTop - 3} Q ${cx - 1} ${cupTop - 11} ${cx + 2} ${cupTop - 18};${steamPath2}`;
  const steamPath3 = `M ${cx + 8} ${cupTop - 2} Q ${cx + 6} ${cupTop - 9} ${cx + 9} ${cupTop - 15}`;
  const steamAnim3 = `${steamPath3};M ${cx + 8} ${cupTop - 2} Q ${cx + 10} ${cupTop - 9} ${cx + 7} ${cupTop - 15};${steamPath3}`;

  const steamEls = recipe !== "Milk" && recipe !== "Milk Froth" && (
    <>
      {/* Soft glow behind steam */}
      <g opacity={0.20} stroke="rgba(255,255,255,0.6)" strokeWidth={4} fill="none" strokeLinecap="round" filter={`url(#steam-glow-${uid})`}>
        <path d={steamPath1}>
          <animate attributeName="d" dur="3s" repeatCount="indefinite" values={steamAnim1} />
        </path>
        <path d={steamPath2}>
          <animate attributeName="d" dur="2.6s" repeatCount="indefinite" values={steamAnim2} />
        </path>
        <path d={steamPath3}>
          <animate attributeName="d" dur="3.3s" repeatCount="indefinite" values={steamAnim3} />
        </path>
      </g>
      {/* Main steam lines */}
      <g opacity={0.40} stroke="#D4C4A0" strokeWidth={1} fill="none" strokeLinecap="round">
        <path d={steamPath1}>
          <animate attributeName="d" dur="3s" repeatCount="indefinite" values={steamAnim1} />
        </path>
        <path d={steamPath2}>
          <animate attributeName="d" dur="2.6s" repeatCount="indefinite" values={steamAnim2} />
        </path>
        <path d={steamPath3}>
          <animate attributeName="d" dur="3.3s" repeatCount="indefinite" values={steamAnim3} />
        </path>
      </g>
    </>
  );

  return (
    <svg width={size} height={size * (vbH / vbW)} viewBox={`0 0 ${vbW} ${vbH}`} fill="none">
      <defs>
        {/* Clip for drink layers */}
        <clipPath id={`clip-${uid}`}>
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
        {/* Glass reflection gradient — horizontal for volume */}
        <linearGradient id={`refl-${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="white" stopOpacity="0.18" />
          <stop offset="15%" stopColor="white" stopOpacity="0.06" />
          <stop offset="50%" stopColor="white" stopOpacity="0" />
          <stop offset="80%" stopColor="white" stopOpacity="0.03" />
          <stop offset="100%" stopColor="white" stopOpacity="0.10" />
        </linearGradient>
        {/* Left edge specular highlight */}
        <linearGradient id={`spec-${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="white" stopOpacity="0.35" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
        {/* Steam glow blur */}
        <filter id={`steam-glow-${uid}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.5" />
        </filter>
        {/* Reflection fade mask */}
        <linearGradient id={`rfade-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="white" stopOpacity="0.15" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <mask id={`rmask-${uid}`}>
          <rect x="0" y={cupBot + 1} width={vbW} height={cupH * 0.4} fill={`url(#rfade-${uid})`} />
        </mask>
      </defs>

      {/* Steam behind cup */}
      {steamEls}

      {/* Glass body — transparent with outline */}
      <path
        d={glassPath}
        fill="rgba(255,255,255,0.06)"
        stroke="rgba(255,255,255,0.45)"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />

      {/* Drink layers clipped to glass shape */}
      <g clipPath={`url(#clip-${uid})`}>
        {layerEls}
      </g>

      {/* Glass volume — horizontal reflection gradient over entire cup */}
      <path
        d={glassPath}
        fill={`url(#refl-${uid})`}
        clipPath={`url(#clip-${uid})`}
      />

      {/* Left edge specular highlight — bright narrow strip */}
      <path
        d={`
          M ${topL + 1.5} ${cupTop + 3}
          L ${botL + 2.5} ${cupBot - 5}
          L ${botL + 2.5 + (isTall ? 4 : 5)} ${cupBot - 5}
          L ${topL + 1.5 + (isTall ? 4 : 5)} ${cupTop + 3}
          Z
        `}
        fill={`url(#spec-${uid})`}
      />

      {/* Right edge subtle reflection */}
      <line
        x1={topR - 2.5}
        y1={cupTop + 5}
        x2={botR - 3}
        y2={cupBot - 7}
        stroke="rgba(255,255,255,0.08)"
        strokeWidth={2}
        strokeLinecap="round"
      />

      {/* Glass rim highlight */}
      <line
        x1={topL + 3}
        y1={cupTop + 0.5}
        x2={topR - 3}
        y2={cupTop + 0.5}
        stroke="rgba(255,255,255,0.20)"
        strokeWidth={1}
        strokeLinecap="round"
      />

      {/* Handle */}
      <path
        d={`M ${handleX} ${hTop} C ${handleX + hOut} ${hTop - 2}, ${handleX + hOut} ${hBot + 2}, ${handleX} ${hBot}`}
        stroke="rgba(255,255,255,0.45)"
        strokeWidth={1.5}
        fill="none"
        strokeLinecap="round"
      />

      {/* Reflection — flipped cup mirrored below, fading out */}
      <g mask={`url(#rmask-${uid})`}>
        <g transform={`translate(0, ${cupBot * 2 + 2}) scale(1, -1)`}>
          {/* Reflected glass body */}
          <path
            d={glassPath}
            fill="rgba(255,255,255,0.04)"
            stroke="rgba(255,255,255,0.12)"
            strokeWidth={1}
            strokeLinejoin="round"
          />
          {/* Reflected layers */}
          <g clipPath={`url(#clip-${uid})`} opacity={0.5}>
            {layerEls}
          </g>
          {/* Reflected handle */}
          <path
            d={`M ${handleX} ${hTop} C ${handleX + hOut} ${hTop - 2}, ${handleX + hOut} ${hBot + 2}, ${handleX} ${hBot}`}
            stroke="rgba(255,255,255,0.12)"
            strokeWidth={1}
            fill="none"
          />
        </g>
      </g>
    </svg>
  );
}
