import { useState } from "react";
import type { Connection, HassEntities } from "home-assistant-js-websocket";
import { getState, getOptions } from "../lib/entities";
import { selectOption, setNumber, setTextValue, pressButton } from "../lib/ha";

interface Props {
  conn: Connection;
  entities: HassEntities;
  prefix: string;
}

function SelectField({
  label,
  entityId,
  options,
  value,
  conn,
}: {
  label: string;
  entityId: string;
  options: string[];
  value: string | null;
  conn: Connection;
}) {
  return (
    <div>
      <label className="block text-xs text-coffee-400 mb-1">{label}</label>
      <select
        value={value || ""}
        onChange={(e) => selectOption(conn, entityId, e.target.value)}
        className="w-full rounded-lg bg-coffee-800/50 px-3 py-2 text-sm text-coffee-100 ring-1 ring-coffee-700 outline-none focus:ring-coffee-500"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

export function FreestyleSection({ conn, entities, prefix }: Props) {
  const [expanded, setExpanded] = useState(false);

  const machineState = getState(entities, prefix, "sensor", "state");
  const isReady = machineState === "Ready";

  const name = getState(entities, prefix, "text", "freestyle_name") || "Custom";
  const brewFreestyleId = `button.${prefix}_brew_freestyle`;

  if (!isReady) return null;

  const fields = [
    { label: "Process", suffix: "freestyle_process_1" },
    { label: "Intensity", suffix: "freestyle_intensity_1" },
    { label: "Temperature", suffix: "freestyle_temperature_1" },
    { label: "Shots", suffix: "freestyle_shots_1" },
  ];

  const fields2 = [
    { label: "Process", suffix: "freestyle_process_2" },
    { label: "Intensity", suffix: "freestyle_intensity_2" },
    { label: "Temperature", suffix: "freestyle_temperature_2" },
    { label: "Shots", suffix: "freestyle_shots_2" },
  ];

  const portion1 = getState(entities, prefix, "number", "freestyle_portion_1");
  const portion2 = getState(entities, prefix, "number", "freestyle_portion_2");

  return (
    <div className="px-6">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between py-2 text-xs font-medium text-coffee-400 uppercase tracking-wider"
      >
        <span>Freestyle Recipe</span>
        <span className="text-coffee-600">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div className="space-y-4 pb-4">
          {/* Name */}
          <div>
            <label className="block text-xs text-coffee-400 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) =>
                setTextValue(conn, `text.${prefix}_freestyle_name`, e.target.value)
              }
              className="w-full rounded-lg bg-coffee-800/50 px-3 py-2 text-sm text-coffee-100 ring-1 ring-coffee-700 outline-none focus:ring-coffee-500"
            />
          </div>

          {/* Component 1 */}
          <div>
            <div className="text-xs font-medium text-coffee-300 mb-2">
              Component 1 — Coffee
            </div>
            <div className="grid grid-cols-2 gap-2">
              {fields.map((f) => (
                <SelectField
                  key={f.suffix}
                  label={f.label}
                  entityId={`select.${prefix}_${f.suffix}`}
                  options={getOptions(entities, prefix, f.suffix)}
                  value={getState(entities, prefix, "select", f.suffix)}
                  conn={conn}
                />
              ))}
              <div>
                <label className="block text-xs text-coffee-400 mb-1">
                  Portion (ml)
                </label>
                <input
                  type="number"
                  min={5}
                  max={250}
                  step={5}
                  value={portion1 || 40}
                  onChange={(e) =>
                    setNumber(
                      conn,
                      `number.${prefix}_freestyle_portion_1`,
                      parseInt(e.target.value) || 40,
                    )
                  }
                  className="w-full rounded-lg bg-coffee-800/50 px-3 py-2 text-sm text-coffee-100 ring-1 ring-coffee-700 outline-none focus:ring-coffee-500"
                />
              </div>
            </div>
          </div>

          {/* Component 2 */}
          <div>
            <div className="text-xs font-medium text-coffee-300 mb-2">
              Component 2 — Milk / Water
            </div>
            <div className="grid grid-cols-2 gap-2">
              {fields2.map((f) => (
                <SelectField
                  key={f.suffix}
                  label={f.label}
                  entityId={`select.${prefix}_${f.suffix}`}
                  options={getOptions(entities, prefix, f.suffix)}
                  value={getState(entities, prefix, "select", f.suffix)}
                  conn={conn}
                />
              ))}
              <div>
                <label className="block text-xs text-coffee-400 mb-1">
                  Portion (ml)
                </label>
                <input
                  type="number"
                  min={0}
                  max={250}
                  step={5}
                  value={portion2 || 0}
                  onChange={(e) =>
                    setNumber(
                      conn,
                      `number.${prefix}_freestyle_portion_2`,
                      parseInt(e.target.value) || 0,
                    )
                  }
                  className="w-full rounded-lg bg-coffee-800/50 px-3 py-2 text-sm text-coffee-100 ring-1 ring-coffee-700 outline-none focus:ring-coffee-500"
                />
              </div>
            </div>
          </div>

          {/* Brew Freestyle */}
          <button
            onClick={() => pressButton(conn, brewFreestyleId)}
            className="w-full rounded-2xl bg-coffee-600 py-3.5 text-base font-bold text-coffee-50 shadow-lg shadow-coffee-600/20 transition hover:bg-coffee-500 active:scale-[0.97]"
          >
            🧪 Brew Freestyle
          </button>
        </div>
      )}
    </div>
  );
}
