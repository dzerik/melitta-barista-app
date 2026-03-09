import { useState, useCallback, useEffect, useMemo } from "react";
import type { Connection, HassEntities } from "home-assistant-js-websocket";
import { getEntity, getState } from "../lib/entities";
import { toggleSwitch, setNumber, safeCall, getIntegrationVersion } from "../lib/ha";
import { usePreferences } from "../lib/preferences";
import { Check, RotateCcw } from "lucide-react";
import type { TranslationKey } from "../lib/i18n";
import iconBean from "../assets/icons/bean.png";
import iconWater from "../assets/icons/water.png";
import iconTemperature from "../assets/icons/temperature.png";
import iconMaintenance from "../assets/icons/maintenance.png";
import iconSettings from "../assets/icons/settings.png";

function MelittaIcon({ src, alt }: { src: string; alt: string }) {
  return <img src={src} alt={alt} className="w-5 h-5 object-contain" draggable={false} />;
}

interface Props {
  conn: Connection;
  entities: HassEntities;
  prefix: string;
}

interface SwitchDef {
  suffix: string;
  labelKey: TranslationKey;
  descKey: TranslationKey;
  icon: React.ReactNode;
}

const SWITCHES: SwitchDef[] = [
  {
    suffix: "energy_saving",
    labelKey: "settings.energy_saving",
    descKey: "settings.energy_saving_desc",
    icon: <MelittaIcon src={iconSettings} alt="energy" />,
  },
  {
    suffix: "auto_bean_select",
    labelKey: "settings.auto_bean",
    descKey: "settings.auto_bean_desc",
    icon: <MelittaIcon src={iconBean} alt="bean" />,
  },
  {
    suffix: "rinsing_disabled",
    labelKey: "settings.rinsing",
    descKey: "settings.rinsing_desc",
    icon: <MelittaIcon src={iconMaintenance} alt="rinsing" />,
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
  icon: React.ReactNode;
}

const NUMBERS: NumberDef[] = [
  {
    suffix: "water_hardness",
    labelKey: "settings.water_hardness",
    descKey: "settings.water_hardness_desc",
    format: "level",
    icon: <MelittaIcon src={iconWater} alt="water" />,
  },
  {
    suffix: "auto_off_after",
    labelKey: "settings.auto_off",
    descKey: "settings.auto_off_desc",
    format: "minutes",
    icon: <MelittaIcon src={iconSettings} alt="auto-off" />,
  },
  {
    suffix: "brew_temperature",
    labelKey: "settings.brew_temp",
    descKey: "settings.brew_temp_desc",
    format: "level",
    icon: <MelittaIcon src={iconTemperature} alt="temp" />,
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

const stagger = (index: number) => ({ animationDelay: `${index * 60}ms` });

export function SettingsSection({ conn, entities, prefix }: Props) {
  const { t } = usePreferences();
  const backend = useMemo(() => readBackendState(entities, prefix), [entities, prefix]);

  const [integrationVersion, setIntegrationVersion] = useState<string | null>(null);
  useEffect(() => {
    getIntegrationVersion(conn).then(setIntegrationVersion);
  }, [conn]);

  const [localSwitches, setLocalSwitches] = useState(backend.switches);
  const [localNumbers, setLocalNumbers] = useState(backend.numbers);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!dirty) {
      setLocalSwitches(backend.switches);
      setLocalNumbers(backend.numbers);
    }
  }, [backend, dirty]);

  const toggleLocal = useCallback((suffix: string) => {
    setLocalSwitches((prev) => ({ ...prev, [suffix]: !prev[suffix] }));
    setDirty(true);
  }, []);

  const setLocalNumber = useCallback((suffix: string, value: number) => {
    setLocalNumbers((prev) => ({ ...prev, [suffix]: value }));
    setDirty(true);
  }, []);

  const hasChanges = useMemo(() => {
    for (const s of SWITCHES) {
      if (localSwitches[s.suffix] !== backend.switches[s.suffix]) return true;
    }
    for (const n of NUMBERS) {
      if (localNumbers[n.suffix] !== backend.numbers[n.suffix]) return true;
    }
    return false;
  }, [localSwitches, localNumbers, backend]);

  const handleApply = useCallback(() => {
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
  }, [conn, prefix, localSwitches, localNumbers, backend]);

  const handleReset = useCallback(() => {
    setLocalSwitches(backend.switches);
    setLocalNumbers(backend.numbers);
    setDirty(false);
  }, [backend]);

  function formatValue(suffix: string, value: number, format: "level" | "minutes"): string {
    if (format === "level") {
      const key = LEVEL_LABELS[suffix]?.[value];
      return key ? t(key) : String(value);
    }
    return `${value} min`;
  }

  let cardIndex = 0;

  return (
    <div className="flex h-full flex-col px-5 py-5 overflow-y-auto max-w-2xl mx-auto w-full">
      <div
        className="settings-header-enter text-[10px] font-medium text-tertiary uppercase tracking-[0.2em] mb-3"
      >
        {t("settings.toggles")}
      </div>
      <div className="space-y-2 mb-6">
        {SWITCHES.map(({ suffix, labelKey, descKey, icon }) => {
          const exists = getEntity(entities, prefix, "switch", suffix);
          if (!exists) return null;
          const isOn = localSwitches[suffix] ?? false;
          const changed = isOn !== backend.switches[suffix];
          const idx = cardIndex++;
          return (
            <div
              key={suffix}
              className="settings-card-enter flex items-center gap-3 rounded-2xl p-4 transition-all duration-200 ring-1"
              style={{
                ...stagger(idx),
                background: changed ? "var(--surface-card-active)" : "var(--surface-card)",
                "--tw-ring-color": changed ? "var(--border-active)" : "var(--border)",
              } as React.CSSProperties}
            >
              <div
                className="flex items-center justify-center w-9 h-9 rounded-xl shrink-0 transition-colors duration-200"
                style={{
                  background: isOn ? "var(--accent-muted)" : "var(--surface-card)",
                  color: isOn ? "var(--accent)" : "var(--text-tertiary)",
                }}
              >
                {icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-primary">{t(labelKey)}</div>
                <div className="text-[11px] text-tertiary leading-tight mt-0.5">{t(descKey)}</div>
              </div>
              <button
                onClick={() => toggleLocal(suffix)}
                className="relative h-7 w-12 rounded-full transition-colors duration-200 shrink-0"
                style={{ background: isOn ? "var(--toggle-on-bg)" : "var(--toggle-off-bg)" }}
              >
                <span
                  className="absolute top-0.5 left-0.5 h-6 w-6 rounded-full shadow-md transition-transform duration-200"
                  style={{
                    transform: isOn ? "translateX(1.25rem)" : "translateX(0)",
                    background: isOn ? "var(--toggle-on-knob)" : "var(--toggle-off-knob)",
                  }}
                />
              </button>
            </div>
          );
        })}
      </div>

      <div
        className="settings-header-enter text-[10px] font-medium text-tertiary uppercase tracking-[0.2em] mb-3"
        style={stagger(cardIndex)}
      >
        {t("settings.adjustments")}
      </div>
      <div className="space-y-2">
        {NUMBERS.map(({ suffix, labelKey, descKey, format, icon }) => {
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
              className="settings-card-enter rounded-2xl p-4 space-y-3 transition-all duration-200 ring-1"
              style={{
                ...stagger(idx),
                background: changed ? "var(--surface-card-active)" : "var(--surface-card)",
                "--tw-ring-color": changed ? "var(--border-active)" : "var(--border)",
              } as React.CSSProperties}
            >
              <div className="flex items-start gap-3">
                <div
                  className="flex items-center justify-center w-9 h-9 rounded-xl shrink-0"
                  style={{ background: "var(--surface-card)", color: "var(--text-secondary)" }}
                >
                  {icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-primary">{t(labelKey)}</div>
                  <div className="text-[11px] text-tertiary leading-tight mt-0.5">{t(descKey)}</div>
                </div>
                <span className="text-sm font-semibold text-primary tabular-nums whitespace-nowrap">
                  {displayValue}
                </span>
              </div>
              <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => setLocalNumber(suffix, parseFloat(e.target.value))}
                className="w-full h-1.5 appearance-none rounded-full cursor-pointer
                  [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                  [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-lg"
                style={{
                  background: "var(--slider-track)",
                  accentColor: "var(--slider-thumb)",
                }}
              />
            </div>
          );
        })}
      </div>

      {hasChanges && (
        <div className="settings-bar-enter sticky bottom-0 mt-4 flex gap-2">
          <button
            onClick={handleReset}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium transition active:scale-[0.97]"
            style={{ background: "var(--btn-secondary-bg)", color: "var(--btn-secondary-text)" }}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            {t("settings.reset")}
          </button>
          <button
            onClick={handleApply}
            className="flex-[2] flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition active:scale-[0.97]"
            style={{ background: "var(--btn-primary-bg)", color: "var(--btn-primary-text)" }}
          >
            <Check className="w-4 h-4" />
            {t("settings.apply")}
          </button>
        </div>
      )}

      <div className="mt-auto pt-6 pb-2 text-center text-[10px] text-tertiary opacity-50">
        {integrationVersion
          ? `Melitta Barista HA v${integrationVersion}`
          : "Melitta Barista"}
      </div>
    </div>
  );
}
