import { useContext, useState } from "react";
import { ChevronDown, ChevronUp, Coffee, Trash2, Star } from "lucide-react";
import { usePreferences } from "../lib/preferences";
import type { TranslationKey } from "../lib/i18n";
import type { AiRecipe, Favorite, useSommelier } from "../hooks/useSommelier";
import { hasPhasePlan } from "../lib/brew-plan";
import { BrewWizardContext } from "../hooks/useBrewPhase";
import { BrewWizard } from "./BrewWizard";
import { pourSummaries, readableSteps } from "../lib/recipe-summary";

type SommelierHook = ReturnType<typeof useSommelier>;

interface Props {
  sommelier: SommelierHook;
}

/**
 * Saved favorites list.
 *
 * Brew routing mirrors `SommelierRecipeCard`: a favorite carrying
 * `machine_phases` opens the step-machine wizard (multi-phase drinks must
 * not one-shot brew past their manual steps) whenever a host provides the
 * `BrewWizardContext`; everything else keeps the legacy `favorites/brew`
 * path byte-identically.
 */
export function SommelierFavorites({ sommelier }: Props) {
  const { t, locale } = usePreferences();
  const { favorites, brewFavorite, removeFavorite } = sommelier;
  const [brewingId, setBrewingId] = useState<string | null>(null);
  const wizardEnv = useContext(BrewWizardContext);
  const [wizardFav, setWizardFav] = useState<Favorite | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const wizardBrews = (fav: Favorite) => wizardEnv !== null && hasPhasePlan(fav);

  const handleBrew = async (fav: Favorite) => {
    if (wizardBrews(fav)) {
      setWizardFav(fav);
      return;
    }
    setBrewingId(fav.id);
    try { await brewFavorite(fav.id); } finally { setBrewingId(null); }
  };

  if (favorites.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <Star size={40} className="text-tertiary opacity-40" />
        <div className="text-sm text-tertiary text-center">
          {t("sommelier.no_favorites" as TranslationKey)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {favorites.map((fav) => (
        <div
          key={fav.id}
          className="rounded-xl ring-1 ring-border p-4 transition-all duration-200"
          style={{ background: "var(--surface-card)" }}
        >
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-primary truncate">{fav.name}</span>
                {fav.brew_count > 0 && (
                  <span
                    className="shrink-0 t-label font-bold px-1.5 py-0.5 rounded-full tabular-nums"
                    style={{ background: "var(--surface)", color: "var(--text-tertiary)" }}
                  >
                    x{fav.brew_count}
                  </span>
                )}
              </div>
              <p className="text-xs text-secondary mt-1 line-clamp-2">{fav.description}</p>
              {fav.last_brewed_at && (
                <div className="t-label text-tertiary mt-1.5">
                  {t("sommelier.last_brewed" as TranslationKey)}: {new Date(fav.last_brewed_at).toLocaleDateString()}
                </div>
              )}
            </div>

            <div className="flex items-center shrink-0">
              <button
                onClick={() => setOpenId((id) => (id === fav.id ? null : fav.id))}
                aria-expanded={openId === fav.id}
                aria-label={t("sommelier.details" as TranslationKey)}
                className="tap press rounded-xl text-secondary hover:text-primary"
              >
                {openId === fav.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>
              <button
                onClick={() => handleBrew(fav)}
                disabled={brewingId === fav.id}
                className="tap press rounded-xl px-4 t-label font-semibold"
                style={{
                  background: "var(--btn-primary-bg)",
                  color: "var(--btn-primary-text)",
                  opacity: brewingId === fav.id ? 0.5 : 1,
                }}
              >
                {brewingId === fav.id ? "..." : (
                  <span className="flex items-center gap-1.5">
                    <Coffee size={18} />
                    {t("sommelier.brew" as TranslationKey)}
                  </span>
                )}
              </button>
              <button
                onClick={() => removeFavorite(fav.id)}
                className="tap press rounded-xl text-tertiary hover:text-red-400"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>

          {openId === fav.id && (
            <div className="mt-3 pt-3 border-t space-y-2" style={{ borderColor: "var(--border)" }}>
              {fav.reasoning && (
                <div>
                  <div className="t-label font-medium text-primary">
                    {t("sommelier.reasoning" as TranslationKey)}
                  </div>
                  <p className="t-label text-secondary mt-0.5">{fav.reasoning}</p>
                </div>
              )}
              {(() => {
                const steps = readableSteps(locale, fav as never);
                const pours = pourSummaries(locale, fav as never);
                return (
                  <>
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
                    {steps.length === 0 && pours.length > 0 && (
                      <div className="t-label text-secondary">{pours.join("  +  ")}</div>
                    )}
                  </>
                );
              })()}
            </div>
          )}
        </div>
      ))}

      {wizardFav && (
        <BrewWizard
          open
          recipe={{ ...wizardFav, brewed: false } as unknown as AiRecipe}
          source="favorite"
          sourceId={wizardFav.id}
          onClose={() => setWizardFav(null)}
        />
      )}
    </div>
  );
}
