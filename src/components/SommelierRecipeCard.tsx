import { useContext, useState } from "react";
import { Heart, Coffee, ChevronDown, ChevronUp, Check, Snowflake, Info } from "lucide-react";
import { usePreferences } from "../lib/preferences";
import type { TranslationKey } from "../lib/i18n";
import type { AiRecipe } from "../hooks/useSommelier";
import { hasPhasePlan } from "../lib/brew-plan";
import { BrewWizardContext } from "../hooks/useBrewPhase";
import { BrewWizard } from "./BrewWizard";
import { suggestionLabel } from "../lib/sommelier-vocab";
import { pourSummaries, readableSteps, hopperNumber } from "../lib/recipe-summary";

interface Props {
  recipe: AiRecipe;
  onBrew: (id: string) => void;
  onFavorite: (id: string) => void;
  isFavorited?: boolean;
  brewing?: boolean;
}

/**
 * One generated sommelier recipe card.
 *
 * The Brew button routes per Zone P-H: when the hosting section provides a
 * `BrewWizardContext` AND the row carries `machine_phases` (0.89+ servers),
 * it opens the step-machine `BrewWizard` — multi-phase recipes must not
 * one-shot brew. Otherwise (pre-contract rows, or no wizard host) it keeps
 * the legacy one-shot `onBrew` path, byte-identically.
 */
export function SommelierRecipeCard({ recipe, onBrew, onFavorite, isFavorited, brewing }: Props) {
  const { t, locale } = usePreferences();
  const [expanded, setExpanded] = useState(false);
  const wizardEnv = useContext(BrewWizardContext);
  const [wizardOpen, setWizardOpen] = useState(false);
  const wizardBrew = wizardEnv !== null && hasPhasePlan(recipe);

  const summary = pourSummaries(locale, recipe as never).join("  +  ");

  const extras = recipe.extras;
  const steps = expanded ? readableSteps(locale, recipe as never) : [];
  const hopper = hopperNumber(recipe);

  return (
    <div
      className="rounded-2xl ring-1 ring-border p-4 transition-all duration-200"
      style={{ background: "var(--surface-card)" }}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-primary truncate">{recipe.name}</span>
            {recipe.brewed && (
              <Check size={18} className="shrink-0" style={{ color: "var(--success)" }} />
            )}
            {extras?.ice && (
              <Snowflake size={18} className="shrink-0" style={{ color: "var(--info, #60a5fa)" }} />
            )}
          </div>
          <p className="text-xs text-secondary mt-1 line-clamp-2">{recipe.description}</p>
          <p className="t-label text-tertiary mt-1.5 font-mono">{summary}</p>

          {/* Extras tags */}
          {extras && (extras.syrup || extras.topping || extras.liqueur || extras.ice) && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {([["syrup_", extras.syrup], ["topping_", extras.topping], ["liqueur_", extras.liqueur]] as const)
                .filter(([, value]) => Boolean(value))
                .map(([prefix, value]) => (
                  <span
                    key={prefix}
                    className="t-label px-2.5 py-1 rounded-full"
                    style={{ background: "var(--surface)", color: "var(--text-secondary)" }}
                  >
                    {suggestionLabel(locale, prefix, value as string)}
                  </span>
                ))}
            </div>
          )}

          {/* Caffeine & Calories badges */}
          {(recipe.estimated_caffeine || recipe.calories_approx != null) && (
            <div className="flex items-center gap-2 mt-1.5">
              {recipe.estimated_caffeine && (
                <span className="t-label px-1.5 py-0.5 rounded-full font-medium" style={{ background: "var(--surface)", color: "var(--text-tertiary)" }}>
                  {t("sommelier.caffeine" as TranslationKey)}: {recipe.estimated_caffeine}
                </span>
              )}
              {recipe.calories_approx != null && (
                <span className="t-label px-1.5 py-0.5 rounded-full font-medium" style={{ background: "var(--surface)", color: "var(--text-tertiary)" }}>
                  ~{recipe.calories_approx} {t("sommelier.calories" as TranslationKey)}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => onFavorite(recipe.id)}
            className="p-2 rounded-lg transition active:scale-95"
            style={{ color: isFavorited ? "var(--error-text)" : "var(--text-tertiary)" }}
          >
            <Heart size={18} fill={isFavorited ? "currentColor" : "none"} />
          </button>
          <button
            onClick={() => (wizardBrew ? setWizardOpen(true) : onBrew(recipe.id))}
            disabled={brewing}
            className="tap press rounded-xl px-4 t-label font-semibold"
            style={{
              background: "var(--btn-primary-bg)",
              color: "var(--btn-primary-text)",
              opacity: brewing ? 0.5 : 1,
            }}
          >
            {brewing ? "..." : (
              <span className="flex items-center gap-1.5">
                <Coffee size={18} />
                {t("sommelier.brew" as TranslationKey)}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Expandable details */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="mt-2 flex items-center gap-1 t-label text-tertiary hover:text-secondary transition"
      >
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        {t("sommelier.details" as TranslationKey)}
      </button>

      {expanded && (
        <div className="mt-2 pt-2 border-t space-y-2" style={{ borderColor: "var(--border)" }}>
          {/* The sommelier's own justification, first — it is the answer to
              the question the user is actually asking of this card. */}
          {recipe.reasoning && (
            <div>
              <div className="t-label font-medium text-primary">
                {t("sommelier.reasoning" as TranslationKey)}
              </div>
              <p className="t-label text-secondary mt-0.5">{recipe.reasoning}</p>
            </div>
          )}

          {steps.length > 0 && (
            <div>
              <div className="t-label font-medium text-primary">
                {t("sommelier.steps" as TranslationKey)}
              </div>
              <ol className="mt-1 space-y-1 list-decimal list-inside">
                {steps.map((line, i) => (
                  <li key={i} className="t-label text-secondary">{line}</li>
                ))}
              </ol>
            </div>
          )}

          {hopper !== null && (
            <div className="t-label text-tertiary">
              {t("sommelier.blend" as TranslationKey)}:{" "}
              {t(`sommelier.hopper${hopper}` as TranslationKey)}
            </div>
          )}

          {/* Extras instruction */}
          {extras?.instruction && (
            <div className="flex items-start gap-1.5">
              <Info size={16} className="shrink-0 mt-0.5" style={{ color: "var(--text-tertiary)" }} />
              <span className="t-label text-secondary italic">
                {t("sommelier.instruction" as TranslationKey)}: {extras.instruction}
              </span>
            </div>
          )}
        </div>
      )}

      {wizardBrew && (
        <BrewWizard
          open={wizardOpen}
          recipe={recipe}
          onClose={() => setWizardOpen(false)}
        />
      )}
    </div>
  );
}
