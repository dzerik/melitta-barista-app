import { useCallback, useEffect, useState, useMemo } from "react";
import useEmblaCarousel from "embla-carousel-react";
import type { RecipeDetails } from "../lib/entities";
import {
  RecipeCard,
  shelfMaxMl,
  truthFraction,
  type RecipeCardData,
} from "./RecipeCard";
import { ActionBand, Commit, Dot, Rule } from "./ui";
import { usePreferences } from "../lib/preferences";
import { fmt } from "../lib/brew-plan";

interface Props {
  recipes: RecipeCardData[];
  onSelect: (name: string) => void;
  onBrew: () => void;
  renderInfo: (details: RecipeDetails) => React.ReactNode;
  brewLabel: string;
  columns?: number;
  rows?: number;
}

export function RecipeGrid({ recipes, onSelect, onBrew, renderInfo, brewLabel, columns = 4, rows = 2 }: Props) {
  const { t } = usePreferences();
  const perPage = columns * rows;
  const pages = useMemo(() => {
    const result: RecipeCardData[][] = [];
    for (let i = 0; i < recipes.length; i += perPage) {
      result.push(recipes.slice(i, i + perPage));
    }
    return result;
  }, [recipes, perPage]);

  // §6.3: one shelf, one maximum. Measured across the whole list rather than
  // per page so swiping never resizes a drink.
  const shelfMax = useMemo(() => shelfMaxMl(recipes), [recipes]);

  const startPage = useMemo(() => {
    const idx = recipes.findIndex((r) => r.isSelected);
    return idx >= 0 ? Math.floor(idx / perPage) : 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: false,
    align: "center",
    containScroll: "trimSnaps",
    startIndex: startPage,
  });
  const [selectedPage, setSelectedPage] = useState(startPage);
  const [hoveredRecipe, setHoveredRecipe] = useState<string | null>(null);

  const onEmblaSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedPage(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on("select", onEmblaSelect);
    emblaApi.on("reInit", onEmblaSelect);
    return () => {
      emblaApi.off("select", onEmblaSelect);
      emblaApi.off("reInit", onEmblaSelect);
    };
  }, [emblaApi, onEmblaSelect]);

  const selectedRecipe = recipes.find((r) => r.isSelected);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Page dots ride ON the section rule: the dot stays 8px, its reach does
          not, and the hollow ones interrupt the rule passing behind them. The
          mark is the shared `Dot` — the app had three copies of it, two
          byte-equivalent and one that disagreed (C20, C21). */}
      {pages.length > 1 && (
        <div className="relative flex justify-center shrink-0">
          <Rule rail className="absolute left-0 right-0 top-1/2" />
          {pages.map((_, idx) => (
            <button
              key={idx}
              onClick={() => emblaApi?.scrollTo(idx)}
              aria-label={fmt(t("app.page"), { n: idx + 1 })}
              aria-current={idx === selectedPage ? "true" : undefined}
              className="tap press w-10 relative"
              style={{ borderRadius: 0 }}
            >
              <Dot current={idx === selectedPage} />
            </button>
          ))}
        </div>
      )}

      {/* Swipeable grid pages */}
      <div className="flex-1 min-h-0 overflow-hidden" ref={emblaRef} data-embla-carousel>
        <div className="flex h-full">
          {pages.map((page, pageIdx) => (
            <div
              key={pageIdx}
              className="flex-[0_0_100%] min-w-0 h-full px-2"
            >
              <div
                className="h-full grid content-center gap-3 p-2"
                style={{
                  gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                  gridTemplateRows: `repeat(${rows}, 1fr)`,
                }}
              >
                {page.map((recipe) => (
                  <RecipeCard
                    key={recipe.name}
                    recipe={recipe}
                    active={recipe.isSelected}
                    hovered={hoveredRecipe === recipe.name}
                    iconSize={140}
                    scaleTo={truthFraction(recipe, shelfMax)}
                    onClick={() => onSelect(recipe.name)}
                    onPointerEnter={() => setHoveredRecipe(recipe.name)}
                    onPointerLeave={() => setHoveredRecipe((h) => h === recipe.name ? null : h)}
                    renderInfo={renderInfo}
                    className="pt-3 px-2 pb-2"
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Brew — the one action this screen exists for, in the one arrangement
          every committing screen uses (C10): a 2px `--accent` rule opening the
          band, the rectangle taking the row's whole width.

          The band is drawn whether or not it currently holds a commit, so the
          grid above it never resizes. The commit itself stands down when a
          DirectKey tile holds the screen's one commit rectangle — `isSelected`
          is already `opt === selectedRecipe && !selectedDk` upstream, so no
          recipe is selected while a tile is (H3). */}
      <ActionBand
        inset="rail"
        // The band's height is reserved whether or not it currently holds the
        // commit — the rule, the row's `py-4` and one `--tap-lg` rectangle —
        // so arming a DirectKey tile never resizes the shelf above it.
        style={{ minHeight: "calc(var(--tap-lg) + 2rem + 2px)" }}
        commit={
          selectedRecipe ? <Commit label={brewLabel} onCommit={onBrew} /> : undefined
        }
      />
    </div>
  );
}
