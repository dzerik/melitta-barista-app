import type { HassEntities, HassEntity } from "home-assistant-js-websocket";

/** Recipe details as stored in HA entity attributes. */
export interface RecipeDetails {
  c1_process: string;
  c1_intensity: string;
  c1_aroma: string;
  c1_temperature: string;
  c1_shots: number;
  c1_portion_ml: number;
  c2_process: string;
  c2_intensity: string;
  c2_aroma: string;
  c2_temperature: string;
  c2_shots: number;
  c2_portion_ml: number;
}

/** DirectKey recipe details per category, per profile. */
export interface DirectKeyRecipe {
  category: number;
  c1_process: string;
  c1_intensity: string;
  c1_aroma: string;
  c1_temperature: string;
  c1_shots: number;
  c1_portion_ml: number;
  c2_process: string;
  c2_intensity: string;
  c2_aroma: string;
  c2_temperature: string;
  c2_shots: number;
  c2_portion_ml: number;
}

/** All DirectKey data from profile select entity attributes. */
export interface DirectKeyData {
  activeProfile: number;
  /** profile_id → category_name → recipe */
  profiles: Record<number, Record<string, DirectKeyRecipe>>;
}

/** DirectKey category identifiers (match HA service values). */
export const DIRECTKEY_CATEGORIES = [
  "espresso",
  "cafe_creme",
  "cappuccino",
  "latte_macchiato",
  "milk_froth",
  // "milk",  // no physical button on Barista TS Smart
  "water",
] as const;

export type DirectKeyCategory = (typeof DIRECTKEY_CATEGORIES)[number];

/** Map display names (from HA attributes) to service category values. */
export const DIRECTKEY_DISPLAY_TO_KEY: Record<string, DirectKeyCategory> = {
  "Espresso": "espresso",
  "Café Crème": "cafe_creme",
  "Cappuccino": "cappuccino",
  "Latte Macchiato": "latte_macchiato",
  "Milk Froth": "milk_froth",
  // "Milk": "milk",  // no physical button on Barista TS Smart
  "Hot Water": "water",
};

/** Detect Melitta device prefix from entity list */
export function detectPrefix(entities: HassEntities): string | null {
  for (const id of Object.keys(entities)) {
    const m = id.match(/^button\.(.+?)_brew$/);
    if (m && entities[`sensor.${m[1]}_state`]) return m[1];
  }
  return null;
}

/** Helper to get entity by prefix + suffix */
export function getEntity(
  entities: HassEntities,
  prefix: string,
  domain: string,
  suffix: string,
): HassEntity | undefined {
  return entities[`${domain}.${prefix}_${suffix}`];
}

export function getState(
  entities: HassEntities,
  prefix: string,
  domain: string,
  suffix: string,
): string | null {
  const e = getEntity(entities, prefix, domain, suffix);
  if (!e) return null;
  const s = e.state;
  return s && s !== "unknown" && s !== "unavailable" ? s : null;
}

/** Get per-recipe cup counts from total_cups sensor attributes. */
export function getCupCounts(
  entities: HassEntities,
  prefix: string,
): Record<string, number> {
  const entity = getEntity(entities, prefix, "sensor", "total_cups");
  if (!entity?.attributes) return {};
  const counts: Record<string, number> = {};
  for (const [name, val] of Object.entries(entity.attributes)) {
    if (typeof val === "number" && !["friendly_name", "unit_of_measurement", "state_class", "icon"].includes(name)) {
      counts[name] = val;
    }
  }
  return counts;
}

export function getOptions(
  entities: HassEntities,
  prefix: string,
  suffix: string,
): string[] {
  const e = getEntity(entities, prefix, "select", suffix);
  return (e?.attributes?.options as string[]) || [];
}
