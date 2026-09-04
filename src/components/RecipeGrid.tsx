import { useCallback, useEffect, useState, useMemo } from "react";
import useEmblaCarousel from "embla-carousel-react";
import type { RecipeDetails } from "../lib/entities";
import { RecipeCard, type RecipeCardData } from "./RecipeCard";

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
  const perPage = columns * rows;
  const pages = useMemo(() => {
    const result: RecipeCardData[][] = [];
    for (let i = 0; i < recipes.length; i += perPage) {
      result.push(recipes.slice(i, i + perPage));
    }
    return result;
  }, [recipes, perPage]);

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
    <div className="flex flex-col h-full">
      {/* Page dots — the dot stays small, its reach does not */}
      {pages.length > 1 && (
        <div className="flex justify-center shrink-0">
          {pages.map((_, idx) => (
            <button
              key={idx}
              onClick={() => emblaApi?.scrollTo(idx)}
              aria-label={`Go to page ${idx + 1}`}
              aria-current={idx === selectedPage ? "true" : undefined}
              className="tap press w-10"
            >
              <span
                className="block rounded-full transition-all duration-300"
                style={{
                  width: idx === selectedPage ? 22 : 8,
                  height: 8,
                  background: idx === selectedPage ? "var(--accent)" : "var(--text-tertiary)",
                  opacity: idx === selectedPage ? 1 : 0.4,
                }}
              />
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
                    dimInactive={false}
                    iconSize={140}
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

      {/* Brew — the one action this screen exists for, so it gets the width
          and the only saturated colour on the page. */}
      {selectedRecipe && (
        <div className="shrink-0 px-4 pb-3 pt-1 flex justify-center">
          <button
            className="tap tap-lg press w-full max-w-xl mx-auto rounded-2xl t-title"
            style={{
              background: "var(--btn-primary-bg)",
              color: "var(--btn-primary-text)",
              boxShadow: "var(--shadow-lift)",
            }}
            onClick={onBrew}
          >
            {brewLabel}
          </button>
        </div>
      )}
    </div>
  );
}
