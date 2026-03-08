import { useState } from "react";
import { createPortal } from "react-dom";
import type { Connection, HassEntities } from "home-assistant-js-websocket";
import type { RecipeDetails } from "../lib/entities";
import { getState } from "../lib/entities";
import { brewFreestyle, safeCall } from "../lib/ha";
import { useFreestyleState } from "../hooks/useFreestyleState";
import { useRecipeCache } from "../hooks/useRecipeCache";
import { FreestyleGlass } from "./FreestyleGlass";
import { CoffeeIcon } from "./CoffeeIcon";

interface Props {
  conn: Connection;
  entities: HassEntities;
  prefix: string;
}

/** Modal grid of mini recipe cards for picking a base recipe. */
function RecipePickerModal({
  recipes,
  allRecipes,
  onPick,
  onClose,
}: {
  recipes: string[];
  allRecipes: Record<string, RecipeDetails>;
  onPick: (name: string, details: RecipeDetails) => void;
  onClose: () => void;
}) {
  const stopTouch = (e: React.TouchEvent) => e.stopPropagation();

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
      onTouchStart={stopTouch}
      onTouchMove={stopTouch}
      onTouchEnd={stopTouch}
    >
      <div
        className="relative w-full max-w-2xl max-h-[80vh] mx-4 rounded-2xl bg-neutral-900 ring-1 ring-white/[0.08] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800/60">
          <span className="text-sm font-semibold text-white tracking-wide">
            Use recipe as base
          </span>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-white transition p-1"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          <div
            className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-px"
            style={{ background: "rgba(255,255,255,0.04)" }}
          >
            {recipes.map((name) => {
              const details = allRecipes[name];
              const totalMl = details
                ? (details.c1_portion_ml || 0) + (details.c2_portion_ml || 0)
                : 0;
              return (
                <button
                  key={name}
                  onClick={() => {
                    if (details) onPick(name, details);
                  }}
                  className="flex flex-col items-center justify-center bg-black p-2 hover:bg-neutral-800/60 transition active:scale-[0.96]"
                >
                  <CoffeeIcon recipe={name} size={72} />
                  <span className="text-[11px] text-neutral-400 font-medium mt-1 truncate w-full text-center">
                    {name}
                  </span>
                  {totalMl > 0 && (
                    <span className="text-[9px] text-neutral-600 tabular-nums">
                      {totalMl}ml
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Segmented option picker (instant local update, no API call) */
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

const DISPLAY_NAMES: Record<string, string> = {
  very_mild: "Very Mild",
  mild: "Mild",
  medium: "Medium",
  strong: "Strong",
  very_strong: "Very Strong",
  extra_strong: "Extra Strong",
  cold: "Cold",
  low: "Cold",
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
  const brewEntityId = `button.${prefix}_brew_freestyle`;

  const { state: fs, update, options: opts, loadFromRecipe } = useFreestyleState(entities, prefix);
  const { recipeOptions, allRecipes } = useRecipeCache(entities, prefix);
  const [pickerOpen, setPickerOpen] = useState(false);

  const handleBrew = () => {
    safeCall(() =>
      brewFreestyle(conn, brewEntityId, {
        name: fs.name,
        process1: fs.process1,
        intensity1: fs.intensity1,
        portion1_ml: fs.portion1,
        temperature1: fs.temperature1,
        shots1: fs.shots1,
        process2: fs.process2,
        intensity2: fs.intensity2,
        portion2_ml: fs.portion2,
        temperature2: fs.temperature2,
        shots2: fs.shots2,
      }),
    );
  };

  if (!isReady) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-8">
        <div className="flex flex-col items-center gap-6 max-w-sm">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="w-16 h-16 text-neutral-700">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v5M12 16v.5" strokeLinecap="round" strokeWidth="1.5" />
          </svg>
          <div className="text-center">
            <div className="text-lg font-light text-neutral-300 tracking-wide">
              {machineState || "Offline"}
            </div>
            <div className="text-sm text-neutral-600 mt-2">
              Freestyle is available when the machine is ready
            </div>
          </div>
        </div>
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
            options={opts.processOpts1}
            value={fs.process1}
            onChange={(v) => update("process1", v)}
          />

          <PortionSlider
            label="Portion"
            value={fs.portion1}
            min={5}
            max={250}
            step={5}
            onChange={(v) => update("portion1", v)}
          />

          <SliderRow
            label="Intensity"
            options={opts.intensityOpts1}
            value={fs.intensity1}
            onChange={(v) => update("intensity1", v)}
            disabled={fs.process1 !== "coffee"}
          />

          <SliderRow
            label="Temperature"
            options={opts.tempOpts1}
            value={fs.temperature1}
            onChange={(v) => update("temperature1", v)}
          />

          <SliderRow
            label="Shots"
            options={opts.shotsOpts1}
            value={fs.shots1}
            onChange={(v) => update("shots1", v)}
            disabled={fs.process1 !== "coffee"}
          />
        </div>

        {/* Glass — center */}
        <div className="flex flex-col items-center justify-center px-4 border-x border-neutral-800/40">
          {/* Base recipe picker button */}
          {recipeOptions.length > 0 && (
            <button
              onClick={() => setPickerOpen(true)}
              className="mb-2 flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
                <path d="M12 5v14M5 12h14" strokeLinecap="round" />
              </svg>
              Use recipe as base
            </button>
          )}

          {/* Recipe picker modal */}
          {pickerOpen && (
            <RecipePickerModal
              recipes={recipeOptions}
              allRecipes={allRecipes}
              onPick={(name, details) => {
                loadFromRecipe(name, details);
                setPickerOpen(false);
              }}
              onClose={() => setPickerOpen(false)}
            />
          )}

          <input
            type="text"
            value={fs.name}
            onChange={(e) => update("name", e.target.value)}
            className="mb-1 w-48 text-center bg-transparent text-white text-lg font-light tracking-wide outline-none border-b border-neutral-800 focus:border-neutral-500 transition pb-1"
          />

          {/* Volume */}
          <span className="text-sm text-neutral-500 tabular-nums mb-2">
            {fs.portion1 + fs.portion2} ml
          </span>

          <FreestyleGlass
            process1={fs.process1}
            intensity1={fs.intensity1}
            temp1={fs.temperature1}
            portion1={fs.portion1}
            process2={fs.process2}
            intensity2={fs.intensity2}
            temp2={fs.temperature2}
            portion2={fs.portion2}
            size={280}
            hideVolume
          />

          {/* Brew button — under the glass */}
          <button
            onClick={handleBrew}
            className="mt-3 w-48 rounded-xl bg-white py-3 text-sm font-semibold text-black transition hover:bg-neutral-200 active:scale-[0.97]"
          >
            Brew {fs.name}
          </button>
        </div>

        {/* Component 2 — right */}
        <div className="flex-1 flex flex-col justify-center gap-4 px-6 py-4">
          <div className="text-xs font-bold text-white uppercase tracking-[0.2em]">
            Component 2
          </div>

          <SegmentPicker
            label="Process"
            options={opts.processOpts2}
            value={fs.process2}
            onChange={(v) => update("process2", v)}
          />

          <PortionSlider
            label="Portion"
            value={fs.portion2}
            min={0}
            max={250}
            step={5}
            onChange={(v) => update("portion2", v)}
            disabled={fs.process2 === "none"}
          />

          <SliderRow
            label="Intensity"
            options={opts.intensityOpts2}
            value={fs.intensity2}
            onChange={(v) => update("intensity2", v)}
            disabled={fs.process2 !== "coffee"}
          />

          <SliderRow
            label="Temperature"
            options={opts.tempOpts2}
            value={fs.temperature2}
            onChange={(v) => update("temperature2", v)}
            disabled={fs.process2 === "none"}
          />

          <SliderRow
            label="Shots"
            options={opts.shotsOpts2}
            value={fs.shots2}
            onChange={(v) => update("shots2", v)}
            disabled={fs.process2 !== "coffee"}
          />
        </div>
      </div>
    </div>
  );
}
