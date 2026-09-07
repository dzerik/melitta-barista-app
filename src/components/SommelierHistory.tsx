import { useState } from "react";
import { Sparkles, Shuffle, Clock } from "lucide-react";
import { usePreferences } from "../lib/preferences";
import type { TranslationKey } from "../lib/i18n";
import type { useSommelier } from "../hooks/useSommelier";
import { Glyph, Rule, Word } from "./ui";
import {
  SommelierRecipeCard,
  SommelierMatrix,
  SommelierPager,
  shelfScale,
  SOMMELIER_COLUMNS,
} from "./SommelierRecipeCard";

type SommelierHook = ReturnType<typeof useSommelier>;

/** §G2.4b — a session's drinks lay out on the same 4×2 page as every shelf. */
const ROWS = 2;
const PER_PAGE = SOMMELIER_COLUMNS * ROWS;

/**
 * A session's drinks, split across pages if a generation was ever larger than
 * one shelf. History cannot use `SommelierShelf`: each of its pages is headed
 * by the generation it belongs to, so it assembles its own.
 */
function chunk<T>(items: T[], perPage: number): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += perPage) pages.push(items.slice(i, i + perPage));
  return pages.length > 0 ? pages : [[]];
}

interface Props {
  sommelier: SommelierHook;
}

/**
 * Past suggestions, as drinks you can still order.
 *
 * This was a read-only log — a name in grey with a cross beside it — so the
 * work the sommelier had already done was unreachable: the drink you liked on
 * Tuesday could only be had again by generating until it came back. Every row
 * is now the same drink cell the other two tabs use, with the same Brew and
 * the same ♥.
 *
 * One generation is one page (§G2.2: a tab overflows by paging, never by
 * scrolling), headed by what was asked for and when. The date is printed only
 * when it changes from the page before, which is what the date groupings used
 * to do — and it follows the app's language, not the browser's: a Russian UI
 * used to print 9/3/2026.
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
      <div className="flex h-full flex-col items-center justify-center gap-4">
        {/* §6.6 / C27 — one box, one ink, whichever mark stands in it. */}
        <Glyph size="state" alt="" className="text-tertiary">
          <Clock size={40} strokeWidth={1.75} />
        </Glyph>
        <div className="t-body text-tertiary text-center">
          {t("sommelier.no_history" as TranslationKey)}
        </div>
      </div>
    );
  }

  let lastDate: string | null = null;
  const pages = history.flatMap((session) => {
    const when = new Date(session.created_at);
    const date = when.toLocaleDateString(locale, {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const time = when.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
    const showDate = date !== lastDate;
    lastDate = date;
    const ModeIcon = session.mode === "surprise_me" ? Shuffle : Sparkles;
    // §6.3 — one generation is one shelf, so it carries its own maximum.
    const sessionScale = shelfScale(session.recipes as never[]);
    const brief =
      session.mode === "surprise_me"
        ? t("sommelier.surprise_me" as TranslationKey)
        : session.preference || t("sommelier.generate" as TranslationKey);

    return chunk(session.recipes, PER_PAGE).map((page, part) => (
      <div key={`${session.id}-${part}`} className="flex h-full min-h-0 flex-col">
        <div className="flex shrink-0 items-center gap-2 pb-1.5 text-tertiary">
          <ModeIcon size={16} className="shrink-0" aria-hidden="true" />
          <span className="t-label truncate">{brief}</span>
          {showDate && part === 0 && (
            <span className="t-label num ml-auto shrink-0">{date}</span>
          )}
          <span
            className={`t-label num shrink-0 ${showDate && part === 0 ? "" : "ml-auto"}`}
          >
            {time}
          </span>
        </div>
        <Rule />
        <div className="min-h-0 flex-1">
          <SommelierMatrix>
            {page.map((recipe) => (
              <SommelierRecipeCard
                key={recipe.id}
                recipe={recipe}
                onBrew={handleBrew}
                onFavorite={addFavorite}
                isFavorited={favIds.has(recipe.id)}
                brewing={brewingId === recipe.id}
                scaleTo={sessionScale(recipe as never)}
              />
            ))}
          </SommelierMatrix>
        </div>
      </div>
    ));
  });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1">
        <SommelierPager pages={pages} />
      </div>

      {/* Not a commit and not a slab: one more page of the log is a word —
          the shared one, and bare, because an underline in this language
          means "chosen" rather than "tappable" (C5). */}
      {history.length >= 20 && (
        <div className="flex shrink-0 justify-center py-1">
          <Word
            label={t("sommelier.load_more" as TranslationKey)}
            onClick={loadMoreHistory}
          />
        </div>
      )}
    </div>
  );
}
