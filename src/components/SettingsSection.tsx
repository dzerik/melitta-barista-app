import { useState, useCallback, useEffect, useMemo } from "react";
import type { Connection, HassEntities } from "home-assistant-js-websocket";
import { getEntity, getState } from "../lib/entities";
import {
  toggleSwitch,
  setNumber,
  selectOption,
  safeCall,
  getIntegrationVersion,
} from "../lib/ha";
import { usePreferences } from "../lib/preferences";
import { RotateCcw } from "lucide-react";
import type { TranslationKey } from "../lib/i18n";
import type { UiContract, SettingDescriptor } from "../lib/contract";
import {
  resolveSettingsCatalog,
  settingsGroups,
  settingEntityId,
  settingControlKind,
  settingIconName,
  settingLabel,
  settingDescription,
  settingGroupLabel,
  settingLevelLabel,
  settingOptionLabel,
  formatSettingValue,
  numberBounds,
} from "../lib/settings";
import { resolveMdiIcon } from "../lib/icons";
import { Option } from "./ui/Option";
import { OptionRow } from "./ui/OptionRow";
import { MeterField } from "./ui/Meter";
import { Commit } from "./ui/Commit";
import { Rule } from "./ui/Rule";
import iconBean from "../assets/icons/bean.png";
import iconWater from "../assets/icons/water.png";
import iconTemperature from "../assets/icons/temperature.png";
import iconMaintenance from "../assets/icons/maintenance.png";
import iconSettings from "../assets/icons/settings.png";

/**
 * A raster brand glyph, bare on the ground. §6.6: non-drink raster icons keep
 * a fixed square size and carry their state as an opacity knock-down — there
 * is no 36×36 plate behind them any more.
 */
function MelittaIcon({ src, alt, lit = false }: { src: string; alt: string; lit?: boolean }) {
  return (
    <img
      src={src}
      alt={alt}
      className="w-5 h-5 object-contain shrink-0"
      style={{ opacity: lit ? 1 : 0.45 }}
      draggable={false}
    />
  );
}

interface Props {
  conn: Connection;
  entities: HassEntities;
  prefix: string;
  /** UI Contract document (P-I wiring); null/omitted → legacy tables. */
  contract?: UiContract | null;
}

interface SwitchDef {
  suffix: string;
  labelKey: TranslationKey;
  descKey: TranslationKey;
  iconSrc: string;
  iconAlt: string;
}

/**
 * Legacy hardcoded switch table — the permanent tier-2 fallback (§9.1.6
 * rule 1) rendered whenever the contract serves no settings block.
 */
const SWITCHES: SwitchDef[] = [
  {
    suffix: "energy_saving",
    labelKey: "settings.energy_saving",
    descKey: "settings.energy_saving_desc",
    iconSrc: iconSettings,
    iconAlt: "energy",
  },
  {
    suffix: "auto_bean_select",
    labelKey: "settings.auto_bean",
    descKey: "settings.auto_bean_desc",
    iconSrc: iconBean,
    iconAlt: "bean",
  },
  {
    suffix: "rinsing_disabled",
    labelKey: "settings.rinsing",
    descKey: "settings.rinsing_desc",
    iconSrc: iconMaintenance,
    iconAlt: "rinsing",
  },
];

const LEVEL_LABELS: Record<string, Record<number, TranslationKey>> = {
  water_hardness: { 1: "level.soft", 2: "level.medium", 3: "level.hard", 4: "level.very_hard" },
  brew_temperature: { 0: "level.low", 1: "level.normal", 2: "level.high" },
};

interface NumberDef {
  suffix: string;
  labelKey: TranslationKey;
  descKey: TranslationKey;
  format: "level" | "minutes";
  iconSrc: string;
  iconAlt: string;
}

/** Legacy hardcoded number table — the permanent tier-2 fallback (§9.1.6). */
const NUMBERS: NumberDef[] = [
  {
    suffix: "water_hardness",
    labelKey: "settings.water_hardness",
    descKey: "settings.water_hardness_desc",
    format: "level",
    iconSrc: iconWater,
    iconAlt: "water",
  },
  {
    suffix: "auto_off_after",
    labelKey: "settings.auto_off",
    descKey: "settings.auto_off_desc",
    format: "minutes",
    iconSrc: iconSettings,
    iconAlt: "auto-off",
  },
  {
    suffix: "brew_temperature",
    labelKey: "settings.brew_temp",
    descKey: "settings.brew_temp_desc",
    format: "level",
    iconSrc: iconTemperature,
    iconAlt: "temp",
  },
];

function readBackendState(entities: HassEntities, prefix: string) {
  const switches: Record<string, boolean> = {};
  for (const s of SWITCHES) {
    const e = getEntity(entities, prefix, "switch", s.suffix);
    if (e) switches[s.suffix] = e.state === "on";
  }
  const numbers: Record<string, number> = {};
  for (const n of NUMBERS) {
    const raw = getState(entities, prefix, "number", n.suffix);
    if (raw !== undefined) numbers[n.suffix] = parseFloat(raw || "0");
  }
  return { switches, numbers };
}

/** Current backend value per catalog entry (keyed by setting token). */
type CatalogValues = Record<string, boolean | number | string>;

/**
 * Read the bound entity value for every renderable catalog entry. Entries
 * whose entity has no state object are skipped — the §9.1.6 rule-2 gate is
 * applied again at render time.
 */
function readCatalogBackend(
  entities: HassEntities,
  prefix: string,
  catalog: SettingDescriptor[],
): CatalogValues {
  const out: CatalogValues = {};
  for (const entry of catalog) {
    const entity = entities[settingEntityId(prefix, entry)];
    if (!entity) continue;
    // Keyed off the served control (not the render kind) so read-only rows —
    // writable:false — still read a display-typed value for their control.
    switch (entry.control) {
      case "switch":
        out[entry.setting] = entity.state === "on";
        break;
      case "number":
        out[entry.setting] = parseFloat(entity.state || "0");
        break;
      default:
        // select rows edit the option label string; unknown kinds display it.
        out[entry.setting] = entity.state;
        break;
    }
  }
  return out;
}

const stagger = (index: number) => ({ animationDelay: `${index * 60}ms` });

/**
 * Above this many choices a row keeps a native `<select>` (a bare underline,
 * no fill and no radius); at or below it the choices are drawn as words
 * (§C1, and the §13 field-research cap of five on a segmented single-choice
 * row). Every Nivona family served today sits under the cap.
 */
const WORD_ROW_OPTION_CAP = 5;

/**
 * §G2.7 row pitch. A setting is one 80px row — label left, control right,
 * separated from the next by a single hairline. No card, no zebra, no group
 * box: the two-axis `--surface-card` / `--surface-card-active` fill-plus-ring
 * state model is gone, and "changed" now lives in the VALUE's colour (§10).
 */
const ROW_MIN_H = "80px";

/** Content hangs 10px inside the rail-to-rail rule (§G2.1). */
const ROW_INSET = "10px";

function rowStyle(index: number): React.CSSProperties {
  return {
    ...stagger(index),
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: "var(--border)",
    borderRadius: 0,
    minHeight: ROW_MIN_H,
    paddingLeft: ROW_INSET,
    paddingRight: ROW_INSET,
  };
}

/**
 * A bare 20px lucide glyph. §C3: `--accent` when the setting is on,
 * `--text-tertiary` when it is not — and no plate behind it either way.
 */
function settingGlyph(icon: string, tone: string) {
  const Icon = resolveMdiIcon(icon);
  return (
    <span
      aria-hidden="true"
      className="shrink-0 inline-flex items-center"
      style={{ color: tone }}
    >
      <Icon size={20} strokeWidth={1.75} />
    </span>
  );
}

/**
 * Segment count for a bounded number: one segment per served step, capped at
 * the §C-Numeric continuous default of 12 so a 15-step ladder does not shred
 * into hairlines.
 */
function meterSegments(min: number, max: number, step: number): number {
  if (!(max > min) || !(step > 0)) return 12;
  const steps = Math.round((max - min) / step);
  if (!Number.isFinite(steps) || steps < 1) return 12;
  return Math.max(2, Math.min(12, steps));
}

export function SettingsSection({ conn, entities, prefix, contract = null }: Props) {
  const { t, locale } = usePreferences();

  const catalog = useMemo(() => resolveSettingsCatalog(contract), [contract]);

  const backend = useMemo(() => readBackendState(entities, prefix), [entities, prefix]);
  const catalogBackend = useMemo(
    () => (catalog === null ? {} : readCatalogBackend(entities, prefix, catalog)),
    [entities, prefix, catalog],
  );

  const [integrationVersion, setIntegrationVersion] = useState<string | null>(null);
  useEffect(() => {
    getIntegrationVersion(conn).then(setIntegrationVersion);
  }, [conn]);

  const [localSwitches, setLocalSwitches] = useState(backend.switches);
  const [localNumbers, setLocalNumbers] = useState(backend.numbers);
  const [localCatalog, setLocalCatalog] = useState<CatalogValues>(catalogBackend);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!dirty) {
      setLocalSwitches(backend.switches);
      setLocalNumbers(backend.numbers);
      setLocalCatalog(catalogBackend);
    }
  }, [backend, catalogBackend, dirty]);

  const setLocalSwitch = useCallback((suffix: string, value: boolean) => {
    setLocalSwitches((prev) => ({ ...prev, [suffix]: value }));
    setDirty(true);
  }, []);

  const setLocalNumber = useCallback((suffix: string, value: number) => {
    setLocalNumbers((prev) => ({ ...prev, [suffix]: value }));
    setDirty(true);
  }, []);

  const setLocalCatalogValue = useCallback(
    (setting: string, value: boolean | number | string) => {
      setLocalCatalog((prev) => ({ ...prev, [setting]: value }));
      setDirty(true);
    },
    [],
  );

  const hasChanges = useMemo(() => {
    if (catalog !== null) {
      return catalog.some(
        (entry) =>
          entry.setting in catalogBackend &&
          localCatalog[entry.setting] !== catalogBackend[entry.setting],
      );
    }
    for (const s of SWITCHES) {
      if (localSwitches[s.suffix] !== backend.switches[s.suffix]) return true;
    }
    for (const n of NUMBERS) {
      if (localNumbers[n.suffix] !== backend.numbers[n.suffix]) return true;
    }
    return false;
  }, [catalog, localCatalog, catalogBackend, localSwitches, localNumbers, backend]);

  const handleApply = useCallback(() => {
    if (catalog !== null) {
      // Writes go through the bound entity exactly as today (§9.1.6 rule 4);
      // the server re-validates regardless.
      for (const entry of catalog) {
        if (!(entry.setting in catalogBackend)) continue;
        const local = localCatalog[entry.setting];
        if (local === catalogBackend[entry.setting]) continue;
        const entityId = settingEntityId(prefix, entry);
        switch (settingControlKind(entry)) {
          case "switch":
            safeCall(() => toggleSwitch(conn, entityId, local === true));
            break;
          case "number":
            if (typeof local === "number") {
              safeCall(() => setNumber(conn, entityId, local));
            }
            break;
          case "select":
            if (typeof local === "string") {
              safeCall(() => selectOption(conn, entityId, local));
            }
            break;
          default:
            break; // readonly rows never write
        }
      }
      setDirty(false);
      return;
    }
    for (const s of SWITCHES) {
      if (localSwitches[s.suffix] !== backend.switches[s.suffix]) {
        safeCall(() => toggleSwitch(conn, `switch.${prefix}_${s.suffix}`, localSwitches[s.suffix]));
      }
    }
    for (const n of NUMBERS) {
      if (localNumbers[n.suffix] !== backend.numbers[n.suffix]) {
        safeCall(() => setNumber(conn, `number.${prefix}_${n.suffix}`, localNumbers[n.suffix]));
      }
    }
    setDirty(false);
  }, [conn, prefix, catalog, localCatalog, catalogBackend, localSwitches, localNumbers, backend]);

  const handleReset = useCallback(() => {
    setLocalSwitches(backend.switches);
    setLocalNumbers(backend.numbers);
    setLocalCatalog(catalogBackend);
    setDirty(false);
  }, [backend, catalogBackend]);

  function formatValue(suffix: string, value: number, format: "level" | "minutes"): string {
    if (format === "level") {
      const key = LEVEL_LABELS[suffix]?.[value];
      return key ? t(key) : String(value);
    }
    return `${value} min`;
  }

  /**
   * A boolean is two words, not a switch — there is no switch in this
   * language (§C3). The chosen word is white with a lit 1px `--accent`
   * underline; the other keeps a transparent underline so nothing shifts.
   * While the row is unsaved the chosen word takes `--accent` ink, which is
   * the §10 dirty rule applied to the value (the same signal MeterField
   * gives a changed number) and the only thing left of the old fill+ring.
   */
  const booleanRow = (
    name: string,
    setting: string,
    isOn: boolean,
    changed: boolean,
    onPick: (next: boolean) => void,
  ) => {
    const dirtyInk = changed ? { color: "var(--accent)" } : undefined;
    return (
      <OptionRow rule={false} role="radiogroup" ariaLabel={name} className="shrink-0">
        <Option
          label={settingLevelLabel(locale, setting, "on")}
          selected={isOn}
          role="radio"
          onSelect={() => onPick(true)}
          style={isOn ? dirtyInk : undefined}
        />
        <Option
          label={settingLevelLabel(locale, setting, "off")}
          selected={!isOn}
          role="radio"
          onSelect={() => onPick(false)}
          style={isOn ? undefined : dirtyInk}
        />
      </OptionRow>
    );
  };

  const rowHeading = (label: string, description: string | null) => (
    <div className="flex-1 min-w-0">
      <div className="t-body font-medium text-primary">{label}</div>
      {description !== null && description !== undefined && (
        <div className="t-label text-tertiary leading-tight mt-0.5">{description}</div>
      )}
    </div>
  );

  // -------------------------------------------------------------------------
  // Catalog rows (tier 1 — §9.1.6)
  // -------------------------------------------------------------------------

  const renderCatalogSwitch = (entry: SettingDescriptor, idx: number) => {
    const isOn = localCatalog[entry.setting] === true;
    const changed = isOn !== catalogBackend[entry.setting];
    const label = settingLabel(locale, entry.setting);
    return (
      <div
        key={entry.setting}
        className="settings-card-enter flex items-center gap-3 py-3"
        style={rowStyle(idx)}
      >
        {settingGlyph(
          settingIconName(entry),
          isOn ? "var(--accent)" : "var(--text-tertiary)",
        )}
        {rowHeading(label, settingDescription(locale, entry.setting))}
        {booleanRow(label, entry.setting, isOn, changed, (next) =>
          setLocalCatalogValue(entry.setting, next),
        )}
      </div>
    );
  };

  const renderCatalogNumber = (entry: SettingDescriptor, idx: number) => {
    const entity = entities[settingEntityId(prefix, entry)];
    const { min, max, step } = numberBounds(entry, entity);
    const raw = localCatalog[entry.setting];
    const value = typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
    const changed = value !== catalogBackend[entry.setting];
    const label = settingLabel(locale, entry.setting);
    const display = formatSettingValue(locale, entry, value);
    const description = settingDescription(locale, entry.setting);
    const box = entry.display === "box";
    return (
      <div
        key={entry.setting}
        className="settings-card-enter flex items-start gap-3 py-3"
        style={rowStyle(idx)}
      >
        <span className="mt-0.5 flex">
          {settingGlyph(settingIconName(entry), "var(--text-tertiary)")}
        </span>
        <div className="flex-1 min-w-0 space-y-1.5">
          {box ? (
            <>
              <div className="flex items-baseline justify-between">
                <span className="t-label text-primary">{label}</span>
                <span
                  className="t-label num"
                  style={{
                    fontWeight: 600,
                    color: changed ? "var(--accent)" : "var(--text-primary)",
                  }}
                >
                  {display}
                </span>
              </div>
              <input
                type="number"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => setLocalCatalogValue(entry.setting, parseFloat(e.target.value))}
                aria-label={label}
                className="w-full bg-transparent px-0 outline-none t-body num"
                style={{
                  color: "var(--text-primary)",
                  borderRadius: 0,
                  borderBottomWidth: "1px",
                  borderBottomStyle: "solid",
                  borderBottomColor: "var(--border)",
                  height: "var(--tap)",
                }}
              />
            </>
          ) : (
            <MeterField
              style={{ "--meter-max": "18rem" } as React.CSSProperties}
              label={label}
              value={value}
              min={min}
              max={max}
              step={step}
              segments={meterSegments(min, max, step)}
              displayValue={display}
              changed={changed}
              onChange={(next) => setLocalCatalogValue(entry.setting, next)}
            />
          )}
          {description !== null && (
            <div className="t-label text-tertiary leading-tight">{description}</div>
          )}
        </div>
      </div>
    );
  };

  const renderCatalogSelect = (entry: SettingDescriptor, idx: number) => {
    const raw = localCatalog[entry.setting];
    const value = typeof raw === "string" ? raw : "";
    const changed = value !== catalogBackend[entry.setting];
    const label = settingLabel(locale, entry.setting);
    const options = entry.options ?? [];
    // Writes use the served label string (§9.1.6 rule 4) — it mirrors the
    // entity's current options by construction (§9.1.1).
    const orphan = value !== "" && !options.some((o) => o.label === value);
    const asWords = options.length + (orphan ? 1 : 0) <= WORD_ROW_OPTION_CAP;
    const dirtyInk = changed ? { color: "var(--accent)" } : undefined;
    return (
      <div
        key={entry.setting}
        className="settings-card-enter flex items-center gap-3 py-3"
        style={rowStyle(idx)}
      >
        {settingGlyph(settingIconName(entry), "var(--text-tertiary)")}
        {rowHeading(label, settingDescription(locale, entry.setting))}
        {asWords ? (
          <OptionRow rule={false} role="radiogroup" ariaLabel={label} className="shrink-0">
            {options.map((o) => (
              <Option
                key={o.value}
                label={settingOptionLabel(locale, entry.setting, o)}
                selected={value === o.label}
                role="radio"
                onSelect={() => setLocalCatalogValue(entry.setting, o.label)}
                style={value === o.label ? dirtyInk : undefined}
              />
            ))}
            {orphan && (
              <Option label={value} selected role="radio" onSelect={() => {}} style={dirtyInk} />
            )}
          </OptionRow>
        ) : (
          <select
            value={value}
            onChange={(e) => setLocalCatalogValue(entry.setting, e.target.value)}
            aria-label={label}
            className="shrink-0 bg-transparent px-0 outline-none t-body max-w-[45%]"
            style={{
              color: changed ? "var(--accent)" : "var(--text-primary)",
              borderRadius: 0,
              borderBottomWidth: "1px",
              borderBottomStyle: "solid",
              borderBottomColor: "var(--border)",
              minHeight: "var(--tap)",
            }}
          >
            {options.map((o) => (
              <option key={o.value} value={o.label}>
                {settingOptionLabel(locale, entry.setting, o)}
              </option>
            ))}
            {orphan && <option value={value}>{value}</option>}
          </select>
        )}
      </div>
    );
  };

  const renderCatalogReadonly = (entry: SettingDescriptor, idx: number) => {
    const raw = localCatalog[entry.setting];
    let display: string;
    if (typeof raw === "number") {
      display = formatSettingValue(locale, entry, raw);
    } else if (typeof raw === "boolean") {
      // on/off localize via the shared `settings._levels` tier (§9.1.4).
      display = settingLevelLabel(locale, entry.setting, raw ? "on" : "off");
    } else {
      const opt = entry.options?.find((o) => o.label === raw);
      display = opt ? settingOptionLabel(locale, entry.setting, opt) : String(raw ?? "");
    }
    return (
      <div
        key={entry.setting}
        className="settings-card-enter flex items-center gap-3 py-3"
        style={rowStyle(idx)}
      >
        {settingGlyph(settingIconName(entry), "var(--text-tertiary)")}
        {rowHeading(settingLabel(locale, entry.setting), settingDescription(locale, entry.setting))}
        <span className="t-label num text-secondary whitespace-nowrap" style={{ fontWeight: 600 }}>
          {display}
        </span>
      </div>
    );
  };

  const renderCatalogEntry = (entry: SettingDescriptor, idx: number) => {
    switch (settingControlKind(entry)) {
      case "switch":
        return renderCatalogSwitch(entry, idx);
      case "number":
        return renderCatalogNumber(entry, idx);
      case "select":
        return renderCatalogSelect(entry, idx);
      default:
        return renderCatalogReadonly(entry, idx);
    }
  };

  // Entity absence gates rendering (§9.1.6 rule 2): an entry whose bound
  // entity has no state object is hidden — never a live control.
  const catalogGroupsView =
    catalog === null
      ? null
      : settingsGroups(
          catalog.filter((entry) => entities[settingEntityId(prefix, entry)]),
        );

  let cardIndex = 0;

  return (
    <div
      className="flex h-full flex-col"
      style={{ paddingLeft: "var(--rail)", paddingRight: "var(--rail)" }}
    >
      <div className="flex-1 min-h-0 flex flex-col overflow-y-auto custom-scroll py-5">
        {catalogGroupsView !== null ? (
          catalogGroupsView.map(({ group, entries: groupEntries }) => {
            const headerIdx = cardIndex++;
            return (
              <div key={group} className="mb-6">
                <div
                  className="settings-header-enter t-label font-medium text-tertiary mb-2"
                  style={{ ...stagger(headerIdx), paddingLeft: ROW_INSET }}
                >
                  {settingGroupLabel(locale, group)}
                </div>
                {groupEntries.map((entry) => renderCatalogEntry(entry, cardIndex++))}
              </div>
            );
          })
        ) : (
          <>
            <div className="mb-6">
              <div
                className="settings-header-enter t-label font-medium text-tertiary mb-2"
                style={{ paddingLeft: ROW_INSET }}
              >
                {t("settings.toggles")}
              </div>
              {SWITCHES.map(({ suffix, labelKey, descKey, iconSrc, iconAlt }) => {
                const exists = getEntity(entities, prefix, "switch", suffix);
                if (!exists) return null;
                const isOn = localSwitches[suffix] ?? false;
                const changed = isOn !== backend.switches[suffix];
                const label = t(labelKey);
                const idx = cardIndex++;
                return (
                  <div
                    key={suffix}
                    className="settings-card-enter flex items-center gap-3 py-3"
                    style={rowStyle(idx)}
                  >
                    <MelittaIcon src={iconSrc} alt={iconAlt} lit={isOn} />
                    {rowHeading(label, t(descKey))}
                    {booleanRow(label, suffix, isOn, changed, (next) =>
                      setLocalSwitch(suffix, next),
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mb-6">
              <div
                className="settings-header-enter t-label font-medium text-tertiary mb-2"
                style={{ ...stagger(cardIndex), paddingLeft: ROW_INSET }}
              >
                {t("settings.adjustments")}
              </div>
              {NUMBERS.map(({ suffix, labelKey, descKey, format, iconSrc, iconAlt }) => {
                const entity = getEntity(entities, prefix, "number", suffix);
                if (!entity) return null;
                const min = entity.attributes?.min ?? 0;
                const max = entity.attributes?.max ?? 100;
                const step = entity.attributes?.step ?? 1;
                const value = localNumbers[suffix] ?? 0;
                const changed = value !== backend.numbers[suffix];
                const displayValue = formatValue(suffix, value, format);
                const idx = cardIndex++;

                return (
                  <div
                    key={suffix}
                    className="settings-card-enter flex items-start gap-3 py-3"
                    style={rowStyle(idx)}
                  >
                    <span className="mt-0.5 flex">
                      <MelittaIcon src={iconSrc} alt={iconAlt} />
                    </span>
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <MeterField
                        label={t(labelKey)}
                        value={value}
                        min={min}
                        max={max}
                        step={step}
                        segments={meterSegments(min, max, step)}
                        displayValue={displayValue}
                        changed={changed}
                        onChange={(next) => setLocalNumber(suffix, next)}
                      />
                      <div className="t-label text-tertiary leading-tight">{t(descKey)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <div className="mt-auto pt-6 pb-2 text-center t-label text-tertiary opacity-50">
          {integrationVersion
            ? `Melitta Barista HA v${integrationVersion}`
            : "Melitta Barista"}
        </div>
      </div>

      {hasChanges && (
        <div className="settings-bar-enter shrink-0 flex flex-col pb-4">
          {/* §8.3: the one 2px accent rule in the app opens the action band. */}
          <Rule weight={2} tone="accent" />
          <div className="flex justify-end" style={{ paddingRight: ROW_INSET }}>
            <button
              onClick={handleReset}
              className="tap press t-body gap-2"
              style={{
                color: "var(--text-secondary)",
                borderRadius: 0,
                borderBottomWidth: "1px",
                borderBottomStyle: "solid",
                borderBottomColor: "var(--border)",
              }}
            >
              <RotateCcw size={16} strokeWidth={1.75} aria-hidden="true" />
              {t("settings.reset")}
            </button>
          </div>
          {/* The screen's one commit rectangle, width locked to the column. */}
          <Commit label={t("settings.apply")} onCommit={handleApply} />
        </div>
      )}
    </div>
  );
}
