/**
 * Token-first machine-status model (UI Contract v1 adoption, §3.4 B / §5.3).
 *
 * `deriveMachineStatus` produces the one status view every status call site
 * (StatusBar, StatusOverlay, App tab-lock, BrewSection) renders from:
 *
 * - **Token mode** — when the bridge block on `sensor.<prefix>_connection`
 *   is present with a supported `contract_version`, status comes from the
 *   state sensor's token attributes (`process_token` & co). An unavailable
 *   state sensor IS the offline signal (§3.4).
 * - **Legacy mode** — pre-contract integrations (no bridge attributes) and
 *   unsupported contract versions (§5.3.3) fall back to the frozen English
 *   `native_value` string matching, byte-identical to the pre-contract app.
 *
 * Labels follow the §6.3.5.1 per-key preference order: server string →
 * en/ru/de bundle → humanized token. The §6.3.7 state descriptions
 * (`status.process.<TOKEN>.description`, `status.sub_process.<TOKEN>.description`)
 * ride along as `processDescription` / `activityDescription` — server-only,
 * null when unserved, so call sites keep their own generic copy. Pure
 * module: no hooks, no HA imports beyond types.
 */
import type { HassEntities } from "home-assistant-js-websocket";
import {
  readBridgeAttributes,
  readStatusTokens,
  bridgeVersionMismatch,
  type BridgeAttributes,
  type StatusTokens,
  type UiContract,
} from "./contract";
import { getState } from "./entities";
import { serverString } from "./server-strings";
import { humanizeToken, t, tServer, type Locale, type TranslationKey } from "./i18n";

/** Service-mode kinds (the machine is doing maintenance work or is busy). */
export type ServiceKind =
  | "cleaning"
  | "easy_clean"
  | "intensive_clean"
  | "descaling"
  | "evaporating"
  | "busy";

/** The one status view all status call sites render from. */
export interface MachineStatusView {
  /** Which derivation produced the view (per-feature gating on bridge presence). */
  source: "tokens" | "legacy";
  /** BLE link to the machine (bridge `connected` / legacy connection sensor). */
  connected: boolean;
  /** State sensor unavailable — machine disconnected or no status (§3.4). */
  offline: boolean;
  /** Machine reports switch-off (SWITCH_OFF / "Off"). */
  off: boolean;
  ready: boolean;
  brewing: boolean;
  /** Maintenance/busy mode, or null. */
  service: ServiceKind | null;
  /**
   * Token mode only: process token outside the known v1 vocabulary (or a
   * null token for an unmapped raw code) — rendered as neutral "active/busy"
   * per §5.3.2 rule 2, never thrown on.
   */
  unknownActive: boolean;
  /** Raw process token (null in legacy mode or when unmapped). */
  processToken: string | null;
  /** Status-bar text: localized token label / legacy native_value string. */
  statusLabel: string;
  /** Current sub-activity label, or null when idle. */
  activityLabel: string | null;
  /**
   * Served one-sentence description of the process token
   * (`status.process.<TOKEN>.description`, §6.3.7), or null when the server
   * doesn't say — callers then keep their own copy. Server-only by design:
   * the description families have no per-token bundle equivalent, so the
   * client tier is whatever generic line the call site already showed.
   */
  processDescription: string | null;
  /**
   * Served description of the sub-process token
   * (`status.sub_process.<TOKEN>.description`, §6.3.7), or null. Served
   * "only where it adds meaning over the label", so absence is normal.
   */
  activityDescription: string | null;
  /** A user action is required (manipulation / action_required sensor). */
  hasAction: boolean;
  /** Localized action title (legacy mode: the raw English sensor string). */
  actionLabel: string | null;
  /** Legacy-mode translated hint under the action title (token mode: null). */
  actionHint: string | null;
  /** Manipulation is in PROMPT_MANIPULATIONS (server-derived; legacy: false). */
  awaitingConfirmation: boolean;
}

/** The 12 MachineProcess tokens frozen by contract v1 (§3.2). */
const KNOWN_PROCESS_TOKENS = new Set([
  "READY",
  "PRODUCT",
  "CLEANING",
  "DESCALING",
  "FILTER_INSERT",
  "FILTER_REPLACE",
  "FILTER_REMOVE",
  "SWITCH_OFF",
  "EASY_CLEAN",
  "INTENSIVE_CLEAN",
  "EVAPORATING",
  "BUSY",
]);

const SERVICE_BY_TOKEN: Record<string, ServiceKind> = {
  CLEANING: "cleaning",
  EASY_CLEAN: "easy_clean",
  INTENSIVE_CLEAN: "intensive_clean",
  DESCALING: "descaling",
  EVAPORATING: "evaporating",
  BUSY: "busy",
};

/** Process token → legacy bundle key (tier 2 of the §6.3.5.1 chain). */
const PROCESS_BUNDLE_KEY: Record<string, string> = {
  PRODUCT: "status.brewing",
  SWITCH_OFF: "status.off",
  CLEANING: "status.cleaning",
  DESCALING: "status.descaling",
  BUSY: "status.busy",
  EASY_CLEAN: "service.easy_clean",
  INTENSIVE_CLEAN: "service.intensive_clean",
  EVAPORATING: "service.evaporating",
};

/** Manipulation token → legacy bundle key (the app's `action.*` entries). */
const MANIPULATION_BUNDLE_KEY: Record<string, string> = {
  BU_REMOVED: "action.brew_unit_removed",
  TRAYS_MISSING: "action.trays_missing",
  EMPTY_TRAYS: "action.empty_trays",
  FILL_WATER: "action.fill_water",
  CLOSE_POWDER_LID: "action.close_powder_lid",
  FILL_POWDER: "action.fill_powder",
};

/**
 * SubProcess token → the frozen English activity-sensor strings — the exact
 * text the legacy Activity sensor shows, kept as the tier-2 fallback so
 * token mode without server strings matches legacy rendering byte-for-byte.
 */
const SUB_PROCESS_FALLBACK: Record<string, string> = {
  GRINDING: "Grinding",
  COFFEE: "Extracting",
  STEAM: "Steaming",
  WATER: "Dispensing Water",
  PREPARE: "Preparing",
};

/** Frozen legacy native_value string → service kind (pre-contract matching). */
const LEGACY_SERVICE_BY_STATE: Record<string, ServiceKind> = {
  Cleaning: "cleaning",
  "Easy Clean": "easy_clean",
  "Intensive Clean": "intensive_clean",
  Descaling: "descaling",
  Evaporating: "evaporating",
  Busy: "busy",
};

/** Frozen legacy action_required string → the app's bundle hint key. */
const LEGACY_ACTION_HINT_KEY: Record<string, TranslationKey> = {
  "Brew Unit Removed": "action.brew_unit_removed",
  "Trays Missing": "action.trays_missing",
  "Empty Trays": "action.empty_trays",
  "Fill Water": "action.fill_water",
  "Close Powder Lid": "action.close_powder_lid",
  "Fill Powder": "action.fill_powder",
};

function fromTokens(
  tokens: StatusTokens,
  bridge: BridgeAttributes,
  locale: Locale,
): MachineStatusView {
  const tok = tokens.processToken;
  const known = tok !== null && KNOWN_PROCESS_TOKENS.has(tok);
  const ready = tok === "READY";
  const brewing = tokens.isBrewing || tok === "PRODUCT";
  const off = tok === "SWITCH_OFF";
  const service = tok !== null ? (SERVICE_BY_TOKEN[tok] ?? null) : null;
  const unknownActive = !known;

  // §5.3.2 rule 2: an unmapped raw code renders as neutral "busy".
  const statusLabel =
    tok === null
      ? tServer(locale, "status.process.BUSY", "status.busy")
      : tServer(locale, `status.process.${tok}`, PROCESS_BUNDLE_KEY[tok]);

  const sub = tokens.subProcessToken;
  const activityLabel =
    sub === null
      ? null
      : (serverString(`status.sub_process.${sub}`) ??
        SUB_PROCESS_FALLBACK[sub] ??
        humanizeToken(sub));

  const manip = tokens.manipulationToken;
  const hasAction = manip !== null && manip !== "NONE";
  const actionLabel = hasAction
    ? tServer(locale, `status.manipulation.${manip}`, MANIPULATION_BUNDLE_KEY[manip])
    : null;

  return {
    source: "tokens",
    connected: bridge.connected,
    offline: false,
    off,
    ready,
    brewing,
    service,
    unknownActive,
    processToken: tok,
    statusLabel,
    activityLabel,
    // An unmapped raw code borrows BUSY's description, mirroring the
    // neutral-busy label above (§5.3.2 rule 2).
    processDescription: serverString(`status.process.${tok ?? "BUSY"}.description`) ?? null,
    activityDescription:
      sub === null ? null : (serverString(`status.sub_process.${sub}.description`) ?? null),
    hasAction,
    actionLabel,
    actionHint: null,
    awaitingConfirmation: tokens.awaitingConfirmation,
  };
}

function offlineView(source: "tokens" | "legacy", connected: boolean): MachineStatusView {
  return {
    source,
    connected,
    offline: true,
    off: false,
    ready: false,
    brewing: false,
    service: null,
    unknownActive: false,
    processToken: null,
    // The frozen legacy StatusBar placeholder — kept byte-identical.
    statusLabel: "offline",
    activityLabel: null,
    processDescription: null,
    activityDescription: null,
    hasAction: false,
    actionLabel: null,
    actionHint: null,
    awaitingConfirmation: false,
  };
}

function fromLegacy(
  entities: HassEntities,
  prefix: string,
  locale: Locale,
): MachineStatusView {
  const machineState = getState(entities, prefix, "sensor", "state");
  const connected =
    getState(entities, prefix, "sensor", "connection") === "Connected";
  if (machineState === null || machineState === "offline") {
    return offlineView("legacy", connected);
  }

  const actionRequired = getState(entities, prefix, "sensor", "action_required");
  const hasAction = !!actionRequired && actionRequired !== "None";
  const hintKey = actionRequired
    ? LEGACY_ACTION_HINT_KEY[actionRequired]
    : undefined;

  return {
    source: "legacy",
    connected,
    offline: false,
    off: machineState === "Off",
    ready: machineState === "Ready",
    brewing: machineState === "Brewing",
    service: LEGACY_SERVICE_BY_STATE[machineState] ?? null,
    unknownActive: false,
    processToken: null,
    statusLabel: machineState,
    activityLabel: getState(entities, prefix, "sensor", "activity"),
    // Legacy mode has no tokens to key the served descriptions by.
    processDescription: null,
    activityDescription: null,
    hasAction,
    actionLabel: hasAction ? actionRequired : null,
    actionHint: hasAction && hintKey ? t(locale, hintKey) : null,
    awaitingConfirmation: false,
  };
}

/**
 * Derive the machine-status view for the current entity states.
 *
 * Token mode requires the bridge block with a supported contract_version
 * (§5.3.3 — an unsupported version disables the token surface entirely);
 * everything else — including a ≥0.91 bridge whose state sensor is available
 * but carries no token attributes yet — degrades to the legacy string path.
 */
export function deriveMachineStatus(
  entities: HassEntities,
  prefix: string,
  locale: Locale,
): MachineStatusView {
  const bridge = readBridgeAttributes(entities, prefix);
  if (bridge !== null && bridgeVersionMismatch(bridge) === null) {
    const tokens = readStatusTokens(entities, prefix, bridge);
    if (tokens !== null) return fromTokens(tokens, bridge, locale);
    const stateEntity = entities[`sensor.${prefix}_state`];
    const unavailable =
      !stateEntity ||
      stateEntity.state === "unavailable" ||
      stateEntity.state === "unknown";
    // Unavailable state sensor IS the offline signal (§3.4) — never a
    // "no token support" inference. Available-but-tokenless falls through
    // to the legacy string path (per-feature degradation).
    if (unavailable) return offlineView("tokens", bridge.connected);
  }
  return fromLegacy(entities, prefix, locale);
}

/**
 * Should navigation be locked to the current view? Mirrors the legacy App
 * gate: locked while an action is required or the machine is neither ready
 * nor offline (offline and ready both allow free tab switching).
 */
export function isNavigationLocked(view: MachineStatusView): boolean {
  return view.hasAction || !(view.ready || view.offline);
}

/** Capability-driven section visibility (§3.5); null contract → all shown. */
export interface SectionGates {
  freestyle: boolean;
  stats: boolean;
}

/**
 * Gate app sections on contract capabilities (§3.5): `supports_freestyle`
 * gates the freestyle tab, `supports_stats` the stats tab. Without a
 * contract every section stays visible — the current legacy behavior.
 */
export function sectionGates(contract: UiContract | null): SectionGates {
  if (!contract) return { freestyle: true, stats: true };
  return {
    freestyle: contract.capabilities.supports_freestyle !== false,
    stats: contract.capabilities.supports_stats !== false,
  };
}
