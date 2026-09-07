import { useState } from "react";
import { Star } from "lucide-react";
import { usePreferences } from "../lib/preferences";
import type { TranslationKey } from "../lib/i18n";
import type { AiRecipe, Favorite, useSommelier } from "../hooks/useSommelier";
import { fmt } from "../lib/brew-plan";
import { Glyph } from "./ui";
import {
  SommelierRecipeCard,
  SommelierShelf,
  shelfScale,
  SOMMELIER_COLUMNS,
} from "./SommelierRecipeCard";

type SommelierHook = ReturnType<typeof useSommelier>;

/** §G2.4b — the favourites tab is the full paged matrix, four across, two down. */
const ROWS = 2;

interface Props {
  sommelier: SommelierHook;
}

/**
 * Saved favourites, as the paged 4×2 drink matrix every other shelf in the app
 * uses. Rendered by the shared recipe card, so a favourite looks like the
 * suggestion it came from. Brewing goes through `favorites/brew` (which is
 * what keeps the brew count), except for multi-phase drinks, where the card
 * opens the step wizard — those must not one-shot brew past their manual
 * steps.
 */
export function SommelierFavorites({ sommelier }: Props) {
  const { t, locale } = usePreferences();
  const { favorites, brewFavorite, removeFavorite } = sommelier;
  const [brewingId, setBrewingId] = useState<string | null>(null);

  const handleBrew = async (id: string) => {
    setBrewingId(id);
    try {
      await brewFavorite(id);
    } finally {
      setBrewingId(null);
    }
  };

  /** "Brewed 3× · last on 2 September" — empty until it has been brewed. */
  const metaLine = (fav: Favorite): string | null => {
    if (!fav.brew_count) return null;
    const times = fmt(t("sommelier.brewed_times" as TranslationKey), { n: fav.brew_count });
    if (!fav.last_brewed_at) return times;
    const date = new Date(fav.last_brewed_at).toLocaleDateString(locale, {
      day: "numeric",
      month: "long",
    });
    return `${times} · ${t("sommelier.last_brewed" as TranslationKey)} ${date}`;
  };

  // §6.3 — every glass on this shelf is measured against the same maximum.
  const favScale = shelfScale(favorites as never[]);

  if (favorites.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        {/* §6.6 / C27 — the empty-page mark is the shared `Glyph`, the same
            box and the same ink whether it is drawn from a raster asset or a
            lucide node. The sommelier empties used to be a third size. */}
        <Glyph size="state" alt="" className="text-tertiary">
          <Star size={40} strokeWidth={1.75} />
        </Glyph>
        <div className="t-body text-tertiary text-center">
          {t("sommelier.no_favorites" as TranslationKey)}
        </div>
      </div>
    );
  }

  return (
    <SommelierShelf
      items={favorites}
      perPage={SOMMELIER_COLUMNS * ROWS}
      cellKey={(fav) => fav.id}
      renderCell={(fav) => (
        <SommelierRecipeCard
          recipe={fav as unknown as AiRecipe}
          onBrew={handleBrew}
          onRemove={removeFavorite}
          brewing={brewingId === fav.id}
          meta={metaLine(fav)}
          scaleTo={favScale(fav as never)}
        />
      )}
    />
  );
}
