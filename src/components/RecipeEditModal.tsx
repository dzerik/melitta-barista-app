import { useState } from "react";
import { createPortal } from "react-dom";
import type { Connection } from "home-assistant-js-websocket";
import type { DirectKeyRecipe, DirectKeyCategory } from "../lib/entities";
import { saveDirectkey, safeCall } from "../lib/ha";
import { usePreferences } from "../lib/preferences";
import { Bean, Milk, Droplets, Ban } from "lucide-react";
import { FreestyleGlass } from "./FreestyleGlass";
import type { TranslationKey } from "../lib/i18n";
import type { ComponentType } from "react";

const PROCESS_ICONS: Record<string, ComponentType<{ size?: number; className?: string }>> = {
  none: Ban,
  coffee: Bean,
  milk: Milk,
  water: Droplets,
};

const PROCESS_OPTIONS_1 = ["coffee", "milk", "water"];
const PROCESS_OPTIONS_2 = ["none", "coffee", "milk", "water"];
const INTENSITY_OPTIONS = ["very_mild", "mild", "medium", "strong", "very_strong"];
const TEMPERATURE_OPTIONS = ["cold", "normal", "high"];
const SHOTS_OPTIONS = ["none", "one", "two", "three"];

const SHOTS_TO_STRING: Record<number, string> = { 0: "none", 1: "one", 2: "two", 3: "three" };

interface EditState {
  process1: string;
  intensity1: string;
  temperature1: string;
  shots1: string;
  portion1: number;
  process2: string;
  intensity2: string;
  temperature2: string;
  shots2: string;
  portion2: number;
}

function fromRecipe(r: DirectKeyRecipe): EditState {
  return {
    process1: r.c1_process || "coffee",
    intensity1: r.c1_intensity || "medium",
    temperature1: r.c1_temperature || "normal",
    shots1: SHOTS_TO_STRING[r.c1_shots] || "one",
    portion1: r.c1_portion_ml || 40,
    process2: r.c2_process || "none",
    intensity2: r.c2_intensity || "medium",
    temperature2: r.c2_temperature || "normal",
    shots2: SHOTS_TO_STRING[r.c2_shots] || "none",
    portion2: r.c2_portion_ml || 0,
  };
}

function SegmentPicker({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  const { t } = usePreferences();
  const displayName = (v: string): string => {
    const key = `process.${v}` as TranslationKey;
    const translated = t(key);
    if (translated !== key) return translated;
    return v.charAt(0).toUpperCase() + v.slice(1).replaceAll("_", " ");
  };

  return (
    <div className="flex rounded-xl overflow-hidden ring-1 ring-border">
      {options.map((opt) => {
        const Icon = PROCESS_ICONS[opt];
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
            {Icon && <Icon size={14} />}
            {displayName(opt)}
          </button>
        );
      })}
    </div>
  );
}

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
  const { t } = usePreferences();
  const idx = options.indexOf(value);

  const displayName = (v: string): string => {
    const key = `process.${v}` as TranslationKey;
    const translated = t(key);
    if (translated !== key) return translated;
    return v.charAt(0).toUpperCase() + v.slice(1).replaceAll("_", " ");
  };

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

interface Props {
  conn: Connection;
  brewEntityId: string;
  category: DirectKeyCategory;
  categoryLabel: string;
  recipe: DirectKeyRecipe;
  profileId: number;
  onClose: () => void;
}

export function RecipeEditModal({ conn, brewEntityId, category, categoryLabel, recipe, profileId, onClose }: Props) {
  const { t } = usePreferences();
  const [state, setState] = useState<EditState>(() => fromRecipe(recipe));
  const [saving, setSaving] = useState(false);

  const update = <K extends keyof EditState>(key: K, value: EditState[K]) => {
    setState((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    safeCall(async () => {
      await saveDirectkey(conn, brewEntityId, {
        category,
        profile_id: profileId,
        process1: state.process1,
        intensity1: state.intensity1,
        portion1_ml: state.portion1,
        temperature1: state.temperature1,
        shots1: state.shots1,
        process2: state.process2,
        intensity2: state.intensity2,
        portion2_ml: state.portion2,
        temperature2: state.temperature2,
        shots2: state.shots2,
      });
      onClose();
    });
  };

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
        className="relative w-full max-w-4xl max-h-[90vh] mx-4 rounded-2xl ring-1 ring-border overflow-hidden flex flex-col"
        style={{ background: "var(--surface)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <span className="text-sm font-semibold text-primary tracking-wide">
            {t("brew.edit_recipe")}: {categoryLabel}
          </span>
          <button onClick={onClose} className="text-tertiary hover:text-primary transition p-1">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          <div className="flex items-stretch min-h-[400px]">
            {/* Component 1 */}
            <div className="flex-1 flex flex-col justify-center gap-4 px-6 py-4">
              <div className="text-xs font-bold text-primary uppercase tracking-[0.2em]">
                {t("freestyle.component1")}
              </div>
              <SegmentPicker options={PROCESS_OPTIONS_1} value={state.process1} onChange={(v) => update("process1", v)} />
              <PortionSlider label={t("freestyle.portion")} value={state.portion1} min={5} max={250} step={5} onChange={(v) => update("portion1", v)} />
              <SliderRow label={t("freestyle.intensity")} options={INTENSITY_OPTIONS} value={state.intensity1} onChange={(v) => update("intensity1", v)} disabled={state.process1 !== "coffee"} />
              <SliderRow label={t("freestyle.temperature")} options={TEMPERATURE_OPTIONS} value={state.temperature1} onChange={(v) => update("temperature1", v)} />
              <SliderRow label={t("freestyle.shots")} options={SHOTS_OPTIONS} value={state.shots1} onChange={(v) => update("shots1", v)} disabled={state.process1 !== "coffee"} />
            </div>

            {/* Center — glass preview */}
            <div className="flex flex-col items-center justify-center px-4 border-x border-border">
              <span className="text-sm text-tertiary tabular-nums mb-2">
                {state.portion1 + state.portion2} ml
              </span>
              <FreestyleGlass
                process1={state.process1}
                intensity1={state.intensity1}
                temp1={state.temperature1}
                portion1={state.portion1}
                process2={state.process2}
                intensity2={state.intensity2}
                temp2={state.temperature2}
                portion2={state.portion2}
                size={240}
                hideVolume
              />
            </div>

            {/* Component 2 */}
            <div className="flex-1 flex flex-col justify-center gap-4 px-6 py-4">
              <div className="text-xs font-bold text-primary uppercase tracking-[0.2em]">
                {t("freestyle.component2")}
              </div>
              <SegmentPicker options={PROCESS_OPTIONS_2} value={state.process2} onChange={(v) => update("process2", v)} />
              <PortionSlider label={t("freestyle.portion")} value={state.portion2} min={0} max={250} step={5} onChange={(v) => update("portion2", v)} disabled={state.process2 === "none"} />
              <SliderRow label={t("freestyle.intensity")} options={INTENSITY_OPTIONS} value={state.intensity2} onChange={(v) => update("intensity2", v)} disabled={state.process2 !== "coffee"} />
              <SliderRow label={t("freestyle.temperature")} options={TEMPERATURE_OPTIONS} value={state.temperature2} onChange={(v) => update("temperature2", v)} disabled={state.process2 === "none"} />
              <SliderRow label={t("freestyle.shots")} options={SHOTS_OPTIONS} value={state.shots2} onChange={(v) => update("shots2", v)} disabled={state.process2 !== "coffee"} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-border">
          <button
            onClick={onClose}
            className="rounded-lg px-6 py-2.5 text-sm font-medium text-secondary ring-1 ring-border hover:ring-border-hover transition"
          >
            {t("brew.cancel")}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-xl px-6 py-2.5 text-sm font-semibold transition hover:opacity-90 active:scale-[0.97] disabled:opacity-50"
            style={{ background: "var(--btn-primary-bg)", color: "var(--btn-primary-text)" }}
          >
            {saving ? "..." : t("brew.save")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
