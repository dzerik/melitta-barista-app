import { useState } from "react";
import { Sparkles, Shuffle, Clock } from "lucide-react";
import { usePreferences } from "../lib/preferences";
import type { TranslationKey } from "../lib/i18n";
import type { useSommelier } from "../hooks/useSommelier";
import { SommelierRecipeCard } from "./SommelierRecipeCard";

type SommelierHook = ReturnType<typeof useSommelier>;

interface Props {
  sommelier: SommelierHook;
}

function groupByDate(
  sessions: SommelierHook["history"],
  locale: string,
): [string, SommelierHook["history"]][] {
  const groups = new Map<string, SommelierHook["history"]>();
  for (const s of sessions) {
    // Dates follow the app's language, not the browser's: a Russian UI used
    // to print 9/3/2026.
    const date = new Date(s.created_at).toLocaleDateString(locale, {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const bucket = groups.get(date);
    if (bucket) bucket.push(s);
    else groups.set(date, [s]);
  }
  return [...groups];
}

/**
 * Past suggestions, as drinks you can still order.
 *
 * This was a read-only log — a name in grey with a cross beside it — so the
 * work the sommelier had already done was unreachable: the drink you liked on
 * Tuesday could only be had again by generating until it came back. Every row
 * is now the same card the other two tabs use, with the same Brew and the
 * same ♥.
 */
export function SommelierHistory({ sommelier }: Props) {
  const { t, locale } = usePreferences();
  const { history, favorites, loadMoreHistory, brewRecipe, addFavorite } = sommelier;
  const [brewingId, setBrewingId] = useState<string | null>(null);

  const favIds = new Set(favorites.map((f) => f.source_recipe_id));

  const handleBrew = async (id: string) => {
    setBrewingId(id);
    try {
      await brewRecipe(id);
    } finally {
      setBrewingId(null);
    }
  };

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <Clock size={40} className="text-tertiary opacity-40" />
        <div className="t-body text-tertiary text-center">
          {t("sommelier.no_history" as TranslationKey)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {groupByDate(history, locale).map(([date, sessions]) => (
        <section key={date} className="space-y-4">
          <h2 className="t-label font-medium text-tertiary">{date}</h2>

          {sessions.map((session) => (
            <div key={session.id} className="space-y-3">
              <div className="flex items-center gap-2 text-tertiary">
                {session.mode === "surprise_me" ? (
                  <Shuffle size={16} className="shrink-0" />
                ) : (
                  <Sparkles size={16} className="shrink-0" />
                )}
                <span className="t-label truncate">
                  {session.mode === "surprise_me"
                    ? t("sommelier.surprise_me" as TranslationKey)
                    : session.preference || t("sommelier.generate" as TranslationKey)}
                </span>
                <span className="t-label tabular-nums ml-auto shrink-0">
                  {new Date(session.created_at).toLocaleTimeString(locale, {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>

              <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(26rem, 1fr))" }}>
                {session.recipes.map((recipe) => (
                  <SommelierRecipeCard
                    key={recipe.id}
                    recipe={recipe}
                    onBrew={handleBrew}
                    onFavorite={addFavorite}
                    isFavorited={favIds.has(recipe.id)}
                    brewing={brewingId === recipe.id}
                  />
                ))}
              </div>
            </div>
          ))}
        </section>
      ))}

      {history.length >= 20 && (
        <button
          onClick={loadMoreHistory}
          className="tap tap-lg press w-full rounded-2xl t-body font-medium ring-1 ring-border"
          style={{ background: "var(--surface-card)", color: "var(--text-secondary)" }}
        >
          {t("sommelier.load_more" as TranslationKey)}
        </button>
      )}
    </div>
  );
}
