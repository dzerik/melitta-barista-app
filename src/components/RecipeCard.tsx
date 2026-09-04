import type { RecipeDetails } from "../lib/entities";
import { recipeDisplayName, type ContractRecipeFields } from "../lib/recipes";
import { CoffeeIcon } from "./CoffeeIcon";

export interface RecipeCardData extends ContractRecipeFields {
  name: string;
  isSelected: boolean;
  details?: RecipeDetails;
}

interface Props {
  recipe: RecipeCardData;
  /** Visual highlight state: fully opaque with gradient bg + border */
  active: boolean;
  /** Hover/touch intermediate state */
  hovered: boolean;
  /** Dim non-active cards (default true) */
  dimInactive?: boolean;
  /** Display size: normal for grid/carousel, large for detail panel */
  size?: "normal" | "large";
  iconSize?: number;
  onClick: () => void;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
  renderInfo?: (details: RecipeDetails) => React.ReactNode;
  className?: string;
}

export function RecipeCard({
  recipe,
  active,
  hovered,
  dimInactive = true,
  size = "normal",
  iconSize,
  onClick,
  onPointerEnter,
  onPointerLeave,
  renderInfo,
  className = "",
}: Props) {
  const isLarge = size === "large";
  const resolvedIconSize = iconSize ?? (isLarge ? 280 : 140);
  const label = recipeDisplayName(recipe);

  return (
    <button
      onClick={onClick}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      aria-pressed={recipe.isSelected}
      // Three fixed bands — drink, name, composition — so names and figures
      // line up across a row no matter how many components a recipe has.
      className={`press group grid w-full rounded-2xl cursor-pointer justify-items-center ${
        isLarge ? "gap-3 p-4" : "gap-2 p-3"
      } ${className}`}
      style={{
        gridTemplateRows: `1fr auto ${isLarge ? "3rem" : "2.75rem"}`,
        // Unselected cards stay legible: a confident interface does not
        // hide its own content behind 35% opacity.
        opacity: active || hovered || !dimInactive ? 1 : 0.72,
        background: active ? "var(--surface-card-active)" : "transparent",
        boxShadow: recipe.isSelected ? "inset 0 0 0 1px var(--border-active)" : "none",
        transition: "opacity 0.25s var(--ease), background-color 0.25s ease, box-shadow 0.25s ease, transform 0.12s var(--ease)",
      }}
    >
      {/* The drink itself leads — everything else describes it. */}
      <div className="flex-1 flex items-center justify-center w-full min-h-0">
        <CoffeeIcon recipe={recipe.name} size={resolvedIconSize} icon={recipe.icon} nameKey={recipe.nameKey} />
      </div>

      <span
        className={`text-center shrink-0 truncate w-full ${isLarge ? "t-title" : "t-body font-medium"}`}
        style={{ color: recipe.isSelected ? "var(--accent)" : "var(--text-primary)" }}
      >
        {label}
      </span>

      <div className="flex items-start justify-center w-full">
        {recipe.details && renderInfo ? renderInfo(recipe.details) : null}
      </div>
    </button>
  );
}
