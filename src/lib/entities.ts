import type {
  Connection,
  HassEntities,
  HassEntity,
} from "home-assistant-js-websocket";
import { readDirectKey, type IconSpec, type UiContract } from "./contract";
import { tServer, type Locale } from "./i18n";

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
  /** Served IconSpec from a `recipes/list` row (§9.3.4); absent on the legacy attribute path. */
  icon?: IconSpec | null;
}

/** All DirectKey data from profile select entity attributes. */
export interface DirectKeyData {
  activeProfile: number;
  /** profile_id → category_name → recipe */
  profiles: Record<number, Record<string, DirectKeyRecipe>>;
}

/** A DirectKey category token (§9.3.2); open string — unknown tokens are tolerated. */
export type DirectKeyCategory = string;

/**
 * Pre-contract fallback truth for the DirectKey categories (§9.3.1): the
 * legacy app assumes a Barista TS front panel (`machineButton: false` for
 * `milk` — the fact that used to live in source comments is data now).
 * Icons are the §9.3.2 normative mdi table. Frozen — category identity
 * evolution happens only in the served contract block (§5.2 rule 8).
 */
export const LEGACY_DIRECTKEY_ENTRIES: readonly {
  category: string;
  id: number;
  machineButton: boolean;
  icon: string;
}[] = [
  { category: "espresso", id: 0, machineButton: true, icon: "mdi:coffee" },
  { category: "cafe_creme", id: 1, machineButton: true, icon: "mdi:coffee-outline" },
  { category: "cappuccino", id: 2, machineButton: true, icon: "mdi:coffee" },
  { category: "latte_macchiato", id: 3, machineButton: true, icon: "mdi:glass-mug-variant" },
  { category: "milk_froth", id: 4, machineButton: true, icon: "mdi:cup" },
  { category: "milk", id: 5, machineButton: false, icon: "mdi:cup-outline" },
  { category: "water", id: 6, machineButton: true, icon: "mdi:cup-water" },
];

/**
 * Legacy machine-button category tokens (pre-contract fallback tier only —
 * the render path goes through resolveDirectKeyModel).
 */
export const DIRECTKEY_CATEGORIES: readonly string[] =
  LEGACY_DIRECTKEY_ENTRIES.filter((e) => e.machineButton).map((e) => e.category);

/**
 * Map frozen English display names (the `directkey_recipes` attribute keys,
 * §5.2 rule 8) to category tokens. Fallback parsing only — servers since
 * 0.93 serve the token directly on `recipes/list` rows (§9.3.4).
 */
export const DIRECTKEY_DISPLAY_TO_KEY: Record<string, DirectKeyCategory> = {
  "Espresso": "espresso",
  "Café Crème": "cafe_creme",
  "Cappuccino": "cappuccino",
  "Latte Macchiato": "latte_macchiato",
  "Milk Froth": "milk_froth",
  "Milk": "milk",
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

// ---------------------------------------------------------------------------
// DirectKey/profile model (UI Contract §9.3) — contract block → legacy tables
// ---------------------------------------------------------------------------

/** One resolved DirectKey category (camelCase twin of §9.3.2's wire entry). */
export interface DirectKeyCategoryModel {
  category: string;
  /** Wire category id 0..6; -1 when the served entry omitted it. */
  id: number;
  /** §9.3.1: false = no dedicated front-panel key. Hidden, never disabled. */
  machineButton: boolean;
  /** Validated `mdi:` icon name; absent/malformed → the §9.3.2 `mdi:cup` default. */
  icon: string;
}

/** One resolved profile slot (§9.3.2) — stable slot identity, entity bindings. */
export interface DirectKeyProfileSlotModel {
  slot: number;
  /** Slot 0: always active, non-renameable, recipes not editable/resettable. */
  fixed: boolean;
  /** Slot 0 only: localized via the reused `recipes.category.<name_key>` string. */
  nameKey: string | null;
  nameEntitySuffix: string | null;
  activeEntitySuffix: string | null;
}

/** The resolved DirectKey/profile model BrewSection renders from. */
export interface DirectKeyModel {
  source: "contract" | "legacy";
  categories: DirectKeyCategoryModel[];
  profiles: DirectKeyProfileSlotModel[];
  profileSelectSuffix: string;
  activeProfileAttribute: string;
}

/** §9.3.2 default for an absent/malformed category icon. */
export const DEFAULT_DIRECTKEY_ICON = "mdi:cup";

const MDI_RE = /^mdi:[a-z0-9][a-z0-9-]*$/;

function mdiOrDefault(icon: unknown): string {
  return typeof icon === "string" && MDI_RE.test(icon)
    ? icon
    : DEFAULT_DIRECTKEY_ICON;
}

/**
 * The pre-contract fallback model (§9.3.6 rule 1): legacy category table +
 * `profile_<n>_name` / `profile_<n>_active` string templates — the only
 * place the templates still live. `profileCount` mirrors the profile
 * select's option count (slot == option index, the legacy assumption).
 */
export function legacyDirectKeyModel(profileCount: number): DirectKeyModel {
  const profiles: DirectKeyProfileSlotModel[] = [];
  for (let slot = 0; slot < Math.max(profileCount, 1); slot++) {
    profiles.push(
      slot === 0
        ? {
            slot: 0,
            fixed: true,
            nameKey: "my_coffee",
            nameEntitySuffix: null,
            activeEntitySuffix: null,
          }
        : {
            slot,
            fixed: false,
            nameKey: null,
            nameEntitySuffix: `profile_${slot}_name`,
            activeEntitySuffix: `profile_${slot}_active`,
          },
    );
  }
  return {
    source: "legacy",
    categories: LEGACY_DIRECTKEY_ENTRIES.map((e) => ({ ...e })),
    profiles,
    profileSelectSuffix: "profile",
    activeProfileAttribute: "active_profile",
  };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Resolve the DirectKey/profile model per §9.3.6 rule 1: the served
 * `contract.directkey` block when present and well-formed, else the legacy
 * fallback model. Malformed category/profile entries are dropped
 * individually (§6.0.3); a block left with no usable categories or no
 * usable profiles degrades whole to the legacy tier.
 */
export function resolveDirectKeyModel(
  contract: UiContract | null,
  profileCount: number,
): DirectKeyModel {
  const block = readDirectKey(contract);
  if (!block) return legacyDirectKeyModel(profileCount);

  const categories: DirectKeyCategoryModel[] = [];
  for (const c of block.categories) {
    if (!isRecord(c) || typeof c.category !== "string" || c.category === "") {
      continue;
    }
    categories.push({
      category: c.category,
      id: typeof c.id === "number" && Number.isInteger(c.id) ? c.id : -1,
      machineButton: c.machine_button !== false,
      icon: mdiOrDefault(c.icon),
    });
  }

  const profiles: DirectKeyProfileSlotModel[] = [];
  for (const p of block.profiles) {
    if (!isRecord(p) || typeof p.slot !== "number" || !Number.isInteger(p.slot) || p.slot < 0) {
      continue;
    }
    profiles.push({
      slot: p.slot,
      fixed: p.fixed === true,
      nameKey: typeof p.name_key === "string" ? p.name_key : null,
      nameEntitySuffix:
        typeof p.name_entity_suffix === "string" ? p.name_entity_suffix : null,
      activeEntitySuffix:
        typeof p.active_entity_suffix === "string"
          ? p.active_entity_suffix
          : null,
    });
  }

  if (categories.length === 0 || profiles.length === 0) {
    return legacyDirectKeyModel(profileCount);
  }
  return {
    source: "contract",
    categories,
    profiles,
    profileSelectSuffix:
      typeof block.profile_select_entity_suffix === "string" &&
      block.profile_select_entity_suffix !== ""
        ? block.profile_select_entity_suffix
        : "profile",
    activeProfileAttribute:
      typeof block.active_profile_attribute === "string" &&
      block.active_profile_attribute !== ""
        ? block.active_profile_attribute
        : "active_profile",
  };
}

/**
 * Category label per §9.3.6 rule 2: server `values.directkey_category.<token>`
 * → legacy bundle `brew.dk_<token>` → humanized token.
 */
export function directKeyCategoryLabel(
  locale: Locale,
  category: string,
): string {
  return tServer(
    locale,
    `values.directkey_category.${category}`,
    `brew.dk_${category}`,
  );
}

/**
 * Profile slots eligible for the tab bar (§9.3.2 semantics + §9.3.6 rule 6):
 * a slot needs a profile-select option at its index (the selection value);
 * slot 0 / `fixed` slots are always visible; other slots are visible iff
 * their bound activity switch entity exists and is `on` — a missing binding
 * or a missing state object hides the slot (entity absence gates rendering).
 */
export function visibleProfileSlots(
  model: DirectKeyModel,
  profileOptions: string[],
  entities: HassEntities,
  prefix: string,
): DirectKeyProfileSlotModel[] {
  return model.profiles.filter((p) => {
    if (profileOptions[p.slot] === undefined) return false;
    if (p.slot === 0 || p.fixed) return true;
    if (p.activeEntitySuffix === null) return false;
    const sw = getEntity(entities, prefix, "switch", p.activeEntitySuffix);
    return sw?.state === "on";
  });
}

/**
 * Whether a slot's name may be edited: never for `fixed`/slot 0 (§9.3.2), and
 * in contract mode only when the bound text entity has a state object
 * (§9.3.6 rule 6 — rendered read-only otherwise). The legacy tier keeps the
 * current behavior (any slot > 0 editable; a missing entity fails silently).
 */
export function canRenameProfileSlot(
  model: DirectKeyModel,
  slot: DirectKeyProfileSlotModel,
  entities: HassEntities,
  prefix: string,
): boolean {
  if (slot.fixed || slot.slot === 0 || slot.nameEntitySuffix === null) {
    return false;
  }
  if (model.source === "legacy") return true;
  return getEntity(entities, prefix, "text", slot.nameEntitySuffix) !== undefined;
}

/**
 * Active profile id from the profile select's served attribute name
 * (§9.3.6 rule 4); null when the select entity or attribute is absent —
 * the caller then falls back to the cached legacy value.
 */
export function activeProfileFromEntities(
  model: DirectKeyModel,
  entities: HassEntities,
  prefix: string,
): number | null {
  const e = getEntity(entities, prefix, "select", model.profileSelectSuffix);
  const v = e?.attributes?.[model.activeProfileAttribute];
  return typeof v === "number" && Number.isInteger(v) ? v : null;
}

// ---------------------------------------------------------------------------
// DirectKey recipe data — WS recipes/list join (§9.3.4/§9.3.6 rule 5)
// ---------------------------------------------------------------------------

function componentFields(
  comp: Record<string, unknown>,
  prefix: "c1" | "c2",
): Record<string, unknown> {
  return {
    [`${prefix}_process`]:
      typeof comp.process === "string" ? comp.process : "none",
    [`${prefix}_intensity`]:
      typeof comp.intensity === "string" ? comp.intensity : "",
    [`${prefix}_aroma`]: typeof comp.aroma === "string" ? comp.aroma : "",
    [`${prefix}_temperature`]:
      typeof comp.temperature === "string" ? comp.temperature : "",
    // Shots pass through verbatim: the legacy attribute surface serves token
    // strings here too, and RecipeInfo's numeric checks treat them the same.
    [`${prefix}_shots`]:
      typeof comp.shots === "number" || typeof comp.shots === "string"
        ? comp.shots
        : 0,
    [`${prefix}_portion_ml`]:
      typeof comp.portion_ml === "number" ? comp.portion_ml : 0,
  };
}

/**
 * Join WS `recipes/list` directkey rows into the app's per-profile recipe
 * map, keyed by `category` token (§9.3.6 rule 5 — no id math, no
 * display-name reverse maps). Unknown tokens are kept (tolerated; they
 * render only if the model serves that category). Returns null for a
 * malformed payload or a pre-0.93 one whose rows carry no tokens — the
 * caller then falls back to the legacy attribute parsing.
 */
export function directKeyProfilesFromList(
  payload: unknown,
  categoryIds: Record<string, number>,
): Record<number, Record<string, DirectKeyRecipe>> | null {
  if (!isRecord(payload) || !Array.isArray(payload.directkey)) return null;
  const out: Record<number, Record<string, DirectKeyRecipe>> = {};
  let sawRow = false;
  let sawToken = false;
  for (const profile of payload.directkey) {
    if (
      !isRecord(profile) ||
      typeof profile.profile_id !== "number" ||
      !Array.isArray(profile.recipes)
    ) {
      continue;
    }
    const recipes: Record<string, DirectKeyRecipe> = {};
    for (const row of profile.recipes) {
      if (!isRecord(row)) continue;
      sawRow = true;
      const token = typeof row.category === "string" ? row.category : "";
      if (token === "") continue; // pre-0.93 row or out-of-enum byte (§9.3.4)
      sawToken = true;
      const comps = Array.isArray(row.components) ? row.components : [];
      const c1 = comps[0];
      if (!isRecord(c1)) continue; // empty slot — no recipe, tile hidden
      const c2 = comps[1];
      recipes[token] = {
        category: categoryIds[token] ?? -1,
        ...componentFields(c1, "c1"),
        ...componentFields(isRecord(c2) ? c2 : {}, "c2"),
        icon: isRecord(row.icon) ? (row.icon as unknown as IconSpec) : null,
      } as DirectKeyRecipe;
    }
    out[profile.profile_id] = recipes;
  }
  if (sawRow && !sawToken) return null;
  return out;
}

/**
 * Fetch WS `melitta_barista/recipes/list` for one entry. Never throws —
 * null on any failure, which degrades the caller to the legacy
 * `directkey_recipes` attribute path (per-feature degradation).
 */
export async function fetchDirectKeyRecipeList(
  conn: Connection,
  entryId: string,
): Promise<unknown | null> {
  try {
    return await conn.sendMessagePromise({
      type: "melitta_barista/recipes/list",
      entry_id: entryId,
    });
  } catch {
    return null;
  }
}
