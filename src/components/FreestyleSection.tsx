import type { Connection, HassEntities } from "home-assistant-js-websocket";
import { getState, getOptions } from "../lib/entities";
import { selectOption, setNumber, setTextValue, pressButton } from "../lib/ha";
import { FreestyleGlass } from "./FreestyleGlass";

interface Props {
  conn: Connection;
  entities: HassEntities;
  prefix: string;
}

/** Segmented slider-style option picker */
function SegmentPicker({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  if (options.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <span className="text-xs text-white uppercase tracking-wider">{label}</span>
      <div className="flex rounded-xl overflow-hidden ring-1 ring-neutral-700">
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={`flex-1 py-2.5 text-xs font-medium transition ${
              opt === value
                ? "bg-white text-black font-bold"
                : "bg-neutral-900 text-neutral-500 hover:text-neutral-300"
            }`}
          >
            {displayName(opt)}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Display name for option values */
const DISPLAY_NAMES: Record<string, string> = {
  very_mild: "Very Mild",
  mild: "Mild",
  medium: "Medium",
  strong: "Strong",
  very_strong: "Very Strong",
  extra_strong: "Extra Strong",
  low: "Low",
  normal: "Normal",
  high: "High",
  one: "1",
  two: "2",
  three: "3",
};

function displayName(v: string): string {
  return DISPLAY_NAMES[v] || v.charAt(0).toUpperCase() + v.slice(1).replaceAll("_", " ");
}

/** Labeled range slider with step labels */
function SliderRow({
  label,
  options,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  if (options.length === 0) return null;
  const idx = options.indexOf(value);
  return (
    <div className={`space-y-1.5 transition-opacity ${disabled ? "opacity-20 pointer-events-none" : ""}`}>
      <span className="text-xs text-white uppercase tracking-wider">{label}</span>
      <input
        type="range"
        min={0}
        max={options.length - 1}
        step={1}
        value={idx >= 0 ? idx : 0}
        onChange={(e) => onChange(options[parseInt(e.target.value)])}
        disabled={disabled}
        className="w-full accent-white h-1.5 appearance-none bg-neutral-800 rounded-full
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-lg"
      />
      <div className="flex justify-between">
        {options.map((opt) => (
          <span
            key={opt}
            className={`text-[10px] transition ${
              opt === value ? "text-white font-bold" : "text-neutral-600"
            }`}
          >
            {displayName(opt)}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Portion slider (ml) */
function PortionSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  disabled = false,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className={`space-y-1.5 transition-opacity ${disabled ? "opacity-20 pointer-events-none" : ""}`}>
      <div className="flex justify-between">
        <span className="text-xs text-white uppercase tracking-wider">{label}</span>
        <span className="text-xs text-white font-bold tabular-nums">{value} ml</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        disabled={disabled}
        className="w-full accent-white h-1.5 appearance-none bg-neutral-800 rounded-full
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-lg"
      />
    </div>
  );
}

export function FreestyleSection({ conn, entities, prefix }: Props) {
  const machineState = getState(entities, prefix, "sensor", "state");
  const isReady = machineState === "Ready";
  const name = getState(entities, prefix, "text", "freestyle_name") || "Custom";
  const brewFreestyleId = `button.${prefix}_brew_freestyle`;

  // Component 1
  const process1 = getState(entities, prefix, "select", "freestyle_process_1") || "coffee";
  const intensity1 = getState(entities, prefix, "select", "freestyle_intensity_1") || "medium";
  const temp1 = getState(entities, prefix, "select", "freestyle_temperature_1") || "normal";
  const shots1 = getState(entities, prefix, "select", "freestyle_shots_1") || "one";
  const portion1 = parseInt(getState(entities, prefix, "number", "freestyle_portion_1") || "40");
  const processOpts1 = getOptions(entities, prefix, "freestyle_process_1");
  const intensityOpts1 = getOptions(entities, prefix, "freestyle_intensity_1");
  const tempOpts1 = getOptions(entities, prefix, "freestyle_temperature_1");
  const shotsOpts1 = getOptions(entities, prefix, "freestyle_shots_1");

  // Component 2
  const process2 = getState(entities, prefix, "select", "freestyle_process_2") || "none";
  const intensity2 = getState(entities, prefix, "select", "freestyle_intensity_2") || "medium";
  const temp2 = getState(entities, prefix, "select", "freestyle_temperature_2") || "normal";
  const shots2 = getState(entities, prefix, "select", "freestyle_shots_2") || "one";
  const portion2 = parseInt(getState(entities, prefix, "number", "freestyle_portion_2") || "0");
  const processOpts2 = getOptions(entities, prefix, "freestyle_process_2");
  const intensityOpts2 = getOptions(entities, prefix, "freestyle_intensity_2");
  const tempOpts2 = getOptions(entities, prefix, "freestyle_temperature_2");
  const shotsOpts2 = getOptions(entities, prefix, "freestyle_shots_2");

  if (!isReady) {
    return (
      <div className="flex h-full items-center justify-center text-neutral-600">
        Machine is not ready
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Main content: left panel — glass — right panel */}
      <div className="flex-1 min-h-0 flex items-stretch">

        {/* Component 1 — left */}
        <div className="flex-1 flex flex-col justify-center gap-4 px-6 py-4">
          <div className="text-xs font-bold text-white uppercase tracking-[0.2em]">
            Component 1
          </div>

          <SegmentPicker
            label="Process"
            options={processOpts1}
            value={process1}
            onChange={(v) => selectOption(conn, `select.${prefix}_freestyle_process_1`, v)}
          />

          <PortionSlider
            label="Portion"
            value={portion1}
            min={5}
            max={250}
            step={5}
            onChange={(v) => setNumber(conn, `number.${prefix}_freestyle_portion_1`, v)}
          />

          <SliderRow
            label="Intensity"
            options={intensityOpts1}
            value={intensity1}
            onChange={(v) => selectOption(conn, `select.${prefix}_freestyle_intensity_1`, v)}
            disabled={process1 !== "coffee"}
          />

          <SliderRow
            label="Temperature"
            options={tempOpts1}
            value={temp1}
            onChange={(v) => selectOption(conn, `select.${prefix}_freestyle_temperature_1`, v)}
          />

          <SliderRow
            label="Shots"
            options={shotsOpts1}
            value={shots1}
            onChange={(v) => selectOption(conn, `select.${prefix}_freestyle_shots_1`, v)}
            disabled={process1 !== "coffee"}
          />
        </div>

        {/* Glass — center */}
        <div className="flex flex-col items-center justify-center px-4 border-x border-neutral-800/40">
          <input
            type="text"
            value={name}
            onChange={(e) =>
              setTextValue(conn, `text.${prefix}_freestyle_name`, e.target.value)
            }
            className="mb-4 w-48 text-center bg-transparent text-white text-lg font-light tracking-wide outline-none border-b border-neutral-800 focus:border-neutral-500 transition pb-1"
          />
          <FreestyleGlass
            process1={process1}
            intensity1={intensity1}
            temp1={temp1}
            portion1={portion1}
            process2={process2}
            intensity2={intensity2}
            temp2={temp2}
            portion2={portion2}
            size={280}
          />
        </div>

        {/* Component 2 — right */}
        <div className="flex-1 flex flex-col justify-center gap-4 px-6 py-4">
          <div className="text-xs font-bold text-white uppercase tracking-[0.2em]">
            Component 2
          </div>

          <SegmentPicker
            label="Process"
            options={processOpts2}
            value={process2}
            onChange={(v) => selectOption(conn, `select.${prefix}_freestyle_process_2`, v)}
          />

          <PortionSlider
            label="Portion"
            value={portion2}
            min={0}
            max={250}
            step={5}
            onChange={(v) => setNumber(conn, `number.${prefix}_freestyle_portion_2`, v)}
            disabled={process2 === "none"}
          />

          <SliderRow
            label="Intensity"
            options={intensityOpts2}
            value={intensity2}
            onChange={(v) => selectOption(conn, `select.${prefix}_freestyle_intensity_2`, v)}
            disabled={process2 !== "coffee"}
          />

          <SliderRow
            label="Temperature"
            options={tempOpts2}
            value={temp2}
            onChange={(v) => selectOption(conn, `select.${prefix}_freestyle_temperature_2`, v)}
            disabled={process2 === "none"}
          />

          <SliderRow
            label="Shots"
            options={shotsOpts2}
            value={shots2}
            onChange={(v) => selectOption(conn, `select.${prefix}_freestyle_shots_2`, v)}
            disabled={process2 !== "coffee"}
          />
        </div>
      </div>

      {/* Brew button — full width footer */}
      <button
        onClick={() => pressButton(conn, brewFreestyleId)}
        className="shrink-0 w-full bg-white py-3.5 text-sm font-semibold text-black transition hover:bg-neutral-200 active:scale-y-95"
      >
        Brew {name}
      </button>
    </div>
  );
}
