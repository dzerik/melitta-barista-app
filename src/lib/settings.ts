/**
 * Settings-descriptor client logic (UI Contract §9.1, v3 adoption).
 *
 * PURE module — no React, no HA imports beyond types; vitest-testable in
 * isolation (the same precedent as `actions.ts`/`parameters.ts`).
 *
 * The contract's `settings` block is tier 1 of the §5.3.6 three-tier chain:
 * contract descriptors → the component's hardcoded SWITCHES/NUMBERS/
 * LEVEL_LABELS tables → hidden. Within tier 1, entity existence remains a
 * REQUIRED gate (§9.1.6 rule 2) — contract presence never overrides entity
 * absence, so an entry whose bound entity has no state object must not
 * render a live control.
 */
import type { HassEntity } from "home-assistant-js-websocket";
import type { SettingDescriptor, UiContract } from "./contract";
import { readSettings } from "./contract";
import { serverString } from "./server-strings";
import { bundleString, humanizeToken, type Locale } from "./i18n";

// ---------------------------------------------------------------------------
// Catalog resolution & grouping (§9.1.1/§9.1.3)
// ---------------------------------------------------------------------------

/** §9.1.3 group render order; unknown groups follow in served order. */
export const KNOWN_SETTING_GROUPS: readonly string[] = [
  "brew",
  "water",
  "power",
  "system",
];

/** One render group: entries keep their served (normative) order. */
export interface SettingGroup {
  group: string;
  entries: SettingDescriptor[];
}

/**
 * The contract's settings descriptors, or null when the contract is absent
 * or carries no `settings` field (pre-0.93 server → the component's legacy
 * hardcoded tables, §9.1.6 rule 1). Entries whose entity binding lacks a
 * string domain are dropped (per-entry degradation, §5.3.2) — the client
 * cannot assemble an entity_id for them.
 */
export function resolveSettingsCatalog(
  contract: UiContract | null,
): SettingDescriptor[] | null {
  const entries = readSettings(contract);
  if (entries === null) return null;
  return entries.filter((e) => typeof e.entity.domain === "string");
}

/**
 * Group a catalog for rendering: §9.1.3 known-group order (brew, water,
 * power, system), then unknown groups in served order; entries inside each
 * group keep the served order (the normative render order, §9.1.1).
 */
export function settingsGroups(catalog: SettingDescriptor[]): SettingGroup[] {
  const byGroup = new Map<string, SettingDescriptor[]>();
  for (const entry of catalog) {
    const group = typeof entry.group === "string" ? entry.group : "system";
    const list = byGroup.get(group);
    if (list) list.push(entry);
    else byGroup.set(group, [entry]);
  }
  const out: SettingGroup[] = [];
  for (const group of KNOWN_SETTING_GROUPS) {
    const entries = byGroup.get(group);
    if (entries) {
      out.push({ group, entries });
      byGroup.delete(group);
    }
  }
  for (const [group, entries] of byGroup) {
    out.push({ group, entries });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Entity binding (§9.1.1 anchor convention, §9.1.6 rule 2)
// ---------------------------------------------------------------------------

/** Assemble the bound entity_id: `<domain>.<prefix>_<entity_suffix>` (§9.1.1). */
export function settingEntityId(
  prefix: string,
  entry: SettingDescriptor,
): string {
  return `${entry.entity.domain}.${prefix}_${entry.entity.entity_suffix}`;
}

/**
 * Contract min/max/step cross-checked against the live entity (§9.1.6
 * rule 5): the entity is authoritative for the current instant, the contract
 * renders before/without it, and the legacy defaults close the chain.
 */
export interface NumberBounds {
  min: number;
  max: number;
  step: number;
}

function boundOf(
  entityValue: unknown,
  contractValue: number | undefined,
  fallback: number,
): number {
  if (typeof entityValue === "number" && Number.isFinite(entityValue)) {
    return entityValue;
  }
  if (typeof contractValue === "number" && Number.isFinite(contractValue)) {
    return contractValue;
  }
  return fallback;
}

/** Resolve slider/box bounds for a number entry (entity → contract → defaults). */
export function numberBounds(
  entry: SettingDescriptor,
  entity: HassEntity | undefined,
): NumberBounds {
  const attrs = (entity?.attributes ?? {}) as Record<string, unknown>;
  return {
    min: boundOf(attrs.min, entry.min, 0),
    max: boundOf(attrs.max, entry.max, 100),
    step: boundOf(attrs.step, entry.step, 1),
  };
}

// ---------------------------------------------------------------------------
// Control-kind resolution (§5.3.2 open kinds, §9.1.6 rule 6)
// ---------------------------------------------------------------------------

/** How a row renders: the three known controls, or a read-only value row. */
export type SettingControlKind = "switch" | "number" | "select" | "readonly";

/**
 * The render kind for one entry: `writable: false` and unknown `control`
 * tokens both degrade to a read-only value row (§9.1.6 rule 6 forbids a
 * disabled write control; §5.3.2 forbids dropping the row for an unknown
 * kind the server may add later).
 */
export function settingControlKind(entry: SettingDescriptor): SettingControlKind {
  if (!entry.writable) return "readonly";
  if (
    entry.control === "switch" ||
    entry.control === "number" ||
    entry.control === "select"
  ) {
    return entry.control;
  }
  return "readonly";
}

// ---------------------------------------------------------------------------
// Icons (§9.1.1: absent/malformed → mdi:tune)
// ---------------------------------------------------------------------------

const MDI_RE = /^mdi:[a-z0-9][a-z0-9-]*$/;

/** The §9.1.1 default icon for absent/malformed hints. */
export const DEFAULT_SETTING_ICON = "mdi:tune";

/** The served icon name when well-formed, else the §9.1.1 mdi:tune default. */
export function settingIconName(entry: SettingDescriptor): string {
  const icon = entry.icon;
  return typeof icon === "string" && MDI_RE.test(icon)
    ? icon
    : DEFAULT_SETTING_ICON;
}

// ---------------------------------------------------------------------------
// Display chains (§9.1.4 / §9.1.6 rule 3)
// ---------------------------------------------------------------------------

/** Legacy bundle keys for the setting labels the pre-contract app renders. */
const LEGACY_LABEL_KEY: Record<string, string> = {
  energy_saving: "settings.energy_saving",
  auto_bean_select: "settings.auto_bean",
  rinsing_disabled: "settings.rinsing",
  water_hardness: "settings.water_hardness",
  auto_off_after: "settings.auto_off",
  brew_temperature: "settings.brew_temp",
};

/** Legacy bundle keys for the setting descriptions (`*_desc` map, §9.1.6 rule 3). */
const LEGACY_DESC_KEY: Record<string, string> = {
  energy_saving: "settings.energy_saving_desc",
  auto_bean_select: "settings.auto_bean_desc",
  rinsing_disabled: "settings.rinsing_desc",
  water_hardness: "settings.water_hardness_desc",
  auto_off_after: "settings.auto_off_desc",
  brew_temperature: "settings.brew_temp_desc",
};

/** Bundle keys for the four known group headers (client-bundle tier). */
const GROUP_BUNDLE_KEY: Record<string, string> = {
  brew: "settings.group_brew",
  water: "settings.group_water",
  power: "settings.group_power",
  system: "settings.group_system",
};

/**
 * Setting display name: server `settings.<setting>.label` → legacy bundle
 * key (the app's pre-contract `settings.*` keys) → humanized token.
 */
export function settingLabel(locale: Locale, setting: string): string {
  const served = serverString(`settings.${setting}.label`);
  if (served !== undefined) return served;
  const bundleKey = LEGACY_LABEL_KEY[setting];
  const bundled = bundleKey ? bundleString(locale, bundleKey) : undefined;
  return bundled ?? humanizeToken(setting);
}

/**
 * Setting description: server `settings.<setting>.description` → legacy
 * `*_desc` bundle key → null (omit the line, §9.1.6 rule 3).
 */
export function settingDescription(
  locale: Locale,
  setting: string,
): string | null {
  const served = serverString(`settings.${setting}.description`);
  if (served !== undefined) return served;
  const bundleKey = LEGACY_DESC_KEY[setting];
  return (bundleKey ? bundleString(locale, bundleKey) : undefined) ?? null;
}

/** Group header: server `settings._groups.<group>` → bundle → humanized. */
export function settingGroupLabel(locale: Locale, group: string): string {
  const served = serverString(`settings._groups.${group}`);
  if (served !== undefined) return served;
  const bundleKey = GROUP_BUNDLE_KEY[group];
  const bundled = bundleKey ? bundleString(locale, bundleKey) : undefined;
  return bundled ?? humanizeToken(group);
}

/**
 * Level/option token label — the §9.1.4 chain: per-setting server key
 * `settings.<setting>.levels.<token>` → shared `settings._levels.<token>` →
 * client bundle (the legacy `level.<token>` keys) → humanized token.
 */
export function settingLevelLabel(
  locale: Locale,
  setting: string,
  token: string,
): string {
  const perSetting = serverString(`settings.${setting}.levels.${token}`);
  if (perSetting !== undefined) return perSetting;
  const shared = serverString(`settings._levels.${token}`);
  if (shared !== undefined) return shared;
  const bundled = bundleString(locale, `level.${token}`);
  return bundled ?? humanizeToken(token);
}

/**
 * Select-option display: tokenized options localize through the level chain;
 * token-less options render the served label verbatim (§9.1.4 — the label
 * mirrors the entity's option string, no key is minted for a missing token).
 */
export function settingOptionLabel(
  locale: Locale,
  setting: string,
  option: { value: number; token: string | null; label: string },
): string {
  if (option.token === null || option.token === undefined) return option.label;
  return settingLevelLabel(locale, setting, option.token);
}

/** The level token matching a numeric value, or null (no invented labels, §9.1.1). */
export function levelTokenForValue(
  entry: SettingDescriptor,
  value: number,
): string | null {
  const match = entry.levels?.find((l) => l.value === value);
  return match ? match.token : null;
}

/**
 * Display string for a number entry's current value: level token label when
 * the value sits on the served ladder, else the raw number with its served
 * unit (`30 min`), else the raw number.
 */
export function formatSettingValue(
  locale: Locale,
  entry: SettingDescriptor,
  value: number,
): string {
  const token = levelTokenForValue(entry, value);
  if (token !== null) return settingLevelLabel(locale, entry.setting, token);
  if (typeof entry.unit === "string" && entry.unit) {
    return `${value} ${entry.unit}`;
  }
  return String(value);
}
