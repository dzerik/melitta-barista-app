/** SVG coffee cup icon with drink layers (coffee / milk / foam). */

interface DrinkLayers {
  /** Bottom to top: [color, heightFraction][] */
  layers: [string, number][];
}

const DRINK_PROFILES: Record<string, DrinkLayers> = {
  // Black coffee (no milk)
  Espresso:              { layers: [["#3E1F0D", 0.30]] },
  Ristretto:             { layers: [["#2C1507", 0.22]] },
  Lungo:                 { layers: [["#4A2A14", 0.50]] },
  "Espresso Doppio":     { layers: [["#3E1F0D", 0.45]] },
  "Ristretto Doppio":    { layers: [["#2C1507", 0.40]] },
  "Café Crème":          { layers: [["#5C3A1E", 0.55], ["#C9A87C", 0.05]] },
  "Café Crème Doppio":   { layers: [["#5C3A1E", 0.65], ["#C9A87C", 0.05]] },
  Americano:             { layers: [["#4A2A14", 0.60]] },
  "Americano Extra":     { layers: [["#3E1F0D", 0.65]] },
  "Long Black":          { layers: [["#3E1F0D", 0.55]] },
  "Red Eye":             { layers: [["#3E1F0D", 0.65]] },
  "Black Eye":           { layers: [["#2C1507", 0.70]] },
  "Dead Eye":            { layers: [["#1A0D04", 0.75]] },

  // Milk drinks
  Cappuccino:            { layers: [["#3E1F0D", 0.25], ["#E8D5B7", 0.25], ["#F5EDE0", 0.20]] },
  "Espresso Macchiato":  { layers: [["#3E1F0D", 0.28], ["#F5EDE0", 0.12]] },
  "Caffè Latte":         { layers: [["#E8D5B7", 0.40], ["#6B4226", 0.15], ["#F5EDE0", 0.10]] },
  "Café au Lait":        { layers: [["#C9A87C", 0.55], ["#F5EDE0", 0.08]] },
  "Flat White":          { layers: [["#3E1F0D", 0.20], ["#E8D5B7", 0.35], ["#F0E6D8", 0.05]] },
  "Latte Macchiato":     { layers: [["#E8D5B7", 0.30], ["#6B4226", 0.15], ["#E8D5B7", 0.10], ["#F5EDE0", 0.15]] },
  "Latte Macchiato Extra": { layers: [["#E8D5B7", 0.30], ["#5C3A1E", 0.20], ["#E8D5B7", 0.10], ["#F5EDE0", 0.12]] },
  "Latte Macchiato Triple": { layers: [["#E8D5B7", 0.25], ["#4A2A14", 0.25], ["#E8D5B7", 0.10], ["#F5EDE0", 0.12]] },

  // Other
  Milk:                  { layers: [["#F5EDE0", 0.55]] },
  "Milk Froth":          { layers: [["#F5EDE0", 0.25], ["#FFFFFF", 0.30]] },
  "Hot Water":           { layers: [["#B8D4E3", 0.50]] },
};

// Fallback
const DEFAULT_PROFILE: DrinkLayers = { layers: [["#5C3A1E", 0.45]] };

interface Props {
  recipe: string;
  size?: number;
}

export function CoffeeIcon({ recipe, size = 56 }: Props) {
  const profile = DRINK_PROFILES[recipe] || DEFAULT_PROFILE;
  const cupW = size * 0.7;
  const cupH = size * 0.65;
  const cupX = (size - cupW) / 2;
  const cupY = size * 0.18;
  const cupBottom = cupY + cupH;

  // Build layers from bottom
  let y = cupBottom;
  const rects = [...profile.layers].reverse().map(([color, frac], i) => {
    const h = cupH * frac;
    y -= h;
    return (
      <rect
        key={i}
        x={cupX + 2}
        y={y}
        width={cupW - 4}
        height={h}
        fill={color}
        rx={i === 0 ? 0 : 0}
      />
    );
  });

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Cup body */}
      <rect
        x={cupX}
        y={cupY}
        width={cupW}
        height={cupH}
        rx={4}
        fill="#2A1A0E"
        stroke="#5C3A1E"
        strokeWidth={1.5}
      />
      {/* Drink layers (clipped to cup) */}
      <clipPath id={`cup-${recipe.replace(/\s/g, "")}`}>
        <rect x={cupX + 1} y={cupY + 1} width={cupW - 2} height={cupH - 2} rx={3} />
      </clipPath>
      <g clipPath={`url(#cup-${recipe.replace(/\s/g, "")})`}>{rects}</g>
      {/* Handle */}
      <path
        d={`M ${cupX + cupW} ${cupY + cupH * 0.2} C ${cupX + cupW + size * 0.15} ${cupY + cupH * 0.2}, ${cupX + cupW + size * 0.15} ${cupY + cupH * 0.7}, ${cupX + cupW} ${cupY + cupH * 0.7}`}
        stroke="#5C3A1E"
        strokeWidth={1.5}
        fill="none"
      />
      {/* Saucer */}
      <ellipse
        cx={size / 2}
        cy={cupBottom + 3}
        rx={cupW * 0.65}
        ry={3}
        fill="#3D2517"
        stroke="#5C3A1E"
        strokeWidth={1}
      />
      {/* Steam wisps for hot drinks */}
      {recipe !== "Milk" && recipe !== "Milk Froth" && (
        <g opacity={0.3} stroke="#C9A87C" strokeWidth={1} fill="none">
          <path d={`M ${size * 0.4} ${cupY - 2} C ${size * 0.38} ${cupY - 8}, ${size * 0.42} ${cupY - 12}, ${size * 0.38} ${cupY - 16}`} />
          <path d={`M ${size * 0.5} ${cupY - 1} C ${size * 0.52} ${cupY - 7}, ${size * 0.48} ${cupY - 11}, ${size * 0.52} ${cupY - 15}`} />
          <path d={`M ${size * 0.6} ${cupY - 2} C ${size * 0.58} ${cupY - 8}, ${size * 0.62} ${cupY - 12}, ${size * 0.58} ${cupY - 16}`} />
        </g>
      )}
    </svg>
  );
}
