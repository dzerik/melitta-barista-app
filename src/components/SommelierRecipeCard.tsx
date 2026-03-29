import { useState } from "react";
import { Heart, Coffee, ChevronDown, ChevronUp, Check, Snowflake, Info } from "lucide-react";
import { usePreferences } from "../lib/preferences";
import type { TranslationKey } from "../lib/i18n";
import type { AiRecipe } from "../hooks/useSommelier";

interface Props {
  recipe: AiRecipe;
  onBrew: (id: string) => void;
  onFavorite: (id: string) => void;
  isFavorited?: boolean;
  brewing?: boolean;
}

export function SommelierRecipeCard({ recipe, onBrew, onFavorite, isFavorited, brewing }: Props) {
  const { t } = usePreferences();
  const [expanded, setExpanded] = useState(false);

  const c1 = recipe.component1;
  const c2 = recipe.component2;
  const summary = [
    c1.process !== "none" && `${c1.process} ${c1.intensity} ${c1.portion_ml}ml`,
    c2.process !== "none" && `${c2.process} ${c2.portion_ml}ml`,
  ].filter(Boolean).join(" + ");

  const extras = recipe.extras;

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
              <Check size={14} className="shrink-0" style={{ color: "var(--success)" }} />
            )}
            {extras?.ice && (
              <Snowflake size={14} className="shrink-0" style={{ color: "var(--info, #60a5fa)" }} />
            )}
          </div>
          <p className="text-xs text-secondary mt-1 line-clamp-2">{recipe.description}</p>
          <p className="text-[11px] text-tertiary mt-1.5 font-mono">{summary}</p>

          {/* Extras tags */}
          {extras && (extras.syrup || extras.topping || extras.liqueur || extras.ice) && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {extras.syrup && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "var(--surface)", color: "var(--text-tertiary)" }}>
                  {extras.syrup}
                </span>
              )}
              {extras.topping && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "var(--surface)", color: "var(--text-tertiary)" }}>
                  {extras.topping}
                </span>
              )}
              {extras.liqueur && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "var(--surface)", color: "var(--text-tertiary)" }}>
                  {extras.liqueur}
                </span>
              )}
            </div>
          )}

          {/* Caffeine & Calories badges */}
          {(recipe.estimated_caffeine || recipe.calories_approx != null) && (
            <div className="flex items-center gap-2 mt-1.5">
              {recipe.estimated_caffeine && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: "var(--surface)", color: "var(--text-tertiary)" }}>
                  {t("sommelier.caffeine" as TranslationKey)}: {recipe.estimated_caffeine}
                </span>
              )}
              {recipe.calories_approx != null && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: "var(--surface)", color: "var(--text-tertiary)" }}>
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
            onClick={() => onBrew(recipe.id)}
            disabled={brewing}
            className="rounded-xl px-3 py-2 text-xs font-semibold transition active:scale-95"
            style={{
              background: "var(--btn-primary-bg)",
              color: "var(--btn-primary-text)",
              opacity: brewing ? 0.5 : 1,
            }}
          >
            {brewing ? "..." : (
              <span className="flex items-center gap-1.5">
                <Coffee size={14} />
                {t("sommelier.brew" as TranslationKey)}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Expandable details */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="mt-2 flex items-center gap-1 text-[11px] text-tertiary hover:text-secondary transition"
      >
        {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        {t("sommelier.details" as TranslationKey)}
      </button>

      {expanded && (
        <div className="mt-2 pt-2 border-t space-y-1.5" style={{ borderColor: "var(--border)" }}>
          {[recipe.component1, recipe.component2].map((comp, i) => (
            comp.process !== "none" && (
              <div key={i} className="text-[11px] text-secondary">
                <span className="font-medium text-primary">
                  {t(`sommelier.component${i + 1}` as TranslationKey)}:
                </span>{" "}
                {comp.process} / {comp.intensity} / {comp.aroma} / {comp.temperature} / {comp.shots} / {comp.portion_ml}ml
              </div>
            )
          ))}
          <div className="text-[11px] text-tertiary">
            {t("sommelier.blend" as TranslationKey)}: {recipe.blend}%
          </div>

          {/* Extras instruction */}
          {extras?.instruction && (
            <div className="flex items-start gap-1.5 mt-1">
              <Info size={12} className="shrink-0 mt-0.5" style={{ color: "var(--text-tertiary)" }} />
              <span className="text-[11px] text-secondary italic">
                {t("sommelier.instruction" as TranslationKey)}: {extras.instruction}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
