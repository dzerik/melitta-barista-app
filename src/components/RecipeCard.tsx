import type { RecipeDetails } from "../lib/entities";
import { recipeDisplayName, type ContractRecipeFields } from "../lib/recipes";
import { CoffeeIcon } from "./CoffeeIcon";
import { DrinkStage } from "./ui";

export interface RecipeCardData extends ContractRecipeFields {
  name: string;
  isSelected: boolean;
  details?: RecipeDetails;
}

interface Props {
  recipe: RecipeCardData;
  /**
   * "This one" — the cell the pointer/carousel is on. It lights the drink's
   * glow to 1× (§6.2), which is the whole active-cell signal now: the card
   * itself paints nothing and the drink render never changes.
   */
  active: boolean;
  /** Hover/touch intermediate state. §C3.4: hover changes COLOUR only. */
  hovered: boolean;
  /**
   * Retired. Unselected cells stay at full opacity and are separated by glow
   * alpha, not by dimming (§10 + violation inventory). Still accepted so an
   * older call site compiles; it has no effect.
   */
  dimInactive?: boolean;
  /** Display size: normal for grid/carousel, large for the detail pane. */
  size?: "normal" | "large";
  iconSize?: number;
  onClick: () => void;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
  renderInfo?: (details: RecipeDetails) => React.ReactNode;
  className?: string;
}

/**
 * One drink cell: the drink, its name, its composition — three fixed bands so
 * names and figures line up across a row no matter how many components a
 * recipe has (§R1.5).
 *
 * Nothing here paints a rectangle. The card has `border-radius: 0`, no fill,
 * no ring and no shadow; `--surface-card-active` and the `inset 0 0 0 1px`
 * selection ring are both gone. Being the active cell is said by the
 * DrinkStage glow at 1×; being the CHOSEN recipe is said by the name turning
 * `--text-primary` over a lit 1px `--accent` underline in a slot that is
 * always reserved, so selection never shifts a pixel.
 */
export function RecipeCard({
  recipe,
  active,
  hovered,
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
  const chosen = recipe.isSelected;

  // No `.tap` here on purpose: that utility forces `display: inline-flex`,
  // which would beat the three-band grid this cell is built on. The reach is
  // satisfied structurally — the smallest cell is far past 48px.
  return (
    <button
      onClick={onClick}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      aria-pressed={chosen}
      data-ui="recipe-card"
      data-active={active ? "true" : "false"}
      data-underline={chosen ? "lit" : "reserved"}
      className={`press group grid w-full cursor-pointer justify-items-center ${
        isLarge ? "gap-3 p-4" : "gap-2 p-3"
      } ${className}`}
      style={{
        gridTemplateRows: `1fr auto ${isLarge ? "3rem" : "2.75rem"}`,
        borderRadius: 0,
        boxShadow: "none",
        transition: "color 0.25s var(--ease), transform 0.12s var(--ease)",
      }}
    >
      {/* The drink itself leads — everything else describes it. */}
      <div className="flex items-center justify-center w-full min-h-0">
        <DrinkStage size={resolvedIconSize} active={active}>
          <CoffeeIcon
            recipe={recipe.name}
            size={resolvedIconSize}
            icon={recipe.icon}
            nameKey={recipe.nameKey}
          />
        </DrinkStage>
      </div>

      <span
        data-ui="recipe-name"
        className={`text-center shrink-0 truncate max-w-full ${
          isLarge ? "t-title" : "t-body"
        }`}
        style={{
          color:
            chosen || active || hovered
              ? "var(--text-primary)"
              : "var(--text-secondary)",
          fontWeight: chosen ? 600 : 400,
          borderBottomWidth: "var(--underline-w)",
          borderBottomStyle: "solid",
          borderBottomColor: chosen ? "var(--accent)" : "transparent",
          borderRadius: 0,
        }}
      >
        {label}
      </span>

      <div className="flex items-start justify-center w-full min-w-0">
        {recipe.details && renderInfo ? renderInfo(recipe.details) : null}
      </div>
    </button>
  );
}
