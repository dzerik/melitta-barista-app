import type { RecipeDetails } from "../lib/entities";
import { CoffeeIcon } from "./CoffeeIcon";

export interface RecipeCardData {
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
  iconSize = 140,
  onClick,
  onPointerEnter,
  onPointerLeave,
  renderInfo,
  className = "",
}: Props) {
  return (
    <button
      onClick={onClick}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      className={`flex flex-col items-center w-full transition-all duration-300 active:scale-[0.97] cursor-pointer ${className}`}
      style={{
        opacity: active ? 1 : !dimInactive ? 1 : hovered ? 1 : 0.35,
        background: active
          ? `linear-gradient(to top, ${recipe.isSelected ? "var(--recipe-selected-bg)" : "var(--surface)"}, transparent 80%)`
          : "transparent",
        border: "1px solid transparent",
        ...(active ? {
          borderImage: "linear-gradient(180deg, transparent, rgba(255,255,255,0.3), transparent) 4",
        } : {}),
      }}
    >
      {/* Name — uppercase, light weight */}
      <span
        className={`text-sm tracking-widest uppercase text-center transition-all duration-300 shrink-0 truncate w-full ${active ? "font-medium" : "font-light"}`}
        style={{
          color: active ? "var(--text-primary)" : "var(--text-tertiary)",
          letterSpacing: "0.12em",
        }}
      >
        {recipe.name}
      </span>

      {/* Icon */}
      <div className="flex-1 flex items-center justify-center w-full min-h-0 py-2">
        <CoffeeIcon recipe={recipe.name} size={iconSize} />
      </div>

      {/* Divider + recipe details */}
      {recipe.details && renderInfo ? (
        <div className="shrink-0 w-full">
          <div className="h-px my-2" style={{ background: "linear-gradient(90deg, transparent, var(--border-hover), transparent)" }} />
          <div className="flex justify-center">
            {renderInfo(recipe.details)}
          </div>
        </div>
      ) : (
        <div className="shrink-0 h-3" />
      )}
    </button>
  );
}
