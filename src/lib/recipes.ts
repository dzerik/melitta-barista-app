/**
 * Contract recipe-catalog helpers (UI Contract v1 adoption): served
 * `name_key` labels (§6.3.6) and the join of catalog data (icon spec,
 * name_key) onto the app's recipe rows. Pure module — components stay thin.
 */
import type { IconSpec, UiContract } from "./contract";
import { serverString } from "./server-strings";

/** The contract-derived fields a recipe row may carry. */
export interface ContractRecipeFields {
  /** Served IconSpec from the contract catalog (§3.6); absent → PNG lookup. */
  icon?: IconSpec | null;
  /** Served stable name_key (§6.3.6) for labels and asset lookup. */
  nameKey?: string;
}

/**
 * Display label for a recipe row: server `recipes.name.<name_key>` string
 * (§6.3.6) when the contract supplied a name_key and the string is served,
 * otherwise the English display name — the current legacy behavior.
 */
export function recipeDisplayName(recipe: { name: string } & ContractRecipeFields): string {
  if (recipe.nameKey !== undefined) {
    const served = serverString(`recipes.name.${recipe.nameKey}`);
    if (served !== undefined) return served;
  }
  return recipe.name;
}

/**
 * Join contract catalog data (icon spec, name_key) onto recipe rows by
 * display name. Null/empty contract → the rows pass through untouched
 * (per-feature degradation to legacy rendering).
 */
export function attachContractRecipes<T extends { name: string } & ContractRecipeFields>(
  recipes: T[],
  contract: UiContract | null,
): T[] {
  const catalog = contract?.recipes;
  if (!catalog || catalog.length === 0) return recipes;
  const byName = new Map(catalog.map((r) => [r.name, r]));
  return recipes.map((r) => {
    const served = byName.get(r.name);
    if (!served) return r;
    return {
      ...r,
      icon: served.icon ?? r.icon ?? null,
      nameKey: served.name_key ?? r.nameKey,
    };
  });
}
