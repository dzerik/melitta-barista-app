import { useState, useCallback, useEffect, useMemo } from "react";
import type { Connection, HassEntities } from "home-assistant-js-websocket";
import { getEntity, getState } from "../lib/entities";
import { toggleSwitch, setNumber, safeCall } from "../lib/ha";
import { Zap, Bean, Droplets, Clock, Thermometer, ShieldOff, Check, RotateCcw } from "lucide-react";

interface Props {
  conn: Connection;
  entities: HassEntities;
  prefix: string;
}

interface SwitchDef {
  suffix: string;
  label: string;
  desc: string;
  icon: React.ReactNode;
}

const SWITCHES: SwitchDef[] = [
  {
    suffix: "energy_saving",
    label: "Energy Saving",
    desc: "Reduce power consumption when idle",
    icon: <Zap className="w-5 h-5" />,
  },
  {
    suffix: "auto_bean_select",
    label: "Auto Bean Select",
    desc: "Automatically choose bean hopper",
    icon: <Bean className="w-5 h-5" />,
  },
  {
    suffix: "rinsing_disabled",
    label: "Rinsing Disabled",
    desc: "Skip automatic rinsing cycle",
    icon: <ShieldOff className="w-5 h-5" />,
  },
];

const LEVEL_LABELS: Record<string, Record<number, string>> = {
  water_hardness: { 1: "Soft", 2: "Medium", 3: "Hard", 4: "Very Hard" },
  brew_temperature: { 0: "Low", 1: "Normal", 2: "High" },
};

interface NumberDef {
  suffix: string;
  label: string;
  desc: string;
  format: "level" | "minutes";
  icon: React.ReactNode;
}

const NUMBERS: NumberDef[] = [
  {
    suffix: "water_hardness",
    label: "Water Hardness",
    desc: "Calibrate for your water type",
    format: "level",
    icon: <Droplets className="w-5 h-5" />,
  },
  {
    suffix: "auto_off_after",
    label: "Auto Off",
    desc: "Minutes until automatic shutdown",
    format: "minutes",
    icon: <Clock className="w-5 h-5" />,
  },
  {
    suffix: "brew_temperature",
    label: "Brew Temperature",
    desc: "Brewing water temperature",
    format: "level",
    icon: <Thermometer className="w-5 h-5" />,
  },
];

const SLIDER_CLASS =
  "w-full h-1.5 appearance-none bg-neutral-800 rounded-full accent-white cursor-pointer " +
  "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 " +
  "[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-lg";

function formatValue(suffix: string, value: number, format: "level" | "minutes"): string {
  if (format === "level") {
    return LEVEL_LABELS[suffix]?.[value] ?? String(value);
  }
  return `${value} min`;
}

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

/** Stagger delay for card entrance animations. */
const stagger = (index: number) => ({ animationDelay: `${index * 60}ms` });

export function SettingsSection({ conn, entities, prefix }: Props) {
  const backend = useMemo(() => readBackendState(entities, prefix), [entities, prefix]);

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
        safeCall(() =>
          toggleSwitch(conn, `switch.${prefix}_${s.suffix}`, localSwitches[s.suffix]),
        );
      }
    }
    for (const n of NUMBERS) {
      if (localNumbers[n.suffix] !== backend.numbers[n.suffix]) {
        safeCall(() =>
          setNumber(conn, `number.${prefix}_${n.suffix}`, localNumbers[n.suffix]),
        );
      }
    }
    setDirty(false);
  }, [conn, prefix, localSwitches, localNumbers, backend]);

  const handleReset = useCallback(() => {
    setLocalSwitches(backend.switches);
    setLocalNumbers(backend.numbers);
    setDirty(false);
  }, [backend]);

  let cardIndex = 0;

  return (
    <div className="flex h-full flex-col px-5 py-5 overflow-y-auto">
      {/* Toggles header */}
      <div
        className="settings-header-enter text-[10px] font-medium text-neutral-600 uppercase tracking-[0.2em] mb-3"
      >
        Toggles
      </div>
      <div className="space-y-2 mb-6">
        {SWITCHES.map(({ suffix, label, desc, icon }) => {
          const exists = getEntity(entities, prefix, "switch", suffix);
          if (!exists) return null;
          const isOn = localSwitches[suffix] ?? false;
          const changed = isOn !== backend.switches[suffix];
          const idx = cardIndex++;
          return (
            <div
              key={suffix}
              className={`settings-card-enter flex items-center gap-3 rounded-2xl p-4 transition-all duration-200 ${
                changed
                  ? "bg-white/[0.06] ring-1 ring-white/[0.15]"
                  : "bg-white/[0.03] ring-1 ring-white/[0.06]"
              }`}
              style={stagger(idx)}
            >
              <div
                className={`flex items-center justify-center w-9 h-9 rounded-xl shrink-0 transition-colors duration-200 ${
                  isOn
                    ? "bg-white/[0.12] text-white"
                    : "bg-white/[0.06] text-neutral-500"
                }`}
              >
                {icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white">{label}</div>
                <div className="text-[11px] text-neutral-600 leading-tight mt-0.5">
                  {desc}
                </div>
              </div>
              <button
                onClick={() => toggleLocal(suffix)}
                className={`relative h-7 w-12 rounded-full transition-colors duration-200 shrink-0 ${
                  isOn ? "bg-white" : "bg-neutral-700"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full shadow-md transition-transform duration-200 ${
                    isOn
                      ? "translate-x-5 bg-black"
                      : "translate-x-0 bg-neutral-400"
                  }`}
                />
              </button>
            </div>
          );
        })}
      </div>

      {/* Adjustments header */}
      <div
        className="settings-header-enter text-[10px] font-medium text-neutral-600 uppercase tracking-[0.2em] mb-3"
        style={stagger(cardIndex)}
      >
        Adjustments
      </div>
      <div className="space-y-2">
        {NUMBERS.map(({ suffix, label, desc, format, icon }) => {
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
              className={`settings-card-enter rounded-2xl p-4 space-y-3 transition-all duration-200 ${
                changed
                  ? "bg-white/[0.06] ring-1 ring-white/[0.15]"
                  : "bg-white/[0.03] ring-1 ring-white/[0.06]"
              }`}
              style={stagger(idx)}
            >
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/[0.06] text-neutral-400 shrink-0">
                  {icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white">{label}</div>
                  <div className="text-[11px] text-neutral-600 leading-tight mt-0.5">
                    {desc}
                  </div>
                </div>
                <span className="text-sm font-semibold text-white tabular-nums whitespace-nowrap">
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
                className={SLIDER_CLASS}
              />
            </div>
          );
        })}
      </div>

      {/* Apply / Reset bar — slides up */}
      {hasChanges && (
        <div className="settings-bar-enter sticky bottom-0 mt-4 flex gap-2">
          <button
            onClick={handleReset}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-neutral-800 py-3 text-sm font-medium text-neutral-300 transition hover:bg-neutral-700 active:scale-[0.97]"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
          <button
            onClick={handleApply}
            className="flex-[2] flex items-center justify-center gap-2 rounded-xl bg-white py-3 text-sm font-semibold text-black transition hover:bg-neutral-200 active:scale-[0.97]"
          >
            <Check className="w-4 h-4" />
            Apply Changes
          </button>
        </div>
      )}
    </div>
  );
}
