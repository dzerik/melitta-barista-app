/**
 * UI Contract core (contract v1 + additive v2/v3 blocks).
 *
 * Implements the client half of the UI Contract spec:
 * - bridge-attribute reading from `sensor.<prefix>_connection` (always available),
 * - live status tokens from `sensor.<prefix>_state` (unavailable ⇒ offline),
 * - `melitta_barista/ui_contract/get` fetch with failure classification
 *   (durable vs transient) and a fingerprint-keyed session cache,
 * - per-entry_id last-good persistence with stale marking,
 * - per-feature presence-gating readers (every feature degrades independently).
 *
 * Wire shapes keep their snake_case field names verbatim; reader outputs use
 * the repo's camelCase convention.
 */
import type {
  Connection,
  HassEntities,
  HassEntity,
} from "home-assistant-js-websocket";

// ---------------------------------------------------------------------------
// Version gate
// ---------------------------------------------------------------------------

/** Contract versions this app can consume. All v2/v3 features are additive within v1. */
export const SUPPORTED_CONTRACT_VERSIONS: readonly number[] = [1];

/**
 * The two PWA mismatch screens (§5.4): server below our minimum → the
 * integration is too old; server above our maximum → this app is too old.
 */
export type MismatchDirection = "update_integration" | "update_app";

/**
 * Classify a served/bridged contract_version against the supported set.
 *
 * Returns `null` when supported. Absent or non-numeric versions (pre-contract
 * integrations) classify as "update_integration" per the §5.4 PWA rule.
 */
export function classifyVersionMismatch(
  version: unknown,
): MismatchDirection | null {
  if (typeof version !== "number" || !Number.isFinite(version)) {
    return "update_integration";
  }
  if (SUPPORTED_CONTRACT_VERSIONS.includes(version)) return null;
  const min = Math.min(...SUPPORTED_CONTRACT_VERSIONS);
  return version < min ? "update_integration" : "update_app";
}

// ---------------------------------------------------------------------------
// Wire types (snake_case, byte-faithful to the served JSON)
// ---------------------------------------------------------------------------

/** Icon layer inside an IconSpec (§3.6). Unknown roles render neutral (§5.3.2). */
export interface IconLayer {
  role: string;
  ml: number;
  fraction: number;
  intensity?: number;
  crema?: boolean;
  label?: string;
  color_hint?: string | null;
}

/** Procedurally derived drink icon description (§3.6). */
export interface IconSpec {
  spec_version: number;
  glass: string;
  total_ml: number;
  fill_level: number;
  layers: IconLayer[];
  foam: IconLayer | null;
  steam: boolean;
}

/** One freestyle component of a recipe (§3.3). */
export interface RecipeComponentData {
  process: string;
  intensity: string;
  aroma: string;
  temperature: string;
  shots: string;
  portion_ml: number;
  blend?: string;
}

/** One recipe row of the served catalog (§3.3). */
export interface ContractRecipe {
  recipe_id: number;
  name: string;
  category: string;
  icon: IconSpec | null;
  components?: {
    c1: RecipeComponentData | null;
    c2: RecipeComponentData | null;
  };
  name_key?: string;
}

/** Brand badge data (§3.10) — data only, never a logo asset requirement. */
export interface BrandTheme {
  brand: string;
  wordmark: string;
  accent: string;
  accent_soft: string;
  logo_url: string | null;
}

/** Capability block (§3.3/§3.5). */
export interface ContractCapabilities {
  supports_recipe_writes: boolean;
  supports_stats: boolean;
  supports_factory_reset: boolean;
  supports_brew_overrides: boolean;
  supports_freestyle: boolean;
  my_coffee_slots: number;
  strength_levels: number;
  has_aroma_balance: boolean;
  hopper_count: number;
  has_milk_system: boolean;
  tolerated_brew_manipulations: string[];
}

/** v2 parameter descriptor (§6.1.1). Token-typed fields are open strings. */
export interface ParameterDescriptor {
  kind: string;
  scope: string[];
  applies_to?: string[];
  tokens?: string[];
  unit?: string;
  per_component?: true;
  c1?: { min: number; max: number; step: number };
  c2?: { min: number; max: number; step: number };
  min?: number;
  max?: number;
  step?: number;
}

/** v2 forbidden parameter combination (§6.1.6). Advisory; server re-validates. */
export interface ForbiddenCombination {
  params: Record<string, string>;
  reason_token?: string;
}

/** v2 action-catalog entry (§6.2.1) — key is "action" (binding precedent). */
export interface ActionEntry {
  action: string;
  kind?: string;
  group?: string;
  [key: string]: unknown;
}

/** v3 settings descriptor entry (§9.1.1). */
export interface SettingDescriptor {
  setting: string;
  control: string;
  group: string;
  icon?: string;
  entity: { domain: string; entity_suffix: string };
  writable: boolean;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  display?: string;
  levels?: Array<{ value: number; token: string }>;
  options?: Array<{ value: number; token: string | null; label: string }>;
}

/** v3 DirectKey category row (§9.3.2). */
export interface DirectKeyCategoryEntry {
  category: string;
  id: number;
  machine_button: boolean;
  icon?: string;
}

/** v3 DirectKey profile slot (§9.3.2). */
export interface DirectKeyProfileEntry {
  slot: number;
  fixed?: boolean;
  name_key?: string;
  name_entity_suffix?: string;
  active_entity_suffix?: string;
}

/** v3 DirectKey/profile model block (§9.3.2). */
export interface DirectKeyBlock {
  categories: DirectKeyCategoryEntry[];
  profiles: DirectKeyProfileEntry[];
  profile_select_entity_suffix: string;
  active_profile_attribute: string;
}

/** The `ui_contract/get` document (§3.3 + additive v2/v3 blocks). */
export interface UiContract {
  schema_version: number;
  contract_version: number;
  contract_fingerprint: string;
  entry_id: string;
  generated_at: string;
  source: string;
  machine: {
    brand: string;
    brand_name: string;
    model_name: string | null;
    family_key: string | null;
    machine_type: string | null;
    connected: boolean;
  };
  brand_theme?: BrandTheme;
  capabilities: ContractCapabilities;
  vocabularies: {
    status: {
      process: string[];
      sub_process: string[];
      manipulation: string[];
      info_message: string[];
    };
    freestyle: {
      process: string[];
      intensity: string[];
      aroma: string[];
      temperature: string[];
      shots: string[];
      blend: string[];
    };
  };
  limits: {
    portion_ml: {
      c1: { min: number; max: number; step: number };
      c2: { min: number; max: number; step: number };
    };
  };
  recipes: ContractRecipe[];
  status_attribute_entity: string;
  bridge_attribute_entity: string;
  // v2 additive (§6.1/§6.2/§6.3 — presence-gated, never required):
  parameters?: Record<string, ParameterDescriptor>;
  forbidden_combinations?: ForbiddenCombination[];
  actions?: ActionEntry[];
  strings_version?: string;
  // v3 additive (§9.1/§9.3 — presence-gated, never required):
  settings?: SettingDescriptor[];
  directkey?: DirectKeyBlock;
}

// ---------------------------------------------------------------------------
// Structural validation (v1-required fields ONLY — §6.0.1)
// ---------------------------------------------------------------------------

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

function isRange(v: unknown): boolean {
  return (
    isObject(v) &&
    typeof v.min === "number" &&
    typeof v.max === "number" &&
    typeof v.step === "number"
  );
}

const STATUS_VOCAB_KEYS = [
  "process",
  "sub_process",
  "manipulation",
  "info_message",
] as const;

const FREESTYLE_VOCAB_KEYS = [
  "process",
  "intensity",
  "aroma",
  "temperature",
  "shots",
  "blend",
] as const;

/**
 * Structural validation of a contract document.
 *
 * Requires ONLY the v1 core fields (§6.0.1): a v1 document without any
 * v2/v3 block is valid, and unknown fields are ignored (§5.3.1). Does NOT
 * gate on contract_version — version gating is a separate, orthogonal check
 * (classifyVersionMismatch), because a malformed-but-supported document must
 * classify as a transient failure while an unsupported version is durable.
 */
export function validateContract(doc: unknown): doc is UiContract {
  if (!isObject(doc)) return false;
  if (typeof doc.contract_version !== "number") return false;
  if (typeof doc.contract_fingerprint !== "string") return false;
  if (typeof doc.entry_id !== "string") return false;

  const machine = doc.machine;
  if (!isObject(machine)) return false;
  if (typeof machine.brand !== "string") return false;
  if (typeof machine.connected !== "boolean") return false;

  const caps = doc.capabilities;
  if (!isObject(caps)) return false;
  if (typeof caps.supports_freestyle !== "boolean") return false;
  if (typeof caps.my_coffee_slots !== "number") return false;
  if (typeof caps.hopper_count !== "number") return false;
  if (!isStringArray(caps.tolerated_brew_manipulations)) return false;

  const vocab = doc.vocabularies;
  if (!isObject(vocab)) return false;
  const status = vocab.status;
  const freestyle = vocab.freestyle;
  if (!isObject(status) || !isObject(freestyle)) return false;
  for (const key of STATUS_VOCAB_KEYS) {
    if (!isStringArray(status[key])) return false;
  }
  for (const key of FREESTYLE_VOCAB_KEYS) {
    if (!isStringArray(freestyle[key])) return false;
  }

  const limits = doc.limits;
  if (!isObject(limits) || !isObject(limits.portion_ml)) return false;
  const portion = limits.portion_ml as Record<string, unknown>;
  if (!isRange(portion.c1) || !isRange(portion.c2)) return false;

  if (!Array.isArray(doc.recipes)) return false;
  for (const r of doc.recipes) {
    if (!isObject(r)) return false;
    if (typeof r.recipe_id !== "number") return false;
    if (typeof r.name !== "string") return false;
    if (typeof r.category !== "string") return false;
  }

  if (typeof doc.status_attribute_entity !== "string") return false;
  if (typeof doc.bridge_attribute_entity !== "string") return false;
  return true;
}

// ---------------------------------------------------------------------------
// Bridge attributes — sensor.<prefix>_connection (§3.4 block A)
// ---------------------------------------------------------------------------

/** Parsed bridge block from the always-available connection sensor. */
export interface BridgeAttributes {
  /** Scoping id for every contract WS call. */
  entryId: string;
  /** Served contract version, or null on a pre-contract integration. */
  contractVersion: number | null;
  /** Content revision; may be null pre-handshake (contract_not_ready). */
  contractFingerprint: string | null;
  /** Boolean twin of native_value; the §2.3.5 transient-retry trigger. */
  connected: boolean;
}

/**
 * Read the bridge block from `sensor.<prefix>_connection` attributes.
 *
 * Returns null when the connection sensor is missing or carries no contract
 * attributes at all (pre-0.91 integration) — the caller then shows the
 * "update the integration" screen (the PWA has no legacy mode, §5.4).
 */
export function readBridgeAttributes(
  entities: HassEntities,
  prefix: string,
): BridgeAttributes | null {
  const entity: HassEntity | undefined =
    entities[`sensor.${prefix}_connection`];
  const attrs = entity?.attributes as Record<string, unknown> | undefined;
  if (!attrs || typeof attrs.entry_id !== "string") return null;
  return {
    entryId: attrs.entry_id,
    contractVersion:
      typeof attrs.contract_version === "number"
        ? attrs.contract_version
        : null,
    contractFingerprint:
      typeof attrs.contract_fingerprint === "string"
        ? attrs.contract_fingerprint
        : null,
    connected: attrs.connected === true,
  };
}

/** Mismatch direction for a bridge block (null bridge = pre-contract server). */
export function bridgeVersionMismatch(
  bridge: BridgeAttributes | null,
): MismatchDirection | null {
  return classifyVersionMismatch(bridge?.contractVersion ?? undefined);
}

// ---------------------------------------------------------------------------
// Live status tokens — sensor.<prefix>_state (§3.4 block B)
// ---------------------------------------------------------------------------

/** Parsed live token block from the state sensor. */
export interface StatusTokens {
  /** MachineProcess token, or null for an unmapped raw code. */
  processToken: string | null;
  /** SubProcess token, or null when idle. */
  subProcessToken: string | null;
  /** Manipulation token; "NONE" for none/unknown, null iff status is None. */
  manipulationToken: string | null;
  /** Server-derived: process == PRODUCT. */
  isBrewing: boolean;
  /** Server-derived: manipulation in PROMPT_MANIPULATIONS. */
  awaitingConfirmation: boolean;
  /** Existing raw process id attribute (kept for diagnostics). */
  processId: number | null;
  /** Frozen InfoMessage token list (§3.4). */
  infoMessages: string[];
}

/**
 * Read the live token block from `sensor.<prefix>_state` attributes.
 *
 * Returns null when token mode is not eligible (bridge absent or its
 * contract_version unsupported — the §5.3.3 gate covers the attribute
 * surface too) and when the state sensor is unavailable, which IS the
 * offline signal (§3.4): HA strips attributes from unavailable entities.
 * Callers MUST NOT infer "no token support" from a null caused by
 * unavailability — eligibility hangs off the bridge, not this sensor.
 */
export function readStatusTokens(
  entities: HassEntities,
  prefix: string,
  bridge: BridgeAttributes | null,
): StatusTokens | null {
  if (bridgeVersionMismatch(bridge) !== null) return null;
  const entity: HassEntity | undefined = entities[`sensor.${prefix}_state`];
  if (!entity) return null;
  if (entity.state === "unavailable" || entity.state === "unknown") return null;
  const attrs = entity.attributes as Record<string, unknown> | undefined;
  if (!attrs || !("process_token" in attrs)) return null;
  return {
    processToken:
      typeof attrs.process_token === "string" ? attrs.process_token : null,
    subProcessToken:
      typeof attrs.sub_process_token === "string"
        ? attrs.sub_process_token
        : null,
    manipulationToken:
      typeof attrs.manipulation_token === "string"
        ? attrs.manipulation_token
        : null,
    isBrewing: attrs.is_brewing === true,
    awaitingConfirmation: attrs.awaiting_confirmation === true,
    processId: typeof attrs.process_id === "number" ? attrs.process_id : null,
    infoMessages: isStringArray(attrs.info_messages) ? attrs.info_messages : [],
  };
}

// ---------------------------------------------------------------------------
// Fetch lifecycle — WS ui_contract/get with failure classification (§2.3)
// ---------------------------------------------------------------------------

/** WS error codes the server defines for ui_contract/get (§2.2). */
const TRANSIENT_WS_CODES = new Set([
  "entry_not_found",
  "client_not_ready",
  "contract_not_ready",
]);

/** Successful fetch; `stale` is false for live documents (true only from persistence). */
export interface ContractFetchSuccess {
  ok: true;
  contract: UiContract;
  stale: false;
}

/**
 * Classified failure (§2.3.5): "durable" latches legacy/fallback for the
 * session (unknown command, unsupported version); "transient" is retried on
 * the next connected false→true transition or fingerprint change.
 */
export interface ContractFetchFailure {
  ok: false;
  kind: "durable" | "transient";
  reason: string;
  mismatch: MismatchDirection | null;
}

export type ContractFetchResult = ContractFetchSuccess | ContractFetchFailure;

function wsErrorCode(err: unknown): string | null {
  if (isObject(err) && typeof err.code === "string") return err.code;
  return null;
}

/**
 * Fetch the contract document for one entry over the existing WS connection.
 *
 * Pure fetch + classification; no caching (see getUiContract). Never throws.
 */
export async function fetchUiContract(
  conn: Connection,
  entryId: string,
): Promise<ContractFetchResult> {
  let doc: unknown;
  try {
    doc = await conn.sendMessagePromise({
      type: "melitta_barista/ui_contract/get",
      entry_id: entryId,
    });
  } catch (err) {
    const code = wsErrorCode(err);
    if (code === "unknown_command") {
      // Durable: the server has no contract support at all (§2.3.5).
      return {
        ok: false,
        kind: "durable",
        reason: "unknown_command",
        mismatch: "update_integration",
      };
    }
    // entry_not_found / client_not_ready / contract_not_ready / network / auth.
    return {
      ok: false,
      kind: "transient",
      reason: code && TRANSIENT_WS_CODES.has(code) ? code : "network_error",
      mismatch: null,
    };
  }

  const version = isObject(doc) ? doc.contract_version : undefined;
  const mismatch = classifyVersionMismatch(version);
  if (mismatch !== null) {
    // Durable: a response whose contract_version is not supported (§2.3.5).
    return {
      ok: false,
      kind: "durable",
      reason: "unsupported_contract_version",
      mismatch,
    };
  }
  if (!validateContract(doc)) {
    // Malformed payload whose contract_version IS supported: assumed to be a
    // server-side transient, e.g. a partially built document (§2.3.5).
    return {
      ok: false,
      kind: "transient",
      reason: "malformed_contract",
      mismatch: null,
    };
  }
  return { ok: true, contract: doc, stale: false };
}

// ---------------------------------------------------------------------------
// Session cache (per entry_id + fingerprint) with durable-failure latch
// ---------------------------------------------------------------------------

const sessionCache = new Map<string, UiContract>();
const durableFailure = new Map<string, ContractFetchFailure>();

function cacheKey(entryId: string, fingerprint: string): string {
  return `${entryId} ${fingerprint}`;
}

/** Clear the in-memory contract session state (tests, logout). */
export function resetContractSession(): void {
  sessionCache.clear();
  durableFailure.clear();
}

/**
 * Cached contract access, keyed by entry_id + contract_fingerprint (§2.3.4).
 *
 * A fingerprint change on the bridge naturally misses the cache and refetches
 * (reconnect with a different family, machine-type refinement, options-flow
 * override, Melitta recipe-preload completion). A durable failure latches the
 * entry for the rest of the session — no re-probing (§2.3.5); transient
 * failures leave the cache untouched so the caller may retry on the next
 * connected false→true transition. Successful fetches are persisted as the
 * entry's last-good contract (§5.4 PWA rule).
 */
export async function getUiContract(
  conn: Connection,
  entryId: string,
  fingerprint: string | null,
): Promise<ContractFetchResult> {
  const latched = durableFailure.get(entryId);
  if (latched) return latched;
  if (fingerprint !== null) {
    const cached = sessionCache.get(cacheKey(entryId, fingerprint));
    if (cached) return { ok: true, contract: cached, stale: false };
  }
  const result = await fetchUiContract(conn, entryId);
  if (result.ok) {
    sessionCache.set(
      cacheKey(entryId, result.contract.contract_fingerprint),
      result.contract,
    );
    persistLastGoodContract(result.contract);
  } else if (result.kind === "durable") {
    durableFailure.set(entryId, result);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Per-entry last-good persistence with stale marking (§5.4 PWA rule)
// ---------------------------------------------------------------------------

const PERSIST_PREFIX = "melitta_contract_";
const PERSIST_ENVELOPE_VERSION = 1;

/** A persisted contract rendered before/without a live fetch — always stale-marked. */
export interface StaleContract {
  contract: UiContract;
  stale: true;
  savedAt: string | null;
}

/** Persist the last-good contract for its entry_id (best-effort). */
export function persistLastGoodContract(contract: UiContract): void {
  try {
    localStorage.setItem(
      PERSIST_PREFIX + contract.entry_id,
      JSON.stringify({
        v: PERSIST_ENVELOPE_VERSION,
        saved_at: new Date().toISOString(),
        contract,
      }),
    );
  } catch {
    // Persistence is a convenience; never let storage failures surface.
  }
}

/**
 * Load the last-good contract for an entry, revalidating it on the way in.
 *
 * The stored document is re-run through validateContract AND the version gate
 * on every load — a contract persisted by an older app build that no longer
 * validates, or whose version this build no longer supports, is discarded
 * (and removed) rather than rendered. The result is always marked stale; the
 * caller refetches on the next successful connection (§5.4).
 */
export function loadLastGoodContract(entryId: string): StaleContract | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(PERSIST_PREFIX + entryId);
  } catch {
    return null;
  }
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    dropPersistedContract(entryId);
    return null;
  }
  if (!isObject(parsed)) {
    dropPersistedContract(entryId);
    return null;
  }
  const contract = parsed.contract;
  if (
    !validateContract(contract) ||
    classifyVersionMismatch(contract.contract_version) !== null ||
    contract.entry_id !== entryId
  ) {
    dropPersistedContract(entryId);
    return null;
  }
  return {
    contract,
    stale: true,
    savedAt: typeof parsed.saved_at === "string" ? parsed.saved_at : null,
  };
}

/** Remove the persisted contract for an entry (best-effort). */
export function dropPersistedContract(entryId: string): void {
  try {
    localStorage.removeItem(PERSIST_PREFIX + entryId);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Per-feature presence-gating readers (§6.0.1 — presence, never version)
// ---------------------------------------------------------------------------

/**
 * v2 parameter catalogs, or null when absent/malformed → the caller falls
 * back to tier 2 (v1 vocabularies/limits) per §6.1.5. Descriptors that are
 * not objects are dropped (per-parameter degradation, §6.0.3).
 */
export function readParameters(
  contract: UiContract | null,
): Record<string, ParameterDescriptor> | null {
  const block = contract?.parameters;
  if (!isObject(block)) return null;
  const out: Record<string, ParameterDescriptor> = {};
  for (const [family, desc] of Object.entries(block)) {
    if (isObject(desc) && typeof desc.kind === "string") {
      out[family] = desc as unknown as ParameterDescriptor;
    }
  }
  return out;
}

/** v2 forbidden combinations; absent → empty list (advisory only, §6.1.6). */
export function readForbiddenCombinations(
  contract: UiContract | null,
): ForbiddenCombination[] {
  const block = contract?.forbidden_combinations;
  if (!Array.isArray(block)) return [];
  return block.filter(
    (c): c is ForbiddenCombination => isObject(c) && isObject(c.params),
  );
}

/**
 * v2 action catalog, or null when absent → legacy hardcoded action arrays.
 * Entries without an "action" key are dropped (§6.0.3 unknown-shape rule).
 */
export function readActions(contract: UiContract | null): ActionEntry[] | null {
  const block = contract?.actions;
  if (!Array.isArray(block)) return null;
  return block.filter(
    (a): a is ActionEntry => isObject(a) && typeof a.action === "string",
  );
}

/** v3 settings descriptors, or null → tier-2 hardcoded tables (§9.1.6). */
export function readSettings(
  contract: UiContract | null,
): SettingDescriptor[] | null {
  const block = contract?.settings;
  if (!Array.isArray(block)) return null;
  return block.filter(
    (s): s is SettingDescriptor =>
      isObject(s) &&
      typeof s.setting === "string" &&
      typeof s.control === "string" &&
      isObject(s.entity) &&
      typeof (s.entity as Record<string, unknown>).entity_suffix === "string",
  );
}

/** v3 DirectKey/profile model, or null → hardcoded category arrays (§9.3.6). */
export function readDirectKey(
  contract: UiContract | null,
): DirectKeyBlock | null {
  const block = contract?.directkey;
  if (!isObject(block)) return null;
  if (!Array.isArray(block.categories) || !Array.isArray(block.profiles)) {
    return null;
  }
  return block as unknown as DirectKeyBlock;
}

/** Brand badge data, or null → the app's own neutral header (§3.10 amendment). */
export function readBrandTheme(contract: UiContract | null): BrandTheme | null {
  const block = contract?.brand_theme;
  if (!isObject(block) || typeof block.brand !== "string") return null;
  return block as unknown as BrandTheme;
}

/** v2 strings_version, or null (server i18n then falls back to bundles). */
export function readStringsVersion(contract: UiContract | null): string | null {
  const v = contract?.strings_version;
  return typeof v === "string" ? v : null;
}
