/**
 * Spec-verbatim contract fixtures.
 *
 * MELITTA_CONTRACT / NIVONA_CONTRACT are the §3.7 / §3.8 example payloads;
 * the parameter blocks are §6.1.4, the settings blocks §9.1.5 (the entries
 * pinned verbatim in the spec), the directkey block §9.3.3. Do not edit
 * except to track a spec amendment.
 */
import type { UiContract } from "../../src/lib/contract";

/** §3.7 — Melitta Barista TS Smart (v1 document, verbatim). */
export const MELITTA_CONTRACT: UiContract = {
  schema_version: 1,
  contract_version: 1,
  contract_fingerprint: "9f3ac1d24b07",
  entry_id: "a1b2c3d4e5f6",
  generated_at: "2026-09-02T10:15:00Z",
  source: "live",
  machine: {
    brand: "melitta",
    brand_name: "Melitta",
    model_name: "Barista TS Smart",
    family_key: "barista_ts",
    machine_type: "BARISTA_TS",
    connected: true,
  },
  brand_theme: {
    brand: "melitta",
    wordmark: "MELITTA",
    accent: "#c8102e",
    accent_soft: "#f6e3e6",
    logo_url: null,
  },
  capabilities: {
    supports_recipe_writes: true,
    supports_stats: true,
    supports_factory_reset: false,
    supports_brew_overrides: false,
    supports_freestyle: true,
    my_coffee_slots: 8,
    strength_levels: 5,
    has_aroma_balance: true,
    hopper_count: 2,
    has_milk_system: true,
    tolerated_brew_manipulations: [],
  },
  vocabularies: {
    status: {
      process: [
        "READY", "PRODUCT", "CLEANING", "DESCALING", "FILTER_INSERT",
        "FILTER_REPLACE", "FILTER_REMOVE", "SWITCH_OFF", "EASY_CLEAN",
        "INTENSIVE_CLEAN", "EVAPORATING", "BUSY",
      ],
      sub_process: ["GRINDING", "COFFEE", "STEAM", "WATER", "PREPARE"],
      manipulation: [
        "NONE", "BU_REMOVED", "TRAYS_MISSING", "EMPTY_TRAYS",
        "FILL_WATER", "CLOSE_POWDER_LID", "FILL_POWDER",
        "MOVE_CUP_TO_FROTHER", "FLUSH_REQUIRED",
      ],
      info_message: [
        "FILL_BEANS_1", "FILL_BEANS_2", "EASY_CLEAN",
        "POWDER_FILLED", "PREPARATION_CANCELLED",
      ],
    },
    freestyle: {
      process: ["none", "coffee", "milk", "water"],
      intensity: ["very_mild", "mild", "medium", "strong", "very_strong"],
      aroma: ["standard", "intense"],
      temperature: ["cold", "normal", "high"],
      shots: ["none", "one", "two", "three"],
      blend: ["hopper_1", "hopper_2"],
    },
  },
  limits: {
    portion_ml: {
      c1: { min: 5, max: 250, step: 5 },
      c2: { min: 0, max: 250, step: 5 },
    },
  },
  recipes: [
    {
      recipe_id: 200,
      name: "Espresso",
      category: "espresso",
      components: {
        c1: {
          process: "coffee", intensity: "strong", aroma: "standard",
          temperature: "normal", shots: "one", portion_ml: 40,
          blend: "hopper_1",
        },
        c2: null,
      },
      icon: {
        spec_version: 1,
        glass: "espresso_cup",
        total_ml: 40,
        fill_level: 0.67,
        layers: [
          { role: "coffee", ml: 40, fraction: 1.0, intensity: 0.68, crema: true },
        ],
        foam: null,
        steam: true,
      },
    },
    {
      recipe_id: 214,
      name: "Latte Macchiato",
      category: "milk_drink",
      components: {
        c1: {
          process: "milk", intensity: "medium", aroma: "standard",
          temperature: "normal", shots: "none", portion_ml: 160,
          blend: "hopper_1",
        },
        c2: {
          process: "coffee", intensity: "strong", aroma: "standard",
          temperature: "normal", shots: "one", portion_ml: 40,
          blend: "hopper_1",
        },
      },
      icon: {
        spec_version: 1,
        glass: "tall_glass",
        total_ml: 200,
        fill_level: 0.63,
        layers: [
          { role: "milk", ml: 130, fraction: 0.65, intensity: 0.0 },
          { role: "coffee", ml: 40, fraction: 0.2, intensity: 0.68 },
        ],
        foam: { role: "milk_foam", ml: 30, fraction: 0.15 },
        steam: true,
      },
    },
  ],
  status_attribute_entity: "state",
  bridge_attribute_entity: "connection",
};

/** §3.8 — Nivona 700 family, NICR 769 (v1 document, verbatim). */
export const NIVONA_CONTRACT: UiContract = {
  schema_version: 1,
  contract_version: 1,
  contract_fingerprint: "41c09be77a20",
  entry_id: "f6e5d4c3b2a1",
  generated_at: "2026-09-02T10:15:00Z",
  source: "live",
  machine: {
    brand: "nivona",
    brand_name: "Nivona",
    model_name: "NICR 769",
    family_key: "700",
    machine_type: null,
    connected: true,
  },
  brand_theme: {
    brand: "nivona",
    wordmark: "NIVONA",
    accent: "#00646b",
    accent_soft: "#e0eeef",
    logo_url: "/local/melitta_barista/nivona.png",
  },
  capabilities: {
    supports_recipe_writes: false,
    supports_stats: true,
    supports_factory_reset: true,
    supports_brew_overrides: true,
    supports_freestyle: false,
    my_coffee_slots: 4,
    strength_levels: 3,
    has_aroma_balance: true,
    hopper_count: 1,
    has_milk_system: true,
    tolerated_brew_manipulations: [],
  },
  vocabularies: {
    status: {
      process: [
        "READY", "PRODUCT", "CLEANING", "DESCALING", "FILTER_INSERT",
        "FILTER_REPLACE", "FILTER_REMOVE", "SWITCH_OFF", "EASY_CLEAN",
        "INTENSIVE_CLEAN", "EVAPORATING", "BUSY",
      ],
      sub_process: ["GRINDING", "COFFEE", "STEAM", "WATER", "PREPARE"],
      manipulation: [
        "NONE", "BU_REMOVED", "TRAYS_MISSING", "EMPTY_TRAYS",
        "FILL_WATER", "CLOSE_POWDER_LID", "FILL_POWDER",
        "MOVE_CUP_TO_FROTHER", "FLUSH_REQUIRED",
      ],
      info_message: [
        "FILL_BEANS_1", "FILL_BEANS_2", "EASY_CLEAN",
        "POWDER_FILLED", "PREPARATION_CANCELLED",
      ],
    },
    freestyle: {
      process: ["none", "coffee", "milk", "water"],
      intensity: ["mild", "medium", "strong"],
      aroma: ["standard", "intense"],
      temperature: ["cold", "normal", "high"],
      shots: ["none", "one", "two", "three"],
      blend: ["hopper_1"],
    },
  },
  limits: {
    portion_ml: {
      c1: { min: 5, max: 250, step: 5 },
      c2: { min: 0, max: 250, step: 5 },
    },
  },
  recipes: [
    {
      recipe_id: 1,
      name: "Espresso",
      category: "espresso",
      icon: {
        spec_version: 1,
        glass: "espresso_cup",
        total_ml: 40,
        fill_level: 0.67,
        layers: [
          { role: "coffee", ml: 40, fraction: 1.0, intensity: 0.68, crema: true },
        ],
        foam: null,
        steam: true,
      },
    },
    {
      recipe_id: 4,
      name: "Cappuccino",
      category: "milk_drink",
      icon: {
        spec_version: 1,
        glass: "cup",
        total_ml: 180,
        fill_level: 0.82,
        layers: [
          { role: "coffee", ml: 40, fraction: 0.22, intensity: 0.68 },
          { role: "milk", ml: 110, fraction: 0.61, intensity: 0.0 },
        ],
        foam: { role: "milk_foam", ml: 30, fraction: 0.17 },
        steam: true,
      },
    },
  ],
  status_attribute_entity: "state",
  bridge_attribute_entity: "connection",
};

/** §6.1.4 — Melitta Barista TS `parameters` block (verbatim). */
export const MELITTA_PARAMETERS = {
  process: {
    kind: "enum", scope: ["freestyle"],
    tokens: ["none", "coffee", "milk", "water"],
  },
  intensity: {
    kind: "enum", scope: ["freestyle"], applies_to: ["coffee"],
    tokens: ["very_mild", "mild", "medium", "strong", "very_strong"],
  },
  aroma: {
    kind: "enum", scope: ["freestyle"], applies_to: ["coffee"],
    tokens: ["standard", "intense"],
  },
  temperature: {
    kind: "enum", scope: ["freestyle"],
    tokens: ["cold", "normal", "high"],
  },
  shots: {
    kind: "enum", scope: ["freestyle"], applies_to: ["coffee"],
    tokens: ["none", "one", "two", "three"],
  },
  blend: {
    kind: "enum", scope: ["freestyle"], applies_to: ["coffee"],
    tokens: ["hopper_1", "hopper_2"],
  },
  portion_ml: {
    kind: "range", scope: ["freestyle"], unit: "ml",
    per_component: true as const,
    c1: { min: 5, max: 250, step: 5 },
    c2: { min: 0, max: 250, step: 5 },
  },
};

/** §6.1.4 — Nivona 700 `parameters` block (verbatim). */
export const NIVONA_PARAMETERS = {
  intensity: {
    kind: "enum", scope: ["brew_override"], applies_to: ["coffee"],
    tokens: ["mild", "medium", "strong"],
  },
  aroma: {
    kind: "enum", scope: ["brew_override"], applies_to: ["coffee"],
    tokens: ["standard", "intense"],
  },
  portion_ml: {
    kind: "range", scope: ["brew_override"], unit: "ml",
    per_component: true as const,
    c1: { min: 5, max: 250, step: 5 },
    c2: { min: 0, max: 250, step: 5 },
  },
};

/** §9.1.5 — Melitta settings entries pinned verbatim in the spec. */
export const MELITTA_SETTINGS = [
  {
    setting: "auto_bean_select", control: "switch", group: "brew",
    icon: "mdi:grain",
    entity: { domain: "switch", entity_suffix: "auto_bean_select" },
    writable: true,
  },
  {
    setting: "brew_temperature", control: "number", group: "brew",
    icon: "mdi:thermometer",
    entity: { domain: "number", entity_suffix: "brew_temperature" },
    writable: true, min: 0, max: 2, step: 1, display: "slider",
    levels: [
      { value: 0, token: "low" },
      { value: 1, token: "normal" },
      { value: 2, token: "high" },
    ],
  },
  {
    setting: "water_hardness", control: "number", group: "water",
    icon: "mdi:water-opacity",
    entity: { domain: "number", entity_suffix: "water_hardness" },
    writable: true, min: 1, max: 4, step: 1, display: "slider",
    levels: [
      { value: 1, token: "soft" },
      { value: 2, token: "medium" },
      { value: 3, token: "hard" },
      { value: 4, token: "very_hard" },
    ],
  },
  {
    setting: "auto_off_after", control: "number", group: "power",
    icon: "mdi:timer-off-outline",
    entity: { domain: "number", entity_suffix: "auto_off_after" },
    writable: true, min: 15, max: 240, step: 15,
    unit: "min", display: "box",
  },
];

/** §9.1.5 — Nivona 700 (NICR 769) settings entries (verbatim). */
export const NIVONA_SETTINGS = [
  {
    setting: "temperature", control: "select", group: "brew",
    icon: "mdi:tune",
    entity: { domain: "select", entity_suffix: "temperature" },
    writable: true,
    options: [
      { value: 0, token: null, label: "normal" },
      { value: 1, token: null, label: "high" },
      { value: 2, token: null, label: "max" },
      { value: 3, token: null, label: "individual" },
    ],
  },
  {
    setting: "profile", control: "select", group: "brew",
    icon: "mdi:tune",
    entity: { domain: "select", entity_suffix: "profile" },
    writable: true,
    options: [
      { value: 0, token: null, label: "dynamic" },
      { value: 1, token: null, label: "constant" },
      { value: 2, token: null, label: "intense" },
      { value: 3, token: null, label: "individual" },
    ],
  },
  {
    setting: "water_hardness", control: "select", group: "water",
    icon: "mdi:tune",
    entity: { domain: "select", entity_suffix: "water_hardness" },
    writable: true,
    options: [
      { value: 0, token: "soft", label: "soft" },
      { value: 1, token: "medium", label: "medium" },
      { value: 2, token: "hard", label: "hard" },
      { value: 3, token: "very_hard", label: "very hard" },
    ],
  },
  {
    setting: "off_rinse", control: "select", group: "water",
    icon: "mdi:tune",
    entity: { domain: "select", entity_suffix: "off_rinse" },
    writable: true,
    options: [
      { value: 0, token: "off", label: "off" },
      { value: 1, token: "on", label: "on" },
    ],
  },
  {
    setting: "auto_off", control: "select", group: "power",
    icon: "mdi:tune",
    entity: { domain: "select", entity_suffix: "auto_off" },
    writable: true,
    options: [
      { value: 0, token: null, label: "10 min" },
      { value: 9, token: null, label: "off" },
    ],
  },
];

/** §9.3.3 — Melitta Barista TS `directkey` block (verbatim). */
export const MELITTA_DIRECTKEY = {
  categories: [
    { category: "espresso", id: 0, machine_button: true, icon: "mdi:coffee" },
    { category: "cafe_creme", id: 1, machine_button: true, icon: "mdi:coffee-outline" },
    { category: "cappuccino", id: 2, machine_button: true, icon: "mdi:coffee" },
    { category: "latte_macchiato", id: 3, machine_button: true, icon: "mdi:glass-mug-variant" },
    { category: "milk_froth", id: 4, machine_button: true, icon: "mdi:cup" },
    { category: "milk", id: 5, machine_button: false, icon: "mdi:cup-outline" },
    { category: "water", id: 6, machine_button: true, icon: "mdi:cup-water" },
  ],
  profiles: [
    { slot: 0, fixed: true, name_key: "my_coffee" },
    { slot: 1, name_entity_suffix: "profile_1_name", active_entity_suffix: "profile_1_active" },
    { slot: 2, name_entity_suffix: "profile_2_name", active_entity_suffix: "profile_2_active" },
    { slot: 3, name_entity_suffix: "profile_3_name", active_entity_suffix: "profile_3_active" },
    { slot: 4, name_entity_suffix: "profile_4_name", active_entity_suffix: "profile_4_active" },
    { slot: 5, name_entity_suffix: "profile_5_name", active_entity_suffix: "profile_5_active" },
    { slot: 6, name_entity_suffix: "profile_6_name", active_entity_suffix: "profile_6_active" },
    { slot: 7, name_entity_suffix: "profile_7_name", active_entity_suffix: "profile_7_active" },
    { slot: 8, name_entity_suffix: "profile_8_name", active_entity_suffix: "profile_8_active" },
  ],
  profile_select_entity_suffix: "profile",
  active_profile_attribute: "active_profile",
};

/** §3.7 doc extended with the v2 (§6.1.4) and v3 (§9.1.5/§9.3.3) blocks. */
export const MELITTA_CONTRACT_FULL: UiContract = {
  ...MELITTA_CONTRACT,
  parameters: MELITTA_PARAMETERS,
  forbidden_combinations: [],
  strings_version: "0.93.0",
  settings: MELITTA_SETTINGS,
  directkey: MELITTA_DIRECTKEY,
};

/** §3.8 doc extended with the v2 (§6.1.4) and v3 (§9.1.5) blocks. */
export const NIVONA_CONTRACT_FULL: UiContract = {
  ...NIVONA_CONTRACT,
  parameters: NIVONA_PARAMETERS,
  forbidden_combinations: [],
  strings_version: "0.93.0",
  settings: NIVONA_SETTINGS,
};

const DIRECTKEY_TOKENS = [
  "espresso", "cafe_creme", "cappuccino", "latte_macchiato",
  "milk_froth", "milk", "water",
];

const PROCESS_TOKENS = ["none", "coffee", "milk", "water"];
const INTENSITY_TOKENS = ["very_mild", "mild", "medium", "strong", "very_strong"];
const AROMA_TOKENS = ["standard", "intense"];
const TEMPERATURE_TOKENS = ["cold", "normal", "high"];
const SHOTS_TOKENS = ["none", "one", "two", "three"];

/**
 * §6.2.2 sixteen-entry action catalog + the §9.3.5 seventeenth
 * (save_directkey), as served for the Melitta Barista TS fixture:
 * `factory_reset_*` are `available: false` (its `supports_factory_reset`
 * is false); every service entry anchors at `entity_suffix: "brew"`.
 */
export const MELITTA_ACTIONS = [
  {
    action: "brew", group: "brew", process: "PRODUCT", icon: "mdi:coffee",
    confirm: false, requires: ["ready"], available: true,
    invocation: { kind: "button", entity_suffix: "brew" },
  },
  {
    action: "brew_freestyle", group: "brew", process: "PRODUCT",
    icon: "mdi:coffee-maker", confirm: false, requires: ["ready"],
    available: true,
    invocation: {
      kind: "service", service: "brew_freestyle", entity_suffix: "brew",
      params: [
        { name: "params", kind: "params_ref", ref: "freestyle", required: true },
      ],
    },
  },
  {
    action: "brew_directkey", group: "brew", process: "PRODUCT",
    icon: "mdi:gesture-tap-button", confirm: false, requires: ["ready"],
    available: true,
    invocation: {
      kind: "service", service: "brew_directkey", entity_suffix: "brew",
      params: [
        { name: "category", kind: "enum", tokens: DIRECTKEY_TOKENS, required: true },
        { name: "two_cups", kind: "bool", default: false, required: false },
      ],
    },
  },
  {
    action: "cancel", group: "control", process: null, icon: "mdi:stop",
    confirm: false, requires: ["connected"], available: true,
    invocation: { kind: "button", entity_suffix: "cancel" },
  },
  {
    action: "confirm_prompt", group: "control", process: null,
    icon: "mdi:check-circle", confirm: false,
    requires: ["awaiting_confirmation"], available: true,
    invocation: { kind: "button", entity_suffix: "confirm_prompt" },
  },
  {
    action: "reset_recipe", group: "control", process: null,
    icon: "mdi:restore", confirm: true, requires: ["ready"], available: true,
    invocation: {
      kind: "service", service: "reset_recipe", entity_suffix: "brew",
      params: [
        {
          name: "recipe_id", kind: "int",
          ranges: [[200, 223], [302, 388]], required: false,
        },
      ],
    },
  },
  {
    action: "easy_clean", group: "cleaning", process: "EASY_CLEAN",
    icon: "mdi:shimmer", confirm: true, requires: ["ready"], available: true,
    invocation: { kind: "button", entity_suffix: "easy_clean" },
  },
  {
    action: "intensive_clean", group: "cleaning", process: "INTENSIVE_CLEAN",
    icon: "mdi:dishwasher", confirm: true, requires: ["ready"],
    available: true,
    invocation: { kind: "button", entity_suffix: "intensive_clean" },
  },
  {
    action: "descaling", group: "cleaning", process: "DESCALING",
    icon: "mdi:water-sync", confirm: true, requires: ["ready"],
    available: true,
    invocation: { kind: "button", entity_suffix: "descaling" },
  },
  {
    action: "filter_insert", group: "filter", process: "FILTER_INSERT",
    icon: "mdi:filter-plus", confirm: false, requires: ["ready"],
    available: true,
    invocation: { kind: "button", entity_suffix: "filter_insert" },
  },
  {
    action: "filter_replace", group: "filter", process: "FILTER_REPLACE",
    icon: "mdi:filter-cog", confirm: false, requires: ["ready"],
    available: true,
    invocation: { kind: "button", entity_suffix: "filter_replace" },
  },
  {
    action: "filter_remove", group: "filter", process: "FILTER_REMOVE",
    icon: "mdi:filter-remove", confirm: false, requires: ["ready"],
    available: true,
    invocation: { kind: "button", entity_suffix: "filter_remove" },
  },
  {
    action: "evaporating", group: "power", process: "EVAPORATING",
    icon: "mdi:air-humidifier", confirm: true, requires: ["ready"],
    available: true,
    invocation: { kind: "button", entity_suffix: "evaporating" },
  },
  {
    action: "switch_off", group: "power", process: "SWITCH_OFF",
    icon: "mdi:power", confirm: true, requires: ["connected"],
    available: true,
    invocation: { kind: "button", entity_suffix: "switch_off" },
  },
  {
    action: "factory_reset_settings", group: "danger", process: null,
    icon: "mdi:cog-refresh", confirm: true, destructive: true as const,
    requires: ["ready"], available: false,
    invocation: { kind: "button", entity_suffix: "factory_reset_settings" },
  },
  {
    action: "factory_reset_recipes", group: "danger", process: null,
    icon: "mdi:book-refresh", confirm: true, destructive: true as const,
    requires: ["ready"], available: false,
    invocation: { kind: "button", entity_suffix: "factory_reset_recipes" },
  },
  {
    action: "save_directkey", group: "control", process: null,
    icon: "mdi:content-save", confirm: true, requires: ["ready"],
    available: true,
    invocation: {
      kind: "service", service: "save_directkey", entity_suffix: "brew",
      params: [
        { name: "category", kind: "enum", tokens: DIRECTKEY_TOKENS, required: true },
        { name: "profile_id", kind: "int", ranges: [[0, 8]], required: false },
        { name: "process1", kind: "enum", tokens: PROCESS_TOKENS, required: true, default: "coffee" },
        { name: "intensity1", kind: "enum", tokens: INTENSITY_TOKENS, required: false, default: "medium" },
        { name: "aroma1", kind: "enum", tokens: AROMA_TOKENS, required: false, default: "standard" },
        { name: "portion1_ml", kind: "int", ranges: [[5, 250]], required: false, default: 40 },
        { name: "temperature1", kind: "enum", tokens: TEMPERATURE_TOKENS, required: false, default: "normal" },
        { name: "shots1", kind: "enum", tokens: SHOTS_TOKENS, required: false, default: "one" },
        { name: "process2", kind: "enum", tokens: PROCESS_TOKENS, required: false, default: "none" },
        { name: "intensity2", kind: "enum", tokens: INTENSITY_TOKENS, required: false, default: "medium" },
        { name: "aroma2", kind: "enum", tokens: AROMA_TOKENS, required: false, default: "standard" },
        { name: "portion2_ml", kind: "int", ranges: [[0, 250]], required: false, default: 0 },
        { name: "temperature2", kind: "enum", tokens: TEMPERATURE_TOKENS, required: false, default: "normal" },
        { name: "shots2", kind: "enum", tokens: SHOTS_TOKENS, required: false, default: "none" },
      ],
    },
  },
];

/**
 * Spec-verbatim §9.2.2 `vocab/get` vocabulary (the `vocab` field of the
 * response) — every served family with its metadata, in served order.
 */
export const MELITTA_VOCAB = {
  roast: { tokens: ["light", "medium", "medium_dark", "dark"] },
  bean_type: { tokens: ["arabica", "arabica_robusta", "robusta"] },
  origin: { tokens: ["single_origin", "blend"] },
  mood: { tokens: ["energizing", "relaxing", "dessert", "classic"], multi: true },
  occasion: { tokens: ["morning", "after_lunch", "guests", "romantic", "work"] },
  cup_size: {
    tokens: ["espresso_cup", "cup", "mug", "tall_glass", "travel"],
    volumes_ml: {
      espresso_cup: [60, 90],
      cup: [150, 200],
      mug: [250, 350],
      tall_glass: [300, 400],
      travel: [350, 500],
    },
  },
  temperature: { tokens: ["auto", "hot", "iced"] },
  caffeine: { tokens: ["regular", "low", "decaf_evening"] },
  dietary: { tokens: ["no_sugar", "lactose_free", "low_calorie", "vegan"], multi: true },
  mode: { tokens: ["surprise_me", "custom"] },
  extras_kind: { tokens: ["syrup", "topping", "liqueur"] },
};

/** Deep-clone a fixture so tests can mutate safely. */
export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
