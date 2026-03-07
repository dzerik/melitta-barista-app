import type { Connection, HassEntities } from "home-assistant-js-websocket";
import { getEntity, getState } from "../lib/entities";
import { toggleSwitch, setNumber } from "../lib/ha";

interface Props {
  conn: Connection;
  entities: HassEntities;
  prefix: string;
}

const SWITCHES = [
  { suffix: "energy_saving", label: "Energy Saving" },
  { suffix: "auto_bean_select", label: "Auto Bean Select" },
  { suffix: "rinsing_disabled", label: "Rinsing Disabled" },
];

const NUMBERS = [
  { suffix: "water_hardness", label: "Water Hardness", unit: "" },
  { suffix: "auto_off_after", label: "Auto Off After", unit: " min" },
  { suffix: "brew_temperature", label: "Brew Temperature", unit: "" },
];

export function SettingsSection({ conn, entities, prefix }: Props) {
  return (
    <div className="flex h-full flex-col gap-px px-4 py-4 overflow-y-auto">
      <div className="text-[10px] font-medium text-neutral-600 uppercase tracking-[0.2em] mb-2 shrink-0">
        Machine Settings
      </div>

      {SWITCHES.map(({ suffix, label }) => {
        const entity = getEntity(entities, prefix, "switch", suffix);
        if (!entity) return null;
        const isOn = entity.state === "on";
        return (
          <div
            key={suffix}
            className="flex items-center justify-between py-3 border-b border-neutral-800/40"
          >
            <span className="text-sm text-neutral-300">{label}</span>
            <button
              onClick={() =>
                toggleSwitch(conn, `switch.${prefix}_${suffix}`, !isOn)
              }
              className={`relative h-6 w-10 rounded-full transition ${
                isOn ? "bg-white" : "bg-neutral-700"
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full shadow transition-transform ${
                  isOn ? "translate-x-4 bg-black" : "translate-x-0.5 bg-neutral-400"
                }`}
              />
            </button>
          </div>
        );
      })}

      {NUMBERS.map(({ suffix, label, unit }) => {
        const value = getState(entities, prefix, "number", suffix);
        const entity = getEntity(entities, prefix, "number", suffix);
        if (!entity) return null;
        const min = entity.attributes?.min ?? 0;
        const max = entity.attributes?.max ?? 100;
        const step = entity.attributes?.step ?? 1;
        return (
          <div
            key={suffix}
            className="flex items-center justify-between py-3 border-b border-neutral-800/40"
          >
            <span className="text-sm text-neutral-300">{label}</span>
            <div className="flex items-center gap-3">
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
                className="w-24 accent-white"
              />
              <span className="text-sm text-neutral-500 w-14 text-right tabular-nums">
                {value}{unit}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
