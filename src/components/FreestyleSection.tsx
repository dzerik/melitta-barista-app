import { useState } from "react";
import { createPortal } from "react-dom";
import type { Connection, HassEntities } from "home-assistant-js-websocket";
import type { RecipeDetails } from "../lib/entities";
import type { UiContract } from "../lib/contract";
import { brewFreestyle, safeCall } from "../lib/ha";
import { useFreestyleState } from "../hooks/useFreestyleState";
import { useRecipeCache } from "../hooks/useRecipeCache";
import { usePreferences } from "../lib/preferences";
import { deriveMachineStatus } from "../lib/status";
import {
  resolveEnumTokens,
  resolveProcessTokens,
  resolvePortionRange,
} from "../lib/parameters";
import { displayNameFor } from "../lib/i18n";
import { FreestyleGlass } from "./FreestyleGlass";
import { CoffeeIcon } from "./CoffeeIcon";
import { Ban } from "lucide-react";
import iconBean from "../assets/icons/bean.png";
import iconMilk from "../assets/icons/milk.png";
import iconWater from "../assets/icons/water.png";
import iconNotConnected from "../assets/icons/not_connected.png";

const PROCESS_IMG_ICONS: Record<string, string> = {
  coffee: iconBean,
  milk: iconMilk,
  water: iconWater,
};

interface Props {
  conn: Connection;
  entities: HassEntities;
  prefix: string;
  /** UI Contract document (P-I wiring); null/omitted → legacy sources. */
  contract?: UiContract | null;
}

function RecipePickerModal({
  recipes,
  allRecipes,
  onPick,
  onClose,
  titleText,
}: {
  recipes: string[];
  allRecipes: Record<string, RecipeDetails>;
  onPick: (name: string, details: RecipeDetails) => void;
  onClose: () => void;
  titleText: string;
}) {
  const stopTouch = (e: React.TouchEvent) => e.stopPropagation();

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm"
      style={{ background: "var(--overlay-bg)" }}
      onClick={onClose}
      onTouchStart={stopTouch}
      onTouchMove={stopTouch}
      onTouchEnd={stopTouch}
    >
      <div
        className="relative w-full max-w-2xl max-h-[80vh] mx-4 rounded-2xl ring-1 ring-border overflow-hidden flex flex-col surface"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <span className="text-sm font-semibold text-primary tracking-wide">
            {titleText}
          </span>
          <button onClick={onClose} className="text-tertiary hover:text-primary transition p-1">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <div
            className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-px"
            style={{ background: "var(--recipe-grid-gap)" }}
          >
            {recipes.map((name) => {
              const details = allRecipes[name];
              const totalMl = details ? (details.c1_portion_ml || 0) + (details.c2_portion_ml || 0) : 0;
              return (
                <button
                  key={name}
                  onClick={() => { if (details) onPick(name, details); }}
                  className="flex flex-col items-center justify-center p-2 transition active:scale-[0.96]"
                  style={{ background: "var(--bg)" }}
                >
                  <CoffeeIcon recipe={name} size={72} />
                  <span className="text-[11px] text-secondary font-medium mt-1 truncate w-full text-center">
                    {name}
                  </span>
                  {totalMl > 0 && (
                    <span className="text-[9px] text-tertiary tabular-nums">{totalMl}ml</span>
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

function SegmentPicker({
  family,
  options,
  value,
  onChange,
}: {
  family: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  const { locale } = usePreferences();
  if (options.length === 0) return null;

  // §6.3.5.7 chain: server values.<family>.<token> → bundle → humanized.
  const displayName = (v: string): string => displayNameFor(locale, family, v);

  return (
    <div className="flex rounded-xl overflow-hidden ring-1 ring-border">
      {options.map((opt) => {
        const imgSrc = PROCESS_IMG_ICONS[opt];
        return (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition"
            style={
              opt === value
                ? { background: "var(--btn-primary-bg)", color: "var(--btn-primary-text)", fontWeight: 700 }
                : { background: "var(--surface)", color: "var(--text-tertiary)" }
            }
          >
            {imgSrc ? (
              <img src={imgSrc} alt={opt} className="w-3.5 h-3.5 object-contain" draggable={false} />
            ) : (
              <Ban size={14} />
            )}
            {displayName(opt)}
          </button>
        );
      })}
    </div>
  );
}

function SliderRow({
  family,
  label,
  options,
  value,
  onChange,
  disabled = false,
}: {
  family: string;
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const { locale } = usePreferences();
  if (options.length === 0) return null;
  const idx = options.indexOf(value);

  const displayName = (v: string): string => displayNameFor(locale, family, v);

  return (
    <div className={`space-y-1.5 transition-opacity ${disabled ? "opacity-20 pointer-events-none" : ""}`}>
      <span className="text-xs text-primary uppercase tracking-wider">{label}</span>
      <input
        type="range"
        min={0}
        max={options.length - 1}
        step={1}
        value={idx >= 0 ? idx : 0}
        onChange={(e) => onChange(options[parseInt(e.target.value)])}
        disabled={disabled}
        className="w-full h-1.5 appearance-none rounded-full
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-lg"
        style={{ background: "var(--slider-track)", accentColor: "var(--slider-thumb)" }}
      />
      <div className="flex justify-between">
        {options.map((opt) => (
          <span
            key={opt}
            className="text-[10px] transition"
            style={{ color: opt === value ? "var(--text-primary)" : "var(--text-tertiary)", fontWeight: opt === value ? 700 : 400 }}
          >
            {displayName(opt)}
          </span>
        ))}
      </div>
    </div>
  );
}

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
        <span className="text-xs text-primary uppercase tracking-wider">{label}</span>
        <span className="text-xs text-primary font-bold tabular-nums">{value} ml</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        disabled={disabled}
        className="w-full h-1.5 appearance-none rounded-full
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-lg"
        style={{ background: "var(--slider-track)", accentColor: "var(--slider-thumb)" }}
      />
    </div>
  );
}

export function FreestyleSection({ conn, entities, prefix, contract = null }: Props) {
  const { t, locale } = usePreferences();
  const view = deriveMachineStatus(entities, prefix, locale);
  const isReady = view.ready;
  const brewEntityId = `button.${prefix}_brew_freestyle`;

  const { state: fs, update, options: opts, loadFromRecipe } = useFreestyleState(entities, prefix);
  const { recipeOptions, allRecipes } = useRecipeCache(entities, prefix);
  const [pickerOpen, setPickerOpen] = useState(false);

  // §6.1.5 three-tier resolution: contract parameters → the freestyle select
  // entities' options (the pre-contract source) → hardcoded consts.
  const processOpts1 = resolveProcessTokens(contract, 1, opts.processOpts1).tokens;
  const processOpts2 = resolveProcessTokens(contract, 2, opts.processOpts2).tokens;
  const intensityOpts1 = resolveEnumTokens(contract, "intensity", opts.intensityOpts1).tokens;
  const intensityOpts2 = resolveEnumTokens(contract, "intensity", opts.intensityOpts2).tokens;
  const aromaOpts1 = resolveEnumTokens(contract, "aroma", opts.aromaOpts1).tokens;
  const aromaOpts2 = resolveEnumTokens(contract, "aroma", opts.aromaOpts2).tokens;
  const tempOpts1 = resolveEnumTokens(contract, "temperature", opts.tempOpts1).tokens;
  const tempOpts2 = resolveEnumTokens(contract, "temperature", opts.tempOpts2).tokens;
  const shotsOpts1 = resolveEnumTokens(contract, "shots", opts.shotsOpts1).tokens;
  const shotsOpts2 = resolveEnumTokens(contract, "shots", opts.shotsOpts2).tokens;
  const portion1Range = resolvePortionRange(contract, "c1");
  const portion2Range = resolvePortionRange(contract, "c2");

  const handleBrew = () => {
    safeCall(() =>
      brewFreestyle(conn, brewEntityId, {
        name: fs.name,
        process1: fs.process1,
        intensity1: fs.intensity1,
        aroma1: fs.aroma1,
        portion1_ml: fs.portion1,
        temperature1: fs.temperature1,
        shots1: fs.shots1,
        process2: fs.process2,
        intensity2: fs.intensity2,
        aroma2: fs.aroma2,
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
          <img src={iconNotConnected} alt="not ready" className="w-20 h-20 object-contain opacity-60" draggable={false} />
          <div className="text-center">
            <div className="text-lg font-light text-primary tracking-wide">
              {view.offline ? "Offline" : view.statusLabel}
            </div>
            <div className="text-sm text-tertiary mt-2">
              {t("freestyle.available_when_ready")}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 min-h-0 flex items-stretch">
        <div className="flex-1 flex flex-col justify-center gap-4 px-6 py-4">
          <div className="text-xs font-bold text-primary uppercase tracking-[0.2em]">
            {t("freestyle.component1")}
          </div>
          <SegmentPicker family="process" options={processOpts1} value={fs.process1} onChange={(v) => update("process1", v)} />
          <PortionSlider label={t("freestyle.portion")} value={fs.portion1} min={portion1Range.min} max={portion1Range.max} step={portion1Range.step} onChange={(v) => update("portion1", v)} />
          <SliderRow family="intensity" label={t("freestyle.intensity")} options={intensityOpts1} value={fs.intensity1} onChange={(v) => update("intensity1", v)} disabled={fs.process1 !== "coffee"} />
          <SliderRow family="aroma" label={t("freestyle.aroma")} options={aromaOpts1} value={fs.aroma1} onChange={(v) => update("aroma1", v)} disabled={fs.process1 !== "coffee"} />
          <SliderRow family="temperature" label={t("freestyle.temperature")} options={tempOpts1} value={fs.temperature1} onChange={(v) => update("temperature1", v)} />
          <SliderRow family="shots" label={t("freestyle.shots")} options={shotsOpts1} value={fs.shots1} onChange={(v) => update("shots1", v)} disabled={fs.process1 !== "coffee"} />
        </div>

        <div className="flex flex-col items-center justify-center px-4 border-x border-border">
          {recipeOptions.length > 0 && (
            <button
              onClick={() => setPickerOpen(true)}
              className="mb-2 flex items-center gap-1.5 text-xs text-tertiary hover:text-secondary transition"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
                <path d="M12 5v14M5 12h14" strokeLinecap="round" />
              </svg>
              {t("freestyle.use_recipe")}
            </button>
          )}

          {pickerOpen && (
            <RecipePickerModal
              recipes={recipeOptions}
              allRecipes={allRecipes}
              titleText={t("freestyle.use_recipe")}
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
            className="mb-1 w-48 text-center text-lg font-light tracking-wide outline-none border-b transition pb-1"
            style={{
              background: "transparent",
              color: "var(--text-primary)",
              borderColor: "var(--border)",
            }}
          />

          <span className="text-sm text-tertiary tabular-nums mb-2">
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
            intensityScale={intensityOpts1}
            temperatureScale={tempOpts1}
          />

          <button
            onClick={handleBrew}
            className="mt-3 w-full rounded-xl py-3 text-sm font-semibold transition hover:opacity-90 active:scale-[0.97]"
            style={{ background: "var(--btn-primary-bg)", color: "var(--btn-primary-text)" }}
          >
            {t("brew.brew")} {fs.name}
          </button>
        </div>

        <div className="flex-1 flex flex-col justify-center gap-4 px-6 py-4">
          <div className="text-xs font-bold text-primary uppercase tracking-[0.2em]">
            {t("freestyle.component2")}
          </div>
          <SegmentPicker family="process" options={processOpts2} value={fs.process2} onChange={(v) => update("process2", v)} />
          <PortionSlider label={t("freestyle.portion")} value={fs.portion2} min={portion2Range.min} max={portion2Range.max} step={portion2Range.step} onChange={(v) => update("portion2", v)} disabled={fs.process2 === "none"} />
          <SliderRow family="intensity" label={t("freestyle.intensity")} options={intensityOpts2} value={fs.intensity2} onChange={(v) => update("intensity2", v)} disabled={fs.process2 !== "coffee"} />
          <SliderRow family="aroma" label={t("freestyle.aroma")} options={aromaOpts2} value={fs.aroma2} onChange={(v) => update("aroma2", v)} disabled={fs.process2 !== "coffee"} />
          <SliderRow family="temperature" label={t("freestyle.temperature")} options={tempOpts2} value={fs.temperature2} onChange={(v) => update("temperature2", v)} disabled={fs.process2 === "none"} />
          <SliderRow family="shots" label={t("freestyle.shots")} options={shotsOpts2} value={fs.shots2} onChange={(v) => update("shots2", v)} disabled={fs.process2 !== "coffee"} />
        </div>
      </div>
    </div>
  );
}
