import { useState } from "react";
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
import { FreestyleGlass, GLASS_ASPECT, GLASS_BASE_FRACTION } from "./FreestyleGlass";
import { CoffeeIcon } from "./CoffeeIcon";
import { PARAM_ROW_RULE, ProcessRow, TokenRow } from "./ParamRow";
import { SwipeGuard } from "./SwipeGuard";
import {
  ActionBand,
  Commit,
  DrinkStage,
  Field,
  Glyph,
  Heading,
  MeterField,
  Mosaic,
  Panel,
  Word,
} from "./ui";
import { Plus } from "lucide-react";
import iconNotConnected from "../assets/icons/not_connected.png";
import { noteBrewStarted } from "../lib/brew-origin";

/** §6.1: a mosaic tile's drink sits on the 64 rung. */
const PICKER_ICON = 64;

/** §6.1: the drink IS this screen, so it takes the hero rung (C15). */
const HERO_GLASS = 280;

interface Props {
  conn: Connection;
  entities: HassEntities;
  prefix: string;
  /** UI Contract document (P-I wiring); null/omitted → legacy sources. */
  contract?: UiContract | null;
}

/**
 * The recipe picker overlay, drawn by the shared `Panel` (C7, C8, C9): one
 * scrim, one flat `--surface` rectangle at the `md` measure, one header, one
 * close control. The four rival close glyphs the audit found — two hand-rolled
 * 24-viewBox X SVGs among them, one of which lived right here — are now the
 * panel's own lucide `X` at 20px.
 *
 * The drinks are a §R1.2 hairline mosaic: `gap: 1px` over `--section-divider`
 * with `--bg` cells, so the dividers are gaps rather than borders and no tile
 * paints itself.
 *
 * `SwipeGuard` is what keeps a drag inside the panel from paging the app's tab
 * strip underneath it: React routes a portal's events up the COMPONENT tree,
 * not the DOM tree, so the guard has to sit between the panel and the section.
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
  return (
    <SwipeGuard>
      <Panel
        title={titleText}
        closeLabel={closeLabel}
        measure="md"
        onClose={onClose}
        bodyClassName="p-4"
      >
        <Mosaic id="freestyle-picker-mosaic" columns={6} count={recipes.length} className="p-0">
          {recipes.map((name) => {
            const details = allRecipes[name];
            const totalMl = details ? (details.c1_portion_ml || 0) + (details.c2_portion_ml || 0) : 0;
            return (
              <button
                key={name}
                onClick={() => { if (details) onPick(name, details); }}
                className="tap press flex flex-col items-center justify-center p-2"
                /** §S4.1: a mosaic cell repaints the page ground, nothing else. */
                data-fill="ground"
                style={{ borderRadius: 0, backgroundColor: "var(--bg)" }}
              >
                <CoffeeIcon recipe={name} size={PICKER_ICON} />
                <span className="t-label text-secondary mt-1 truncate w-full text-center">
                  {name}
                </span>
                {totalMl > 0 && (
                  <span className="t-label num text-tertiary">{totalMl} ml</span>
                )}
              </button>
            );
          })}
        </Mosaic>
      </Panel>
    </SwipeGuard>
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
    // The machine will not tell anyone what this is; if we do not remember it
    // now, the brewing screen can only name the phase.
    noteBrewStarted(fs.name || t("tab.freestyle"), {
      c1_process: fs.process1,
      c1_intensity: fs.intensity1,
      c1_aroma: fs.aroma1,
      c1_temperature: fs.temperature1,
      c1_shots: fs.shots1,
      c1_portion_ml: fs.portion1,
      c2_process: fs.process2,
      c2_intensity: fs.intensity2,
      c2_aroma: fs.aroma2,
      c2_temperature: fs.temperature2,
      c2_shots: fs.shots2,
      c2_portion_ml: fs.portion2,
    } as never);
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
          {/*
            §6.6 / C27: one state glyph, one size, one knock-down. The alt text
            is empty on purpose — the headline underneath already names the
            state, and the old `alt="offline"` was hardcoded English.
          */}
          <Glyph src={iconNotConnected} alt="" size="state" />
          <div className="text-center">
            {/*
              C26: the two blocked pages read the same. `t-title` keeps the
              weight it declares (600); the local `fontWeight: 300` override
              here was the only thing making Freestyle's blocked page lighter
              than the Recipes one beside it.
            */}
            <div className="t-title text-primary">
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
          <Heading>{t("freestyle.component1")}</Heading>
          {/* §G2.6: 12px between sibling control rows, here and in the modal. */}
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
              steppers={{ decrement: t("app.decrease"), increment: t("app.increase") }}
              style={PARAM_ROW_RULE}
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
            /*
              An ACTION, so it wears no rule: an underline means "chosen" in
              this language, and this word opens a picker. It was the twelfth
              hand-rolled copy of the bare-word secondary (C5) and the last
              hand-drawn 24-viewBox glyph in this file (C9).
            */
            <Word
              label={t("freestyle.use_recipe")}
              icon={<Plus size={16} strokeWidth={1.75} />}
              onClick={() => setPickerOpen(true)}
              className="mb-1"
            />
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

          {/*
            §R1.6 / C6: a name field is a line to write on, and `Field` is the
            app's only input form — one hairline, `--input-border`, at
            `--underline-w`. The three rival rule colours are gone with it.
          */}
          <Field
            value={fs.name}
            onChange={(v) => update("name", v)}
            ariaLabel={t("freestyle.drink_name")}
            className="mb-1 w-48"
            inputClassName="text-center"
            inputStyle={{
              /*
                §7.2: the drink's name is the largest type on its screen, so it
                takes the `t-title` rung. It cannot come from the class —
                `.t-body` is declared AFTER `.t-title` in index.css, so both
                classes on one element resolve to the smaller step — which is
                why the one hero step in the app is spelled here and nowhere
                else. Weight 300 is §7.2's hero treatment. `t-title`'s -0.01em
                is deliberately NOT copied: §7.5 kills every inline
                letter-spacing in the app and a hundredth of an em is not worth
                being the exception.
              */
              fontSize: "1.25rem",
              lineHeight: 1.25,
              fontWeight: 300,
              paddingBottom: "0.25rem",
            }}
          />

          <span className="t-label num text-tertiary mb-2">
            {fs.portion1 + fs.portion2} ml
          </span>

          {/*
            §6.2 ground treatment, and the ONE reflection in the app (C29, R6).
            The glass no longer mirrors itself inside its own SVG, so
            `reflection={false}` is gone; `aspect` and `baseFraction` come from
            the glass's own geometry so the glow, the horizon, the contact line
            and the mirror all land on the base at y=112 rather than on the
            bottom of a viewBox with 38 empty units under it.
          */}
          <DrinkStage
            size={HERO_GLASS}
            aspect={GLASS_ASPECT}
            baseFraction={GLASS_BASE_FRACTION}
            active
          >
            <FreestyleGlass
              process1={fs.process1}
              intensity1={fs.intensity1}
              temp1={fs.temperature1}
              portion1={fs.portion1}
              process2={fs.process2}
              intensity2={fs.intensity2}
              temp2={fs.temperature2}
              portion2={fs.portion2}
              size={HERO_GLASS}
              hideVolume
              intensityScale={intensityOpts1}
              temperatureScale={tempOpts1}
            />
          </DrinkStage>

          {/*
            C10: one arrangement for every band that commits — the 2px accent
            rule (§8.3) over a single row whose commit takes the remaining
            width. The inset is `none` because this band is NOT rail-to-rail:
            it sits in the intrinsic-width centre column, and §5.C locks the
            commit rectangle to that column's content measure. A rail gutter
            here would eat 100px of a ~280px column.
          */}
          <ActionBand
            inset="none"
            className="w-full"
            commit={
              <Commit
                label={`${t("brew.brew")} ${fs.name}`}
                onCommit={handleBrew}
              />
            }
          />
        </div>

        {/* Component 2 */}
        <div className="flex-1 flex flex-col justify-center px-6 py-4">
          <Heading>{t("freestyle.component2")}</Heading>
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
              steppers={{ decrement: t("app.decrease"), increment: t("app.increase") }}
              style={PARAM_ROW_RULE}
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
