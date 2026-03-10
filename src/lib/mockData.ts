/**
 * Mock HA entities for demo mode (?demo in URL).
 * Allows previewing the UI without a real Home Assistant connection.
 */
import type { HassEntities } from "home-assistant-js-websocket";

const PREFIX = "melitta";

function entity(domain: string, suffix: string, state: string, attributes: Record<string, unknown> = {}) {
  const id = `${domain}.${PREFIX}_${suffix}`;
  return {
    entity_id: id,
    state,
    attributes: { friendly_name: suffix.replace(/_/g, " "), ...attributes },
    last_changed: new Date().toISOString(),
    last_updated: new Date().toISOString(),
    context: { id: "", user_id: null, parent_id: null },
  };
}

/** All 22 recipes matching CoffeeIcon RECIPE_IMAGES keys. */
const RECIPES = [
  "Espresso",
  "Ristretto",
  "Lungo",
  "Espresso Doppio",
  "Ristretto Doppio",
  "Café Crème",
  "Café Crème Doppio",
  "Americano",
  "Americano Extra",
  "Long Black",
  "Red Eye",
  "Black Eye",
  "Dead Eye",
  "Cappuccino",
  "Espresso Macchiato",
  "Caffè Latte",
  "Café au Lait",
  "Flat White",
  "Latte Macchiato",
  "Latte Macchiato Extra",
  "Latte Macchiato Triple",
  "Milk Froth",
  "Milk",
  "Hot Water",
];

function coffee(intensity: string, shots: number, ml: number, temp = "normal", aroma = "standard") {
  return { c1_process: "coffee", c1_intensity: intensity, c1_aroma: aroma, c1_temperature: temp, c1_shots: shots, c1_portion_ml: ml };
}

function milk(ml: number, temp = "high") {
  return { c2_process: "milk", c2_intensity: "medium", c2_aroma: "standard", c2_temperature: temp, c2_shots: 0, c2_portion_ml: ml };
}

function water(ml: number) {
  return { c2_process: "water", c2_intensity: "medium", c2_aroma: "standard", c2_temperature: "high", c2_shots: 0, c2_portion_ml: ml };
}

const NO_C2 = { c2_process: "none", c2_intensity: "medium", c2_aroma: "standard", c2_temperature: "normal", c2_shots: 0, c2_portion_ml: 0 };
const NO_C1 = { c1_process: "none", c1_intensity: "medium", c1_aroma: "standard", c1_temperature: "normal", c1_shots: 0, c1_portion_ml: 0 };

const RECIPE_DETAILS: Record<string, Record<string, unknown>> = {
  "Espresso":               { ...coffee("strong", 1, 40),        ...NO_C2 },
  "Ristretto":              { ...coffee("very_strong", 1, 25),   ...NO_C2 },
  "Lungo":                  { ...coffee("medium", 1, 120),       ...NO_C2 },
  "Espresso Doppio":        { ...coffee("strong", 2, 80),        ...NO_C2 },
  "Ristretto Doppio":       { ...coffee("very_strong", 2, 50),   ...NO_C2 },
  "Café Crème":             { ...coffee("medium", 1, 180),       ...NO_C2 },
  "Café Crème Doppio":      { ...coffee("medium", 2, 240),       ...NO_C2 },
  "Americano":              { ...coffee("strong", 1, 40),        ...water(140) },
  "Americano Extra":        { ...coffee("strong", 2, 80),        ...water(140) },
  "Long Black":             { ...coffee("strong", 2, 60),        ...water(160) },
  "Red Eye":                { ...coffee("strong", 1, 40),        c2_process: "coffee", c2_intensity: "medium", c2_aroma: "standard", c2_temperature: "normal", c2_shots: 1, c2_portion_ml: 180 },
  "Black Eye":              { ...coffee("strong", 2, 80),        c2_process: "coffee", c2_intensity: "medium", c2_aroma: "standard", c2_temperature: "normal", c2_shots: 1, c2_portion_ml: 180 },
  "Dead Eye":               { ...coffee("very_strong", 3, 120),  c2_process: "coffee", c2_intensity: "medium", c2_aroma: "standard", c2_temperature: "normal", c2_shots: 1, c2_portion_ml: 180 },
  "Cappuccino":             { ...coffee("strong", 1, 40),        ...milk(120) },
  "Espresso Macchiato":     { ...coffee("strong", 1, 40),        ...milk(30) },
  "Caffè Latte":            { ...coffee("medium", 1, 40),        ...milk(160) },
  "Café au Lait":           { ...coffee("mild", 1, 100),         ...milk(100) },
  "Flat White":             { ...coffee("strong", 2, 60),        ...milk(100) },
  "Latte Macchiato":        { c1_process: "milk", c1_intensity: "medium", c1_aroma: "standard", c1_temperature: "high", c1_shots: 0, c1_portion_ml: 180, c2_process: "coffee", c2_intensity: "strong", c2_aroma: "standard", c2_temperature: "normal", c2_shots: 1, c2_portion_ml: 40 },
  "Latte Macchiato Extra":  { c1_process: "milk", c1_intensity: "medium", c1_aroma: "standard", c1_temperature: "high", c1_shots: 0, c1_portion_ml: 180, c2_process: "coffee", c2_intensity: "strong", c2_aroma: "standard", c2_temperature: "normal", c2_shots: 2, c2_portion_ml: 80 },
  "Latte Macchiato Triple": { c1_process: "milk", c1_intensity: "medium", c1_aroma: "standard", c1_temperature: "high", c1_shots: 0, c1_portion_ml: 200, c2_process: "coffee", c2_intensity: "very_strong", c2_aroma: "standard", c2_temperature: "normal", c2_shots: 3, c2_portion_ml: 120 },
  "Milk Froth":             { c1_process: "milk", c1_intensity: "medium", c1_aroma: "standard", c1_temperature: "high", c1_shots: 0, c1_portion_ml: 120, ...NO_C2 },
  "Milk":                   { c1_process: "milk", c1_intensity: "medium", c1_aroma: "standard", c1_temperature: "high", c1_shots: 0, c1_portion_ml: 200, ...NO_C2 },
  "Hot Water":              { ...NO_C1, c2_process: "water", c2_intensity: "medium", c2_aroma: "standard", c2_temperature: "high", c2_shots: 0, c2_portion_ml: 250 },
};

const CUP_COUNTS: Record<string, number> = {
  "Cappuccino": 127,
  "Latte Macchiato": 89,
  "Espresso": 76,
  "Café Crème": 54,
  "Flat White": 41,
  "Caffè Latte": 33,
  "Americano": 28,
  "Lungo": 22,
  "Espresso Doppio": 15,
  "Ristretto": 12,
  "Espresso Macchiato": 8,
  "Café au Lait": 5,
  "Latte Macchiato Extra": 4,
  "Long Black": 3,
  "Café Crème Doppio": 3,
  "Ristretto Doppio": 2,
  "Americano Extra": 2,
  "Latte Macchiato Triple": 1,
  "Red Eye": 1,
  "Black Eye": 0,
  "Dead Eye": 0,
  "Milk Froth": 18,
  "Milk": 7,
  "Hot Water": 45,
};

/** DirectKey recipes per profile, keyed by display name (matched via DIRECTKEY_DISPLAY_TO_KEY). */
const DK_RECIPES: Record<number, Record<string, unknown>> = {
  1: {
    "Espresso":       { category: 1, ...RECIPE_DETAILS["Espresso"] },
    "Café Crème":     { category: 2, ...RECIPE_DETAILS["Café Crème"] },
    "Cappuccino":     { category: 3, ...RECIPE_DETAILS["Cappuccino"] },
    "Latte Macchiato":{ category: 4, ...RECIPE_DETAILS["Latte Macchiato"] },
    "Milk Froth":     { category: 5, ...RECIPE_DETAILS["Milk Froth"] },
    "Hot Water":      { category: 7, ...RECIPE_DETAILS["Hot Water"] },
  },
};

export function createMockEntities(): HassEntities {
  const entities: HassEntities = {};

  const add = (e: ReturnType<typeof entity>) => { entities[e.entity_id] = e; };

  // Machine state
  add(entity("sensor", "state", "Ready"));
  add(entity("sensor", "action_required", "None"));
  add(entity("sensor", "activity", ""));
  add(entity("sensor", "progress", "0"));
  add(entity("sensor", "firmware", "2.3.1"));

  // Brew / cancel buttons
  add(entity("button", "brew", "unknown"));
  add(entity("button", "cancel", "unknown"));

  // Recipe select with details nested under "recipes" key (matches useRecipeCache)
  add(entity("select", "recipe", "Cappuccino", {
    options: RECIPES,
    recipes: RECIPE_DETAILS,
  }));

  // Profile select with DirectKey data (matches useRecipeCache expectations)
  add(entity("select", "profile", "User 1", {
    options: ["Default", "User 1", "User 2", "User 3"],
    active_profile: 1,
    directkey_recipes: DK_RECIPES,
  }));

  // Cup counters
  const totalCups = Object.values(CUP_COUNTS).reduce((a, b) => a + b, 0);
  add(entity("sensor", "total_cups", String(totalCups), CUP_COUNTS));

  // Power switch
  add(entity("switch", "power", "on"));

  return entities;
}

export const MOCK_PREFIX = PREFIX;
