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
import { Commit, DrinkStage, MeterField, Option, OptionRow, Rule } from "./ui";
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

/** §C1: the glyph beside an option word sits at 18–20px. */
const OPTION_GLYPH = 18;

/**
 * §G2.7: every control row in a column is opened by the same 1px `--border`
 * hairline and nothing else. OptionRow draws its own; MeterField is a bare
 * control, so the numeric rows borrow the rule here rather than sitting in the
 * list unruled.
 */
const ROW_RULE = {
  borderTopWidth: "1px",
  borderTopStyle: "solid" as const,
  borderTopColor: "var(--border)",
  paddingTop: "0.375rem",
};

interface Props {
  conn: Connection;
  entities: HassEntities;
  prefix: string;
  /** UI Contract document (P-I wiring); null/omitted → legacy sources. */
  contract?: UiContract | null;
}

/**
 * The recipe picker overlay: a scrim (§5.A) over the one flat `--surface`
 * panel this overlay is allowed (§5.B) — radius 0, no ring, no shadow, and
 * everything inside it unfilled.
 *
 * The drinks themselves are a bare grid: field research is unanimous that a
 * drink tile carries no border, no fill and no divider (Franke, WMF, Rivelia
 * all cut the glass straight onto the ground), so the 1px-gap mosaic that used
 * to draw `--recipe-grid-gap` between `--bg` cells is gone with the fills it
 * needed.
 */
function RecipePickerModal({
  recipes,
  allRecipes,
  onPick,
  onClose,
  titleText,
  closeLabel,
}: {
  recipes: string[];
  allRecipes: Record<string, RecipeDetails>;
  onPick: (name: string, details: RecipeDetails) => void;
  onClose: () => void;
  titleText: string;
  closeLabel: string;
}) {
  const stopTouch = (e: React.TouchEvent) => e.stopPropagation();

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm"
      data-fill="scrim"
      style={{ backgroundColor: "var(--overlay-bg)" }}
      onClick={onClose}
      onTouchStart={stopTouch}
      onTouchMove={stopTouch}
      onTouchEnd={stopTouch}
    >
      <div
        className="relative w-full max-w-2xl max-h-[80vh] mx-4 overflow-hidden flex flex-col"
        data-fill="panel"
        style={{ backgroundColor: "var(--surface)", borderRadius: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4">
          <span className="t-body text-primary" style={{ fontWeight: 600 }}>
            {titleText}
          </span>
          <button
            onClick={onClose}
            aria-label={closeLabel}
            className="tap press text-secondary hover:text-primary"
            style={{ borderRadius: 0 }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="w-5 h-5">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <Rule />
        <div className="flex-1 overflow-y-auto custom-scroll p-4">
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
                  className="tap press flex flex-col items-center justify-center p-2"
                  style={{ borderRadius: 0, background: "var(--bg)" }}
                >
                  <CoffeeIcon recipe={name} size={64} />
                  <span className="t-label text-secondary mt-1 truncate w-full text-center">
                    {name}
                  </span>
                  {totalMl > 0 && (
                    <span className="t-label num text-tertiary">{totalMl} ml</span>
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

/**
 * The process picker — coffee / milk / water (and `none` on component 2) — as
 * a row of chooseable words, each carrying its 18px glyph.
 *
 * Replaces the `rounded-xl ring-1` capsule bar whose selected segment was a
 * solid `--btn-primary-bg` fill: selection is now the word turning white over
 * a lit 1px `--accent` underline, in a slot that was already reserved, so
 * choosing never shifts a pixel.
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
 * labelled row of words — §C1, and the form the reference machine itself uses
 * for aroma (a caret against STANDARD / INTENSE, never a bar).
 *
 * This is what replaces the `rounded-full` range track and its `shadow-lg`
 * thumb: an ordinal token list was never a measured quantity, so it is chosen
 * by name rather than dragged. Only the genuinely numeric portion keeps a
 * meter (see `MeterField` below).
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
          <img src={iconNotConnected} alt="" className="w-20 h-20 object-contain opacity-60" draggable={false} />
          <div className="text-center">
            <div className="t-title text-primary" style={{ fontWeight: 300 }}>
              {view.offline ? t("brew.offline_title") : view.statusLabel}
            </div>
            <div className="t-body text-tertiary mt-2">
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
        {/* Component 1 — unboxed, straight on the ground (§R1.1). */}
        <div className="flex-1 flex flex-col justify-center px-6 py-4">
          <div className="t-label text-primary mb-4" style={{ fontWeight: 600 }}>
            {t("freestyle.component1")}
          </div>
          <div className="space-y-3">
            <ProcessRow
              options={processOpts1}
              value={fs.process1}
              onChange={(v) => update("process1", v)}
              ariaLabel={t("freestyle.component1")}
            />
            <MeterField
              label={t("freestyle.portion")}
              value={fs.portion1}
              min={portion1Range.min}
              max={portion1Range.max}
              step={portion1Range.step}
              displayValue={`${fs.portion1} ml`}
              onChange={(v) => update("portion1", v)}
              style={ROW_RULE}
            />
            <TokenRow family="intensity" label={t("freestyle.intensity")} options={intensityOpts1} value={fs.intensity1} onChange={(v) => update("intensity1", v)} disabled={fs.process1 !== "coffee"} />
            <TokenRow family="aroma" label={t("freestyle.aroma")} options={aromaOpts1} value={fs.aroma1} onChange={(v) => update("aroma1", v)} disabled={fs.process1 !== "coffee"} />
            <TokenRow family="temperature" label={t("freestyle.temperature")} options={tempOpts1} value={fs.temperature1} onChange={(v) => update("temperature1", v)} />
            <TokenRow family="shots" label={t("freestyle.shots")} options={shotsOpts1} value={fs.shots1} onChange={(v) => update("shots1", v)} disabled={fs.process1 !== "coffee"} />
          </div>
        </div>

        {/* The drink is the hero and takes the centre column's own width (§R1.9). */}
        <div className="flex flex-col items-center justify-center px-4 border-x border-border">
          {recipeOptions.length > 0 && (
            <button
              onClick={() => setPickerOpen(true)}
              className="tap press mb-1 flex items-center gap-2 t-label text-secondary hover:text-primary"
              style={{
                borderRadius: 0,
                borderBottomWidth: "1px",
                borderBottomStyle: "solid",
                borderBottomColor: "var(--border)",
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="w-4 h-4">
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
              closeLabel={t("brew.cancel")}
              onPick={(name, details) => {
                loadFromRecipe(name, details);
                setPickerOpen(false);
              }}
              onClose={() => setPickerOpen(false)}
            />
          )}

          {/* §R1.6: a name field is a line to write on — no fill, no ring, no radius. */}
          <input
            type="text"
            value={fs.name}
            onChange={(e) => update("name", e.target.value)}
            className="mb-1 w-48 text-center t-title outline-none border-b transition pb-1"
            style={{
              background: "transparent",
              color: "var(--text-primary)",
              borderColor: "var(--border)",
              borderRadius: 0,
              fontWeight: 300,
              /** §C3.6: reach is never traded away, even on a painted line. */
              minHeight: "var(--tap)",
            }}
          />

          <span className="t-label num text-tertiary mb-2">
            {fs.portion1 + fs.portion2} ml
          </span>

          {/*
            §6.2 ground treatment. `reflection` is off because FreestyleGlass
            already draws its own mirrored copy inside the SVG, at the real
            glass base — and because DrinkStage renders its child twice, which
            would duplicate the glass's fixed SVG element ids.
          */}
          <DrinkStage size={280} active reflection={false}>
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
          </DrinkStage>

          {/* §5.C: the one commit rectangle on this screen, locked to the column. */}
          <div className="mt-3 w-full">
            <Commit
              label={`${t("brew.brew")} ${fs.name}`}
              onCommit={handleBrew}
            />
          </div>
        </div>

        {/* Component 2 */}
        <div className="flex-1 flex flex-col justify-center px-6 py-4">
          <div className="t-label text-primary mb-4" style={{ fontWeight: 600 }}>
            {t("freestyle.component2")}
          </div>
          <div className="space-y-3">
            <ProcessRow
              options={processOpts2}
              value={fs.process2}
              onChange={(v) => update("process2", v)}
              ariaLabel={t("freestyle.component2")}
            />
            <MeterField
              label={t("freestyle.portion")}
              value={fs.portion2}
              min={portion2Range.min}
              max={portion2Range.max}
              step={portion2Range.step}
              displayValue={`${fs.portion2} ml`}
              onChange={(v) => update("portion2", v)}
              disabled={fs.process2 === "none"}
              style={ROW_RULE}
            />
            <TokenRow family="intensity" label={t("freestyle.intensity")} options={intensityOpts2} value={fs.intensity2} onChange={(v) => update("intensity2", v)} disabled={fs.process2 !== "coffee"} />
            <TokenRow family="aroma" label={t("freestyle.aroma")} options={aromaOpts2} value={fs.aroma2} onChange={(v) => update("aroma2", v)} disabled={fs.process2 !== "coffee"} />
            <TokenRow family="temperature" label={t("freestyle.temperature")} options={tempOpts2} value={fs.temperature2} onChange={(v) => update("temperature2", v)} disabled={fs.process2 === "none"} />
            <TokenRow family="shots" label={t("freestyle.shots")} options={shotsOpts2} value={fs.shots2} onChange={(v) => update("shots2", v)} disabled={fs.process2 !== "coffee"} />
          </div>
        </div>
      </div>
    </div>
  );
}
