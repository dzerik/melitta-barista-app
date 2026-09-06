import { useContext, useState } from "react";
import { Heart, Coffee, ChevronDown, ChevronUp, Check, Snowflake, Info, Trash2 } from "lucide-react";
import { usePreferences } from "../lib/preferences";
import type { TranslationKey } from "../lib/i18n";
import type { AiRecipe } from "../hooks/useSommelier";
import { hasPhasePlan } from "../lib/brew-plan";
import { BrewWizardContext } from "../hooks/useBrewPhase";
import { BrewWizard } from "./BrewWizard";
import { CoffeeIcon } from "./CoffeeIcon";
import { suggestionLabel } from "../lib/sommelier-vocab";
import { pourSummaries, readableSteps, hopperNumber } from "../lib/recipe-summary";

interface Props {
  recipe: AiRecipe;
  onBrew: (id: string) => void;
  /** Omitted where favouriting makes no sense (the favourites list itself). */
  onFavorite?: (id: string) => void;
  /** Only the favourites list can remove a favourite. */
  onRemove?: (id: string) => void;
  isFavorited?: boolean;
  brewing?: boolean;
  /** A quiet line above the name: the time it was suggested, times brewed. */
  meta?: string | null;
}

/**
 * One sommelier recipe, wherever it appears — a fresh suggestion, a saved
 * favourite, or a row out of the history. The three lists used to draw three
 * different things from the same data; a drink is a drink, so they now share
 * this card and differ only in which actions they hand it.
 *
 * The glass is the served `icon` IconSpec (§3.9), drawn by the same renderer
 * the recipe catalog uses — the sommelier's drinks look like the machine's
 * drinks because they are described the same way.
 *
 * The Brew button routes per Zone P-H: when the hosting section provides a
 * `BrewWizardContext` AND the row carries `machine_phases` (0.89+ servers),
 * it opens the step-machine `BrewWizard` — multi-phase recipes must not
 * one-shot brew. Otherwise (pre-contract rows, or no wizard host) it keeps
 * the legacy one-shot `onBrew` path, byte-identically.
 */
export function SommelierRecipeCard({
  recipe,
  onBrew,
  onFavorite,
  onRemove,
  isFavorited,
  brewing,
  meta = null,
}: Props) {
  const { t, locale } = usePreferences();
  const [expanded, setExpanded] = useState(false);
  const wizardEnv = useContext(BrewWizardContext);
  const [wizardOpen, setWizardOpen] = useState(false);
  const wizardBrew = wizardEnv !== null && hasPhasePlan(recipe);

  const summary = pourSummaries(locale, recipe as never).join(" + ");
  const extras = recipe.extras;
  const steps = expanded ? readableSteps(locale, recipe as never) : [];
  const hopper = hopperNumber(recipe);

  const badges: string[] = [];
  if (recipe.estimated_caffeine) {
    badges.push(`${t("sommelier.caffeine" as TranslationKey)}: ${recipe.estimated_caffeine}`);
  }
  if (recipe.calories_approx != null) {
    badges.push(`~${recipe.calories_approx} ${t("sommelier.calories" as TranslationKey)}`);
  }
  const addIns = ([["syrup_", extras?.syrup], ["topping_", extras?.topping], ["liqueur_", extras?.liqueur]] as const)
    .filter(([, value]) => Boolean(value))
    .map(([prefix, value]) => suggestionLabel(locale, prefix, value as string));

  // Full height with the footer pinned to the bottom, so the action bars of
  // neighbouring cards line up instead of floating mid-card.
  return (
    <div
      className="h-full flex flex-col rounded-2xl ring-1 ring-border overflow-hidden transition-all duration-200"
      style={{ background: "var(--surface-card)" }}
    >
      <div className="flex items-start gap-4 p-4">
        {/* The drink itself, drawn from what it is made of. */}
        <div className="shrink-0 pt-0.5">
          <CoffeeIcon recipe={recipe.name} size={64} icon={recipe.icon} />
        </div>

        <div className="flex-1 min-w-0">
          {meta && <div className="t-label text-tertiary mb-0.5 tabular-nums">{meta}</div>}
          <div className="flex items-center gap-2">
            <h3 className="t-body font-semibold text-primary truncate">{recipe.name}</h3>
            {recipe.brewed && (
              <Check size={16} className="shrink-0" style={{ color: "var(--success)" }} />
            )}
            {extras?.ice && (
              <Snowflake size={16} className="shrink-0" style={{ color: "var(--info, #60a5fa)" }} />
            )}
          </div>
          <p className="t-label text-secondary mt-1 line-clamp-2 max-w-prose">{recipe.description}</p>
          {summary && <p className="t-label text-tertiary mt-1.5">{summary}</p>}

          {(addIns.length > 0 || badges.length > 0) && (
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              {addIns.map((label) => (
                <span
                  key={label}
                  className="t-label px-2.5 py-1 rounded-full"
                  style={{ background: "var(--surface)", color: "var(--text-secondary)" }}
                >
                  {label}
                </span>
              ))}
              {badges.map((label) => (
                <span key={label} className="t-label text-tertiary">
                  {label}
                </span>
              ))}
            </div>
          )}
        </div>

        {onFavorite && (
          <button
            onClick={() => onFavorite(recipe.id)}
            aria-pressed={isFavorited}
            aria-label={t("sommelier.favorite" as TranslationKey)}
            className="tap press rounded-xl shrink-0"
            style={{ color: isFavorited ? "var(--error-text)" : "var(--text-tertiary)" }}
          >
            <Heart size={18} fill={isFavorited ? "currentColor" : "none"} />
          </button>
        )}
      </div>

      <div
        className="mt-auto flex items-center gap-2 px-2 border-t"
        style={{ borderColor: "var(--border)" }}
      >
        <button
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          className="tap press rounded-xl px-2 flex items-center gap-1.5 t-label text-tertiary hover:text-secondary"
        >
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          {t("sommelier.details" as TranslationKey)}
        </button>

        <div className="ml-auto flex items-center gap-1">
          {onRemove && (
            <button
              onClick={() => onRemove(recipe.id)}
              aria-label={t("sommelier.remove" as TranslationKey)}
              className="tap press rounded-xl text-tertiary hover:text-primary"
            >
              <Trash2 size={18} />
            </button>
          )}
          <button
            onClick={() => (wizardBrew ? setWizardOpen(true) : onBrew(recipe.id))}
            disabled={brewing}
            className="tap press rounded-xl px-4 my-2 t-label font-semibold"
            style={{
              background: "var(--btn-primary-bg)",
              color: "var(--btn-primary-text)",
              opacity: brewing ? 0.5 : 1,
            }}
          >
            <span className="flex items-center gap-1.5">
              <Coffee size={18} />
              {brewing ? t("sommelier.brewing" as TranslationKey) : t("sommelier.brew" as TranslationKey)}
            </span>
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-3" style={{ background: "var(--surface)" }}>
          {/* The sommelier's own justification, first — it is the answer to
              the question the user is actually asking of this card. */}
          {recipe.reasoning && (
            <div className="pt-3">
              <div className="t-label font-medium text-primary">
                {t("sommelier.reasoning" as TranslationKey)}
              </div>
              <p className="t-label text-secondary mt-0.5 max-w-prose">{recipe.reasoning}</p>
            </div>
          )}

          {steps.length > 0 && (
            <div className={recipe.reasoning ? "" : "pt-3"}>
              <div className="t-label font-medium text-primary">
                {t("sommelier.steps" as TranslationKey)}
              </div>
              <ol className="mt-1 space-y-1 list-decimal list-inside max-w-prose">
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

          {extras?.instruction && (
            <div className="flex items-start gap-1.5">
              <Info size={16} className="shrink-0 mt-0.5" style={{ color: "var(--text-tertiary)" }} />
              <span className="t-label text-secondary max-w-prose">
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
