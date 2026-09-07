import type { RecipeDetails } from "../lib/entities";
import { recipeDisplayName, type ContractRecipeFields } from "../lib/recipes";
import { CoffeeIcon } from "./CoffeeIcon";
import { DrinkStage, TRUTH_UNSERVED, underlineSlot } from "./ui";
import { drinkBounds } from "./CoffeeIcon";

export interface RecipeCardData extends ContractRecipeFields {
  name: string;
  isSelected: boolean;
  details?: RecipeDetails;
}

/**
 * What this drink actually serves, in ml.
 *
 * The served IconSpec's `total_ml` is the machine's own truth and wins; the
 * legacy tier sums the two component portions off the recipe attributes. 0
 * means nothing was served and there is no magnitude to scale to.
 */
export function recipeTotalMl(recipe: RecipeCardData): number {
  const served = recipe.icon?.total_ml;
  if (typeof served === "number" && Number.isFinite(served) && served > 0) {
    return served;
  }
  const details = recipe.details;
  if (!details) return 0;
  const total = (details.c1_portion_ml || 0) + (details.c2_portion_ml || 0);
  return Number.isFinite(total) && total > 0 ? total : 0;
}

/**
 * The maximum every glass on a shelf is measured against (§6.3).
 *
 * Deliberately the WHOLE list rather than the eight cells of one page: a
 * drink that changed size when you swiped to the next page would be lying
 * about its volume, which is the one thing the truth scale exists to tell.
 */
export function shelfMaxMl(recipes: readonly RecipeCardData[]): number {
  return recipes.reduce((max, r) => Math.max(max, recipeTotalMl(r)), 0);
}

/**
 * This drink's 0–1 magnitude against the shelf maximum, or `TRUTH_UNSERVED`
 * where no volume is served — a drink with no known volume must not draw
 * itself as the largest thing on the shelf (§6.3).
 */
export function truthFraction(
  recipe: RecipeCardData,
  shelfMax: number,
): number {
  const ml = recipeTotalMl(recipe);
  return shelfMax > 0 && ml > 0 ? ml / shelfMax : TRUTH_UNSERVED;
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
  /**
   * §6.3 truth scale: this drink's magnitude as a 0–1 fraction of its row's
   * maximum, from `truthFraction()`. Supplied, the glass is drawn at
   * `truthScale(fraction)` of the cell's size and bottom-aligned inside the
   * full unscaled box, so bases land on one line and tops stay ragged.
   * Omitted — a lone hero with nothing to be compared against — the drink
   * draws at its size exactly, as it always has.
   */
  scaleTo?: number;
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
 *
 * ONE CELL, ONE NAME SIZE (C11). A cell names its drink at `t-body` and a
 * hero names it at `t-title`; the rung is chosen by `size`, never by the
 * section doing the rendering. The audit found the same 140px paged-matrix
 * cell setting its name `t-body` here and `t-title font-light` in the
 * sommelier — §7.2 reserves the `t-title`/`font-light` treatment for the
 * hero rung, which this card already takes at `size="large"`.
 */
export function RecipeCard({
  recipe,
  active,
  hovered,
  size = "normal",
  iconSize,
  scaleTo,
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

  // R5 / H13 — NO `.tap` HERE, ON PURPOSE, AND THE REACH IS HONEST ANYWAY.
  //
  // `.tap` sets `display: inline-flex` along with the two minimums
  // (src/index.css), and this cell is a three-band `grid` — adopting the class
  // would replace the grid formatting context and collapse the drink/name/
  // composition bands the whole shelf aligns on (§R1.5). So the class stays
  // off and the CONTRACT it exists to enforce is written into the style object
  // instead: `var(--tap)` on both axes, the same 48px floor every other
  // control asserts, from the same token. The audit's "the painted cell is
  // already past 48px in the 4×2 grid" was true but incidental — it depended
  // on the caller's grid rather than on the cell promising anything. Now the
  // cell promises it.
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
        minHeight: "var(--tap)",
        minWidth: "var(--tap)",
        borderRadius: 0,
        boxShadow: "none",
        transition: "color 0.25s var(--ease), transform 0.12s var(--ease)",
      }}
    >
      {/* The drink itself leads — everything else describes it. */}
      <div className="flex items-center justify-center w-full min-h-0">
        <DrinkStage
          size={resolvedIconSize}
          active={active}
          bounds={drinkBounds(recipe.name, recipe.nameKey, recipe.icon)}
        >
          <CoffeeIcon
            recipe={recipe.name}
            size={resolvedIconSize}
            icon={recipe.icon}
            nameKey={recipe.nameKey}
            scaleTo={scaleTo}
            baseline={scaleTo !== undefined}
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
          ...underlineSlot(chosen),
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
