import { useState } from "react";
import { createPortal } from "react-dom";
import type { Connection } from "home-assistant-js-websocket";
import type { DirectKeyRecipe, DirectKeyCategory } from "../lib/entities";
import type { UiContract } from "../lib/contract";
import { saveDirectkey, safeCall } from "../lib/ha";
import { usePreferences } from "../lib/preferences";
import { Ban } from "lucide-react";
import { FreestyleGlass } from "./FreestyleGlass";
import { Commit, MeterField, Option, OptionRow, Rule } from "./ui";
import { displayNameFor } from "../lib/i18n";
import {
  resolveEnumTokens,
  resolveProcessTokens,
  resolvePortionRange,
} from "../lib/parameters";
import { saveDirectkeyDefaults } from "../lib/actions";
import iconBean from "../assets/icons/bean.png";
import iconMilk from "../assets/icons/milk.png";
import iconWater from "../assets/icons/water.png";

const PROCESS_IMG_ICONS: Record<string, string> = {
  coffee: iconBean,
  milk: iconMilk,
  water: iconWater,
};

const SHOTS_TO_STRING: Record<number, string> = { 0: "none", 1: "one", 2: "two", 3: "three" };

/** §C1: the glyph beside an option word sits at 18–20px. */
const OPTION_GLYPH = 18;

/**
 * §G2.7: every control row in a column is opened by the same 1px `--border`
 * hairline and nothing else. OptionRow draws its own; MeterField is a bare
 * control, so the numeric rows borrow the rule here.
 */
const ROW_RULE = {
  borderTopWidth: "1px",
  borderTopStyle: "solid" as const,
  borderTopColor: "var(--border)",
  paddingTop: "0.375rem",
};

/**
 * The modal's legacy hardcoded slot defaults — the fallback when the
 * contract's `save_directkey` catalog entry (§9.3.5) is not served. Keys are
 * the service's own param names, so served introspected defaults overlay
 * these 1:1.
 */
const LEGACY_SAVE_DEFAULTS: Record<string, string | number> = {
  process1: "coffee",
  intensity1: "medium",
  aroma1: "standard",
  temperature1: "normal",
  shots1: "one",
  portion1_ml: 40,
  process2: "none",
  intensity2: "medium",
  aroma2: "standard",
  temperature2: "normal",
  shots2: "none",
  portion2_ml: 0,
};

interface EditState {
  process1: string;
  intensity1: string;
  aroma1: string;
  temperature1: string;
  shots1: string;
  portion1: number;
  process2: string;
  intensity2: string;
  aroma2: string;
  temperature2: string;
  shots2: string;
  portion2: number;
}

function str(v: string | number | boolean | undefined, fallback: string): string {
  return typeof v === "string" && v !== "" ? v : fallback;
}

function num(v: string | number | boolean | undefined, fallback: number): number {
  return typeof v === "number" ? v : fallback;
}

function fromRecipe(
  r: DirectKeyRecipe,
  defaults: Record<string, string | number | boolean>,
): EditState {
  return {
    process1: r.c1_process || str(defaults.process1, "coffee"),
    intensity1: r.c1_intensity || str(defaults.intensity1, "medium"),
    aroma1: r.c1_aroma || str(defaults.aroma1, "standard"),
    temperature1: r.c1_temperature || str(defaults.temperature1, "normal"),
    shots1: SHOTS_TO_STRING[r.c1_shots] || str(defaults.shots1, "one"),
    portion1: r.c1_portion_ml || num(defaults.portion1_ml, 40),
    process2: r.c2_process || str(defaults.process2, "none"),
    intensity2: r.c2_intensity || str(defaults.intensity2, "medium"),
    aroma2: r.c2_aroma || str(defaults.aroma2, "standard"),
    temperature2: r.c2_temperature || str(defaults.temperature2, "normal"),
    shots2: SHOTS_TO_STRING[r.c2_shots] || str(defaults.shots2, "none"),
    portion2: r.c2_portion_ml || num(defaults.portion2_ml, 0),
  };
}

/**
 * The process picker — coffee / milk / water (and `none` on component 2) — as
 * a row of chooseable words, each carrying its 18px glyph.
 *
 * Replaces the `rounded-xl ring-1` capsule bar whose selected segment was a
 * solid `--btn-primary-bg` fill. Selection is the word turning white over a
 * lit 1px `--accent` underline, in a slot that was already reserved, so
 * choosing never shifts a pixel of the row.
 */
function ProcessRow({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  ariaLabel: string;
}) {
  const { locale } = usePreferences();
  if (options.length === 0) return null;

  return (
    <OptionRow role="radiogroup" ariaLabel={ariaLabel}>
      {options.map((opt) => {
        const imgSrc = PROCESS_IMG_ICONS[opt];
        return (
          <Option
            key={opt}
            role="radio"
            label={displayNameFor(locale, "process", opt)}
            selected={opt === value}
            onSelect={() => onChange(opt)}
            icon={
              imgSrc ? (
                <img
                  src={imgSrc}
                  alt=""
                  className="object-contain"
                  style={{ width: OPTION_GLYPH, height: OPTION_GLYPH }}
                  draggable={false}
                />
              ) : (
                <Ban size={OPTION_GLYPH} strokeWidth={1.75} />
              )
            }
          />
        );
      })}
    </OptionRow>
  );
}

/**
 * One enumerated parameter (intensity, aroma, temperature, shots) as a
 * labelled row of words — §C1.
 *
 * An ordinal token list was never a measured quantity, so it is chosen by name
 * rather than dragged along a `rounded-full` track with a `shadow-lg` thumb.
 * Only the genuinely numeric portion keeps a meter.
 */
function TokenRow({
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

  return (
    <OptionRow label={label} role="radiogroup" ariaLabel={label}>
      {options.map((opt) => (
        <Option
          key={opt}
          role="radio"
          label={displayNameFor(locale, family, opt)}
          selected={opt === value}
          onSelect={() => onChange(opt)}
          disabled={disabled}
        />
      ))}
    </OptionRow>
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
  /** UI Contract document (P-I wiring); null/omitted → legacy consts. */
  contract?: UiContract | null;
}

export function RecipeEditModal({ conn, brewEntityId, category, categoryLabel, recipe, profileId, onClose, contract = null }: Props) {
  const { t } = usePreferences();
  // §9.3.5: slot defaults from the save_directkey catalog entry's
  // introspected params; the legacy consts stay as the pre-catalog tier.
  const [state, setState] = useState<EditState>(() =>
    fromRecipe(recipe, { ...LEGACY_SAVE_DEFAULTS, ...saveDirectkeyDefaults(contract) }),
  );
  const [saving, setSaving] = useState(false);

  // §6.1.5 resolution: contract parameters → consts (the modal's own legacy
  // tier — it has no select entities of its own).
  const processOpts1 = resolveProcessTokens(contract, 1).tokens;
  const processOpts2 = resolveProcessTokens(contract, 2).tokens;
  const intensityOpts = resolveEnumTokens(contract, "intensity").tokens;
  const aromaOpts = resolveEnumTokens(contract, "aroma").tokens;
  const temperatureOpts = resolveEnumTokens(contract, "temperature").tokens;
  const shotsOpts = resolveEnumTokens(contract, "shots").tokens;
  const portion1Range = resolvePortionRange(contract, "c1");
  const portion2Range = resolvePortionRange(contract, "c2");

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
        aroma1: state.aroma1,
        portion1_ml: state.portion1,
        temperature1: state.temperature1,
        shots1: state.shots1,
        process2: state.process2,
        intensity2: state.intensity2,
        aroma2: state.aroma2,
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
      /** §5.A: a scrim is the removal of the page, not a container fill. */
      data-fill="scrim"
      style={{ backgroundColor: "var(--overlay-bg)" }}
      onClick={onClose}
      onTouchStart={stopTouch}
      onTouchMove={stopTouch}
      onTouchEnd={stopTouch}
    >
      <div
        className="relative w-full max-w-4xl max-h-[90vh] mx-4 overflow-hidden flex flex-col"
        /** §5.B: the one flat neutral panel this overlay is allowed — radius 0,
            no border, no ring, no shadow, and everything inside it unfilled. */
        data-fill="panel"
        style={{ backgroundColor: "var(--surface)", borderRadius: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4">
          <span className="t-body text-primary" style={{ fontWeight: 600 }}>
            {t("brew.edit_recipe")}: {categoryLabel}
          </span>
          <button
            onClick={onClose}
            aria-label={t("brew.cancel")}
            className="tap press text-secondary hover:text-primary"
            style={{ borderRadius: 0 }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="w-5 h-5">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <Rule />

        {/* Body */}
        <div className="flex-1 overflow-y-auto custom-scroll">
          <div className="flex items-stretch min-h-[400px]">
            {/* Component 1 — unboxed, straight on the panel's ground. */}
            <div className="flex-1 flex flex-col justify-center px-6 py-4">
              <div className="t-label text-primary mb-4" style={{ fontWeight: 600 }}>
                {t("freestyle.component1")}
              </div>
              <div className="space-y-3">
                <ProcessRow options={processOpts1} value={state.process1} onChange={(v) => update("process1", v)} ariaLabel={t("freestyle.component1")} />
                <MeterField
                  label={t("freestyle.portion")}
                  value={state.portion1}
                  min={portion1Range.min}
                  max={portion1Range.max}
                  step={portion1Range.step}
                  displayValue={`${state.portion1} ml`}
                  onChange={(v) => update("portion1", v)}
                  style={ROW_RULE}
                />
                <TokenRow family="intensity" label={t("freestyle.intensity")} options={intensityOpts} value={state.intensity1} onChange={(v) => update("intensity1", v)} disabled={state.process1 !== "coffee"} />
                <TokenRow family="aroma" label={t("freestyle.aroma")} options={aromaOpts} value={state.aroma1} onChange={(v) => update("aroma1", v)} disabled={state.process1 !== "coffee"} />
                <TokenRow family="temperature" label={t("freestyle.temperature")} options={temperatureOpts} value={state.temperature1} onChange={(v) => update("temperature1", v)} />
                <TokenRow family="shots" label={t("freestyle.shots")} options={shotsOpts} value={state.shots1} onChange={(v) => update("shots1", v)} disabled={state.process1 !== "coffee"} />
              </div>
            </div>

            {/* Center — glass preview */}
            <div className="flex flex-col items-center justify-center px-4 border-x border-border">
              <span className="t-label num text-tertiary mb-2">
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
                intensityScale={intensityOpts}
                temperatureScale={temperatureOpts}
              />
            </div>

            {/* Component 2 */}
            <div className="flex-1 flex flex-col justify-center px-6 py-4">
              <div className="t-label text-primary mb-4" style={{ fontWeight: 600 }}>
                {t("freestyle.component2")}
              </div>
              <div className="space-y-3">
                <ProcessRow options={processOpts2} value={state.process2} onChange={(v) => update("process2", v)} ariaLabel={t("freestyle.component2")} />
                <MeterField
                  label={t("freestyle.portion")}
                  value={state.portion2}
                  min={portion2Range.min}
                  max={portion2Range.max}
                  step={portion2Range.step}
                  displayValue={`${state.portion2} ml`}
                  onChange={(v) => update("portion2", v)}
                  disabled={state.process2 === "none"}
                  style={ROW_RULE}
                />
                <TokenRow family="intensity" label={t("freestyle.intensity")} options={intensityOpts} value={state.intensity2} onChange={(v) => update("intensity2", v)} disabled={state.process2 !== "coffee"} />
                <TokenRow family="aroma" label={t("freestyle.aroma")} options={aromaOpts} value={state.aroma2} onChange={(v) => update("aroma2", v)} disabled={state.process2 !== "coffee"} />
                <TokenRow family="temperature" label={t("freestyle.temperature")} options={temperatureOpts} value={state.temperature2} onChange={(v) => update("temperature2", v)} disabled={state.process2 === "none"} />
                <TokenRow family="shots" label={t("freestyle.shots")} options={shotsOpts} value={state.shots2} onChange={(v) => update("shots2", v)} disabled={state.process2 !== "coffee"} />
              </div>
            </div>
          </div>
        </div>

        {/*
          §8.3: the one rule in the app that may be 2px and accent is the
          footer rule opening an action band — the panel's strongest single
          graphic gesture, and the only place the eye needs one.
        */}
        <Rule weight={2} tone="accent" />
        <div className="flex items-center gap-6 px-5 py-4">
          {/* §C3.5: one commit per screen; every other action is a bare word. */}
          <button
            onClick={onClose}
            className="tap press shrink-0 t-body text-secondary hover:text-primary"
            style={{
              borderRadius: 0,
              borderBottomWidth: "1px",
              borderBottomStyle: "solid",
              borderBottomColor: "var(--border)",
            }}
          >
            {t("brew.cancel")}
          </button>
          {/* Width comes from the wrapper: the footer's own content measure. */}
          <div className="flex-1">
            <Commit
              label={t("brew.save")}
              scale="panel"
              busy={saving}
              onCommit={handleSave}
            />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
