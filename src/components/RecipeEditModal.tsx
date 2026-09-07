import { useState } from "react";
import type { Connection } from "home-assistant-js-websocket";
import type { DirectKeyRecipe, DirectKeyCategory } from "../lib/entities";
import type { UiContract } from "../lib/contract";
import { saveDirectkey, safeCall } from "../lib/ha";
import { usePreferences } from "../lib/preferences";
import { FreestyleGlass, GLASS_ASPECT, GLASS_BASE_FRACTION } from "./FreestyleGlass";
import { PARAM_ROW_RULE, ProcessRow, TokenRow } from "./ParamRow";
import { SwipeGuard } from "./SwipeGuard";
import { ActionBand, Commit, DrinkStage, Heading, MeterField, Panel, Word } from "./ui";
import {
  resolveEnumTokens,
  resolveProcessTokens,
  resolvePortionRange,
} from "../lib/parameters";
import { saveDirectkeyDefaults } from "../lib/actions";

const SHOTS_TO_STRING: Record<number, string> = { 0: "none", 1: "one", 2: "two", 3: "three" };

/**
 * §6.1 / C15: the ideal recipe IS this panel's subject, so its glass takes the
 * same hero rung as Freestyle's. It was drawn at 240 — the carousel
 * centre-stage rung — and with no ground at all.
 */
const HERO_GLASS = 280;

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

  return (
    <SwipeGuard>
      <Panel
        title={`${t("brew.edit_recipe")}: ${categoryLabel}`}
        closeLabel={t("brew.cancel")}
        measure="lg"
        onClose={onClose}
        actions={
          <ActionBand
            secondary={<Word label={t("brew.cancel")} onClick={onClose} />}
            commit={
              <Commit
                label={t("brew.save")}
                scale="panel"
                busy={saving}
                onCommit={handleSave}
              />
            }
          />
        }
      >
        <div className="flex items-stretch min-h-[400px]">
          {/* Component 1 — unboxed, straight on the panel's ground. */}
          <div className="flex-1 flex flex-col justify-center px-6 py-4">
            <Heading>{t("freestyle.component1")}</Heading>
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
                steppers={{ decrement: t("app.decrease"), increment: t("app.increase") }}
                style={PARAM_ROW_RULE}
              />
              <TokenRow family="intensity" label={t("freestyle.intensity")} options={intensityOpts} value={state.intensity1} onChange={(v) => update("intensity1", v)} disabled={state.process1 !== "coffee"} />
              <TokenRow family="aroma" label={t("freestyle.aroma")} options={aromaOpts} value={state.aroma1} onChange={(v) => update("aroma1", v)} disabled={state.process1 !== "coffee"} />
              <TokenRow family="temperature" label={t("freestyle.temperature")} options={temperatureOpts} value={state.temperature1} onChange={(v) => update("temperature1", v)} />
              <TokenRow family="shots" label={t("freestyle.shots")} options={shotsOpts} value={state.shots1} onChange={(v) => update("shots1", v)} disabled={state.process1 !== "coffee"} />
            </div>
          </div>

          {/* Center — the drink, on the same ground and at the same rung as Freestyle's. */}
          <div className="flex flex-col items-center justify-center px-4 border-x border-border">
            <span className="t-label num text-tertiary mb-2">
              {state.portion1 + state.portion2} ml
            </span>
            {/*
              C15/C16: the identical glass in the identical three-up centre
              column used to be drawn at 240 with no `DrinkStage` at all — no
              glow, no horizon, no contact line — while Freestyle gave it the
              full §6.2 ground at 280. One drink, one rung, one ground.
            */}
            <DrinkStage
              size={HERO_GLASS}
              aspect={GLASS_ASPECT}
              baseFraction={GLASS_BASE_FRACTION}
              active
            >
              <FreestyleGlass
                process1={state.process1}
                intensity1={state.intensity1}
                temp1={state.temperature1}
                portion1={state.portion1}
                process2={state.process2}
                intensity2={state.intensity2}
                temp2={state.temperature2}
                portion2={state.portion2}
                size={HERO_GLASS}
                hideVolume
                intensityScale={intensityOpts}
                temperatureScale={temperatureOpts}
              />
            </DrinkStage>
          </div>

          {/* Component 2 */}
          <div className="flex-1 flex flex-col justify-center px-6 py-4">
            <Heading>{t("freestyle.component2")}</Heading>
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
                steppers={{ decrement: t("app.decrease"), increment: t("app.increase") }}
                style={PARAM_ROW_RULE}
              />
              <TokenRow family="intensity" label={t("freestyle.intensity")} options={intensityOpts} value={state.intensity2} onChange={(v) => update("intensity2", v)} disabled={state.process2 !== "coffee"} />
              <TokenRow family="aroma" label={t("freestyle.aroma")} options={aromaOpts} value={state.aroma2} onChange={(v) => update("aroma2", v)} disabled={state.process2 !== "coffee"} />
              <TokenRow family="temperature" label={t("freestyle.temperature")} options={temperatureOpts} value={state.temperature2} onChange={(v) => update("temperature2", v)} disabled={state.process2 === "none"} />
              <TokenRow family="shots" label={t("freestyle.shots")} options={shotsOpts} value={state.shots2} onChange={(v) => update("shots2", v)} disabled={state.process2 !== "coffee"} />
            </div>
          </div>
        </div>
      </Panel>
    </SwipeGuard>
  );
}
