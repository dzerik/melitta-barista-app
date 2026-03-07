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
      <label className="block text-[10px] text-coffee-500 mb-0.5">{label}</label>
      <select
        value={value || ""}
        onChange={(e) => selectOption(conn, entityId, e.target.value)}
        className="w-full rounded-lg bg-coffee-800/50 px-2.5 py-1.5 text-sm text-coffee-100 ring-1 ring-coffee-700 outline-none focus:ring-coffee-500"
      >
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}

export function FreestyleSection({ conn, entities, prefix }: Props) {
  const machineState = getState(entities, prefix, "sensor", "state");
  const isReady = machineState === "Ready";
  const name = getState(entities, prefix, "text", "freestyle_name") || "Custom";
  const brewFreestyleId = `button.${prefix}_brew_freestyle`;

  const portion1 = getState(entities, prefix, "number", "freestyle_portion_1");
  const portion2 = getState(entities, prefix, "number", "freestyle_portion_2");

  const fields1 = [
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

  if (!isReady) {
    return (
      <div className="flex h-full items-center justify-center text-coffee-500">
        Machine is not ready
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3 px-4 py-3">
      {/* Name */}
      <div className="shrink-0">
        <label className="block text-[10px] text-coffee-500 mb-0.5">Recipe Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) =>
            setTextValue(conn, `text.${prefix}_freestyle_name`, e.target.value)
          }
          className="w-full rounded-lg bg-coffee-800/50 px-3 py-2 text-sm text-coffee-100 ring-1 ring-coffee-700 outline-none focus:ring-coffee-500"
        />
      </div>

      {/* Two component panels side by side */}
      <div className="flex-1 min-h-0 grid grid-cols-2 gap-4">
        {/* Component 1 */}
        <div className="flex flex-col gap-2 rounded-2xl bg-coffee-900/40 p-3 ring-1 ring-coffee-800">
          <div className="text-xs font-semibold text-coffee-300 shrink-0">
            ☕ Component 1
          </div>
          <div className="grid grid-cols-2 gap-2 flex-1 auto-rows-min">
            {fields1.map((f) => (
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
              <label className="block text-[10px] text-coffee-500 mb-0.5">
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
                className="w-full rounded-lg bg-coffee-800/50 px-2.5 py-1.5 text-sm text-coffee-100 ring-1 ring-coffee-700 outline-none focus:ring-coffee-500"
              />
            </div>
          </div>
        </div>

        {/* Component 2 */}
        <div className="flex flex-col gap-2 rounded-2xl bg-coffee-900/40 p-3 ring-1 ring-coffee-800">
          <div className="text-xs font-semibold text-coffee-300 shrink-0">
            🥛 Component 2
          </div>
          <div className="grid grid-cols-2 gap-2 flex-1 auto-rows-min">
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
              <label className="block text-[10px] text-coffee-500 mb-0.5">
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
                className="w-full rounded-lg bg-coffee-800/50 px-2.5 py-1.5 text-sm text-coffee-100 ring-1 ring-coffee-700 outline-none focus:ring-coffee-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Brew button */}
      <button
        onClick={() => pressButton(conn, brewFreestyleId)}
        className="shrink-0 w-full rounded-2xl bg-coffee-600 py-3 text-base font-bold text-coffee-50 shadow-lg shadow-coffee-600/20 transition hover:bg-coffee-500 active:scale-[0.97]"
      >
        🧪 Brew Freestyle
      </button>
    </div>
  );
}
