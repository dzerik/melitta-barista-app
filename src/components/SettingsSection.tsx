import { useState } from "react";
import type { Connection, HassEntities } from "home-assistant-js-websocket";
import { getEntity, getState } from "../lib/entities";
import { toggleSwitch, setNumber } from "../lib/ha";

interface Props {
  conn: Connection;
  entities: HassEntities;
  prefix: string;
}

const SWITCHES = [
  { suffix: "energy_saving", label: "Energy Saving", icon: "🌱" },
  { suffix: "auto_bean_select", label: "Auto Bean Select", icon: "🫘" },
  { suffix: "rinsing_disabled", label: "Rinsing Disabled", icon: "💧" },
];

const NUMBERS = [
  { suffix: "water_hardness", label: "Water Hardness", icon: "💎", unit: "" },
  { suffix: "auto_off_after", label: "Auto Off After", icon: "⏱️", unit: " min" },
  { suffix: "brew_temperature", label: "Brew Temperature", icon: "🌡️", unit: "" },
];

export function SettingsSection({ conn, entities, prefix }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="px-6">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between py-2 text-xs font-medium text-coffee-400 uppercase tracking-wider"
      >
        <span>Settings</span>
        <span className="text-coffee-600">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div className="space-y-2 pb-4">
          {SWITCHES.map(({ suffix, label, icon }) => {
            const entity = getEntity(entities, prefix, "switch", suffix);
            if (!entity) return null;
            const isOn = entity.state === "on";
            return (
              <div
                key={suffix}
                className="flex items-center justify-between rounded-xl bg-coffee-800/30 px-4 py-3"
              >
                <span className="flex items-center gap-2 text-sm text-coffee-200">
                  <span>{icon}</span> {label}
                </span>
                <button
                  onClick={() =>
                    toggleSwitch(conn, `switch.${prefix}_${suffix}`, !isOn)
                  }
                  className={`relative h-7 w-12 rounded-full transition ${
                    isOn ? "bg-coffee-500" : "bg-coffee-700"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-6 w-6 rounded-full bg-coffee-50 shadow transition-transform ${
                      isOn ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
            );
          })}

          {NUMBERS.map(({ suffix, label, icon, unit }) => {
            const value = getState(entities, prefix, "number", suffix);
            const entity = getEntity(entities, prefix, "number", suffix);
            if (!entity) return null;
            const min = entity.attributes?.min ?? 0;
            const max = entity.attributes?.max ?? 100;
            const step = entity.attributes?.step ?? 1;
            return (
              <div
                key={suffix}
                className="flex items-center justify-between rounded-xl bg-coffee-800/30 px-4 py-3"
              >
                <span className="flex items-center gap-2 text-sm text-coffee-200">
                  <span>{icon}</span> {label}
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={value || 0}
                    onChange={(e) =>
                      setNumber(
                        conn,
                        `number.${prefix}_${suffix}`,
                        parseFloat(e.target.value),
                      )
                    }
                    className="w-24 accent-coffee-500"
                  />
                  <span className="text-sm text-coffee-300 w-12 text-right">
                    {value}{unit}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
