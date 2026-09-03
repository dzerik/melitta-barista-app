/**
 * Action-catalog client logic (UI Contract §6.2, v2 adoption).
 *
 * PURE module — ports the card's action-catalog semantics to the PWA: no
 * React, no HA imports beyond types; vitest-testable in isolation.
 *
 * The catalog is DESCRIPTIVE, never a correctness boundary (§6.2.4): every
 * helper here gates styling/visibility only — the server re-validates every
 * command and the machine NACKs what it can't do. Absence of `actions` (a
 * pre-0.92 server) resolves to null and MaintenanceSection falls back to its
 * permanent legacy hardcoded action tables (§6.2.5.1).
 */
import type { UiContract } from "./contract";
import type { MachineStatusView } from "./status";
import { serverString } from "./server-strings";
import { bundleString, humanizeToken, type Locale } from "./i18n";

// ---------------------------------------------------------------------------
// Typed catalog entries (§6.2.1) — refined from the loose contract block
// ---------------------------------------------------------------------------

/** One declared service parameter (§6.2.1). */
export interface ActionParam {
  name: string;
  kind: string;
  required: boolean;
  tokens?: string[];
  default?: string | number | boolean;
  ranges?: [number, number][];
  ref?: string;
}

/** Press `button.<prefix>_<entity_suffix>`. */
export interface InvocationButton {
  kind: "button";
  entity_suffix: string;
}

/** Call `melitta_barista.<service>` anchored at `button.<prefix>_<entity_suffix>`. */
export interface InvocationService {
  kind: "service";
  service: string;
  entity_suffix: string;
  params: ActionParam[];
}

export type ActionInvocation = InvocationButton | InvocationService;

/** One well-formed catalog entry (§6.2.1) — key "action" (binding precedent). */
export interface CatalogAction {
  action: string;
  group: string;
  process: string | null;
  icon?: string;
  confirm: boolean;
  destructive: boolean;
  requires: string[];
  available: boolean;
  invocation: ActionInvocation;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function readParams(raw: unknown): ActionParam[] {
  if (!Array.isArray(raw)) return [];
  const out: ActionParam[] = [];
  for (const p of raw) {
    if (isRecord(p) && typeof p.name === "string" && typeof p.kind === "string") {
      out.push(p as unknown as ActionParam);
    }
  }
  return out;
}

/**
 * Validate one entry's invocation (§6.2.1). An entry with an unknown or
 * malformed `invocation.kind` returns null and is dropped by the reader
 * (§6.0.3) — service-kind entries MUST carry `entity_suffix` (the normative
 * multi-machine anchor).
 */
function readInvocation(raw: unknown): ActionInvocation | null {
  if (!isRecord(raw)) return null;
  if (raw.kind === "button") {
    if (typeof raw.entity_suffix !== "string") return null;
    return { kind: "button", entity_suffix: raw.entity_suffix };
  }
  if (raw.kind === "service") {
    if (typeof raw.service !== "string") return null;
    if (typeof raw.entity_suffix !== "string") return null;
    return {
      kind: "service",
      service: raw.service,
      entity_suffix: raw.entity_suffix,
      params: readParams(raw.params),
    };
  }
  return null;
}

/**
 * The contract's action catalog as typed entries, or null when the contract
 * is absent or carries no `actions` field (pre-0.92 server → legacy tables,
 * §6.2.5.1). Entries without an "action" token or with unknown/malformed
 * invocation kinds are dropped (§6.0.3); `available`/`confirm`/`requires`
 * default safe (shown / no confirm / always satisfied).
 */
export function readActionCatalog(
  contract: UiContract | null,
): CatalogAction[] | null {
  const block = contract?.actions;
  if (!Array.isArray(block)) return null;
  const out: CatalogAction[] = [];
  for (const raw of block) {
    if (!isRecord(raw) || typeof raw.action !== "string") continue;
    const invocation = readInvocation(raw.invocation);
    if (invocation === null) continue;
    out.push({
      action: raw.action,
      group: typeof raw.group === "string" ? raw.group : "other",
      process: typeof raw.process === "string" ? raw.process : null,
      icon: typeof raw.icon === "string" ? raw.icon : undefined,
      confirm: raw.confirm === true,
      destructive: raw.destructive === true,
      requires: Array.isArray(raw.requires)
        ? raw.requires.filter((t): t is string => typeof t === "string")
        : [],
      available: raw.available !== false,
      invocation,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Catalog resolution (§6.2.3/§6.2.5)
// ---------------------------------------------------------------------------

/** One rendered action group: catalog entries sharing a `group` token. */
export interface ActionGroup {
  group: string;
  entries: CatalogAction[];
}

/** Known group render order (§6.2.3); unknown groups follow, served order. */
export const KNOWN_GROUP_ORDER: readonly string[] = [
  "brew",
  "control",
  "cleaning",
  "filter",
  "power",
  "danger",
];

/**
 * Groups the PWA renders with bespoke UI (§6.2.5.2): brew lives in
 * BrewSection/FreestyleSection, control (cancel/confirm_prompt/reset_recipe/
 * save_directkey) in the status overlay and the recipe editor — their catalog
 * entries are informational for this client and never enter maintenance
 * rendering.
 */
export const INFORMATIONAL_GROUPS: readonly string[] = ["brew", "control"];

/**
 * Resolve a contract's action catalog into ordered render groups (§6.2).
 *
 * Returns null when there is no catalog (pre-0.92 server) — the caller
 * renders its legacy hardcoded tables (§6.2.5.1). Otherwise `available:
 * false` entries are hidden (§6.2.5.3) and survivors are grouped in the
 * §6.2.3 order — known groups first, then unknown groups in served order. An
 * empty result (`actions: []`, or everything filtered) is catalog mode with
 * nothing to show, NOT legacy fallback.
 */
export function resolveActionCatalog(
  contract: UiContract | null,
): ActionGroup[] | null {
  const entries = readActionCatalog(contract);
  if (entries === null) return null;
  const byGroup = new Map<string, CatalogAction[]>();
  for (const entry of entries) {
    if (!entry.available) continue;
    const list = byGroup.get(entry.group);
    if (list) list.push(entry);
    else byGroup.set(entry.group, [entry]);
  }
  const ordered: ActionGroup[] = [];
  for (const group of KNOWN_GROUP_ORDER) {
    const list = byGroup.get(group);
    if (list) {
      ordered.push({ group, entries: list });
      byGroup.delete(group);
    }
  }
  // Map iteration preserves insertion order = served order (§6.2.3).
  for (const [group, list] of byGroup) ordered.push({ group, entries: list });
  return ordered;
}

/**
 * The subset of a resolved catalog the maintenance section renders
 * (§6.2.5.2): everything except the informational brew/control groups.
 * Unknown groups pass through — a client must render a group it has never
 * heard of (§1.2).
 */
export function maintenanceActionGroups(catalog: ActionGroup[]): ActionGroup[] {
  return catalog.filter((g) => !INFORMATIONAL_GROUPS.includes(g.group));
}

// ---------------------------------------------------------------------------
// `requires` evaluation (§6.2.4) — client-side, advisory
// ---------------------------------------------------------------------------

/** Inputs for evalRequires, derived from surfaces the app already reads. */
export interface RequiresContext {
  /** Bridge `connected` attribute (§3.4 A) / legacy connection sensor. */
  connected: boolean;
  /** process READY with no manipulation pending (§6.2.4 "ready"). */
  ready: boolean;
  /** State attribute awaiting_confirmation (token mode only). */
  awaitingConfirmation: boolean;
}

/**
 * Build the requires context from the app's one status view. §6.2.4 defines
 * "ready" as process READY **and** manipulation NONE, so the view's ready
 * flag is ANDed with the absence of a pending action.
 */
export function requiresContextFromStatus(
  view: MachineStatusView,
): RequiresContext {
  return {
    connected: view.connected,
    ready: view.ready && !view.hasAction,
    awaitingConfirmation: view.awaitingConfirmation,
  };
}

/**
 * Evaluate an entry's `requires` condition tokens (§6.2.4).
 *
 * All listed tokens must hold (AND); `[]` is always satisfied. An UNKNOWN
 * token is treated as satisfied (fail-open) — the catalog gates enablement
 * styling, never correctness; the server re-validates every command. The
 * `switch_off` entry's `["connected"]` (not `ready`) encodes the PR #42
 * precedent as data: Switch Off stays usable while connected-not-ready.
 */
export function evalRequires(
  requires: string[],
  ctx: RequiresContext,
): boolean {
  for (const token of requires) {
    switch (token) {
      case "connected":
        if (!ctx.connected) return false;
        break;
      case "ready":
        if (!ctx.ready) return false;
        break;
      case "awaiting_confirmation":
        if (!ctx.awaitingConfirmation) return false;
        break;
      default:
        break; // unknown token → satisfied (fail-open, §6.2.4)
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// Confirm / destructive policy (§6.2.5.4)
// ---------------------------------------------------------------------------

/** True when the entry is flagged destructive (danger styling, §6.2.1). */
export function isDestructive(entry: CatalogAction): boolean {
  return entry.destructive;
}

/**
 * Whether pressing this entry needs a confirm step first (§6.2.5.4):
 * `destructive` forces the confirm step regardless of the `confirm` flag.
 */
export function needsConfirm(entry: CatalogAction): boolean {
  return entry.confirm || entry.destructive;
}

// ---------------------------------------------------------------------------
// Invocation planning (§6.2.1)
// ---------------------------------------------------------------------------

/** Press `button.<prefix>_<button>` — dispatch via ha.pressButton. */
export interface ActionPlanButton {
  button: string;
}

/** Call `<domain>.<service>` with `data` — dispatch via callService. */
export interface ActionPlanService {
  domain: string;
  service: string;
  data: Record<string, unknown>;
}

/** What the dispatcher executes for one pressed entry. */
export type ActionPlan = ActionPlanButton | ActionPlanService;

/**
 * Plan how to invoke an action entry (§6.2.1).
 *
 * Button kind → `{ button: entity_suffix }` (the existing pressButton path).
 * Service kind → `{ domain, service, data }` with `data.entity_id` ALWAYS
 * set to `button.<prefix>_<entity_suffix>` — the normative multi-machine
 * anchor. A bare `service` name targets the `melitta_barista` domain; a
 * dotted name carries its own domain.
 *
 * `formState` supplies parameter values keyed by `ActionParam.name`; a param
 * absent from it takes its declared `default`, and a param with neither is
 * OMITTED (the server's own schema defaults apply — the catalog is
 * descriptive). A `params_ref` param expects a record in `formState` and
 * spreads it into the service data (the referenced form is flat on the
 * wire); maintenance rendering never reaches this branch (§6.2.5.2).
 * `entity_id` is set last so no form value can override the anchor.
 */
export function planActionInvocation(
  entry: CatalogAction,
  prefix: string,
  formState?: Record<string, unknown>,
): ActionPlan {
  const inv = entry.invocation;
  if (inv.kind === "button") return { button: inv.entity_suffix };

  const dot = inv.service.indexOf(".");
  const domain = dot > 0 ? inv.service.slice(0, dot) : "melitta_barista";
  const service = dot > 0 ? inv.service.slice(dot + 1) : inv.service;
  const data: Record<string, unknown> = {};
  for (const param of inv.params) {
    const provided =
      formState && param.name in formState ? formState[param.name] : undefined;
    if (param.kind === "params_ref") {
      if (isRecord(provided)) Object.assign(data, provided);
      continue;
    }
    if (provided !== undefined) data[param.name] = provided;
    else if (param.default !== undefined) data[param.name] = param.default;
  }
  data.entity_id = `button.${prefix}_${inv.entity_suffix}`;
  return { domain, service, data };
}

// ---------------------------------------------------------------------------
// save_directkey introspected defaults (§9.3.5 — RecipeEditModal adoption)
// ---------------------------------------------------------------------------

/** Find one catalog entry by action token (available or not). */
export function findCatalogAction(
  contract: UiContract | null,
  action: string,
): CatalogAction | null {
  const entries = readActionCatalog(contract);
  if (entries === null) return null;
  return entries.find((e) => e.action === action) ?? null;
}

/**
 * The `save_directkey` catalog entry's introspected param defaults, keyed by
 * param name (§9.3.5) — what RecipeEditModal uses in place of its hardcoded
 * defaults. Null when there is no catalog or no service-kind save_directkey
 * entry (the modal then keeps its legacy consts).
 */
export function saveDirectkeyDefaults(
  contract: UiContract | null,
): Record<string, string | number | boolean> | null {
  const entry = findCatalogAction(contract, "save_directkey");
  if (!entry || entry.invocation.kind !== "service") return null;
  const out: Record<string, string | number | boolean> = {};
  for (const param of entry.invocation.params) {
    if (
      typeof param.default === "string" ||
      typeof param.default === "number" ||
      typeof param.default === "boolean"
    ) {
      out[param.name] = param.default;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Display resolution (§6.2.1 icon default, §6.2.3 group labels, §6.3.5.1)
// ---------------------------------------------------------------------------

/** Client default icon for entries with an absent/malformed icon (§6.2.1). */
export const DEFAULT_ACTION_ICON = "mdi:cog";

const MDI_RE = /^mdi:[a-z0-9][a-z0-9-]*$/;

/**
 * Icon name for a catalog entry: its `mdi:<name>` identifier when
 * well-formed, else the normative `mdi:cog` default (§6.2.1). An mdi
 * identifier is data, never markup — anything not matching the strict form
 * is discarded. Rendering resolves it via icons.ts (mdi → lucide map).
 */
export function actionIconName(entry: CatalogAction): string {
  const icon = entry.icon;
  return typeof icon === "string" && MDI_RE.test(icon)
    ? icon
    : DEFAULT_ACTION_ICON;
}

/**
 * Display label for an action token (§6.3.5.1 preference order): server
 * `actions.<token>.label` → app bundle `maint.<token>` → humanized token.
 */
export function actionLabel(locale: Locale, action: string): string {
  return (
    serverString(`actions.${action}.label`) ??
    bundleString(locale, `maint.${action}`) ??
    humanizeToken(action)
  );
}

/**
 * Optional description for an action token: server
 * `actions.<token>.description` → app bundle `maint.<token>_desc` → null
 * (descriptions are optional keys, §6.3.4 — a token without one renders
 * without a description line).
 */
export function actionDescription(locale: Locale, action: string): string | null {
  return (
    serverString(`actions.${action}.description`) ??
    bundleString(locale, `maint.${action}_desc`) ??
    null
  );
}

/** Catalog group token → the app's legacy section-header bundle key. */
const GROUP_BUNDLE_KEY: Record<string, string> = {
  cleaning: "maint.section_cleaning",
  filter: "maint.section_filter",
  power: "maint.section_other",
  danger: "maint.section_danger",
};

/**
 * Header label for an action group (§6.2.3): server
 * `actions._groups.<group>` → app bundle (legacy section headers) →
 * humanized group token (the normative fallback for unknown group ids).
 */
export function actionGroupLabel(locale: Locale, group: string): string {
  const served = serverString(`actions._groups.${group}`);
  if (served !== undefined) return served;
  const bundleKey = GROUP_BUNDLE_KEY[group];
  const bundled = bundleKey ? bundleString(locale, bundleKey) : undefined;
  return bundled ?? humanizeToken(group);
}
