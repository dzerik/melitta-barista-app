import { useContext, useState } from "react";
import { Heart, ChevronDown, ChevronUp, Check, Snowflake, Trash2 } from "lucide-react";
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
 * favourite, or a row out of the history.
 *
 * Drawn in the idiom of the machine's own screen: the drink lit against the
 * dark ground, its name large and light, and what it is made of read as a
 * strip of values divided by hairlines. No outlined capsules and no boxes
 * inside boxes — a rule separates one drink from the next.
 *
 * The glass is the served `icon` IconSpec (§3.9), drawn by the same renderer
 * the recipe catalog uses.
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

  const extras = recipe.extras;
  const steps = expanded ? readableSteps(locale, recipe as never) : [];
  const hopper = hopperNumber(recipe);

  // Everything the drink is made of, as one strip of values.
  const facts: string[] = [...pourSummaries(locale, recipe as never)];
  const addIns = ([["syrup_", extras?.syrup], ["topping_", extras?.topping], ["liqueur_", extras?.liqueur]] as const)
    .filter(([, value]) => Boolean(value))
    .map(([prefix, value]) => suggestionLabel(locale, prefix, value as string));
  if (addIns.length > 0) facts.push(addIns.join(" · "));
  // Caffeine and calories are for the reader who opens the details; the strip
  // stays one line, because a divided strip that wraps orphans its rules.

  return (
    <article
      className="h-full flex flex-col border-t pt-4 pb-3"
      style={{ borderColor: "var(--border)" }}
    >
      <div className="flex items-start gap-5">
        {/* The drink, lit against the ground — the way the machine shows it. */}
        <CoffeeIcon recipe={recipe.name} size={84} icon={recipe.icon} />

        <div className="flex-1 min-w-0">
          {meta && <div className="t-label text-tertiary tabular-nums">{meta}</div>}
          <div className="flex items-center gap-2">
            <h3 className="t-title font-light text-primary truncate">{recipe.name}</h3>
            {recipe.brewed && (
              <Check size={16} className="shrink-0" style={{ color: "var(--success)" }} />
            )}
            {extras?.ice && (
              <Snowflake size={16} className="shrink-0" style={{ color: "var(--info, #60a5fa)" }} />
            )}
          </div>
          <p className="t-label text-secondary mt-1.5 line-clamp-2 max-w-prose">
            {recipe.description}
          </p>

          {facts.length > 0 && (
            <div className="flex items-center mt-3 min-w-0 overflow-hidden">
              {facts.map((fact, i) => (
                <span
                  key={fact}
                  className={`t-label text-tertiary whitespace-nowrap truncate ${i > 0 ? "border-l pl-3 ml-3" : ""}`}
                  style={i > 0 ? { borderColor: "var(--border)" } : undefined}
                >
                  {fact}
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
            className="tap press shrink-0"
            style={{ color: isFavorited ? "var(--accent)" : "var(--text-tertiary)" }}
          >
            <Heart size={18} fill={isFavorited ? "currentColor" : "none"} />
          </button>
        )}
      </div>

      <div className="mt-auto pt-3 flex items-center gap-4">
        <button
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          className="tap press flex items-center gap-1.5 t-label text-tertiary hover:text-secondary"
        >
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          {t("sommelier.details" as TranslationKey)}
        </button>

        <div className="ml-auto flex items-center gap-3">
          {onRemove && (
            <button
              onClick={() => onRemove(recipe.id)}
              aria-label={t("sommelier.remove" as TranslationKey)}
              className="tap press text-tertiary hover:text-primary"
            >
              <Trash2 size={18} />
            </button>
          )}
          <button
            onClick={() => (wizardBrew ? setWizardOpen(true) : onBrew(recipe.id))}
            disabled={brewing}
            className="tap press rounded-md px-6 t-label font-semibold tracking-wide"
            style={{
              background: "var(--btn-primary-bg)",
              color: "var(--btn-primary-text)",
              opacity: brewing ? 0.5 : 1,
            }}
          >
            {brewing ? t("sommelier.brewing" as TranslationKey) : t("sommelier.brew" as TranslationKey)}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t space-y-3" style={{ borderColor: "var(--border)" }}>
          {/* The sommelier's own justification, first — it is the answer to
              the question the user is actually asking of this card. */}
          {recipe.reasoning && (
            <div>
              <div className="t-label text-tertiary">
                {t("sommelier.reasoning" as TranslationKey)}
              </div>
              <p className="t-label text-secondary mt-1 max-w-prose">{recipe.reasoning}</p>
            </div>
          )}

          {steps.length > 0 && (
            <div>
              <div className="t-label text-tertiary">
                {t("sommelier.steps" as TranslationKey)}
              </div>
              <ol className="mt-1.5 space-y-1.5 max-w-prose">
                {steps.map((line, i) => (
                  <li key={i} className="t-label text-secondary flex gap-3">
                    <span className="tabular-nums" style={{ color: "var(--accent)" }}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span>{line}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {(recipe.estimated_caffeine || recipe.calories_approx != null) && (
            <div className="flex items-center">
              {recipe.estimated_caffeine && (
                <span className="t-label text-tertiary">
                  {t("sommelier.caffeine" as TranslationKey)}:{" "}
                  <span className="text-secondary">{recipe.estimated_caffeine}</span>
                </span>
              )}
              {recipe.calories_approx != null && (
                <span
                  className={`t-label text-tertiary ${recipe.estimated_caffeine ? "border-l pl-3 ml-3" : ""}`}
                  style={recipe.estimated_caffeine ? { borderColor: "var(--border)" } : undefined}
                >
                  <span className="text-secondary">~{recipe.calories_approx}</span>{" "}
                  {t("sommelier.calories" as TranslationKey)}
                </span>
              )}
            </div>
          )}

          {hopper !== null && (
            <div className="t-label text-tertiary">
              {t("sommelier.blend" as TranslationKey)}:{" "}
              <span className="text-secondary">
                {t(`sommelier.hopper${hopper}` as TranslationKey)}
              </span>
            </div>
          )}

          {extras?.instruction && (
            <div className="t-label text-tertiary">
              {t("sommelier.instruction" as TranslationKey)}:{" "}
              <span className="text-secondary">{extras.instruction}</span>
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
    </article>
  );
}
