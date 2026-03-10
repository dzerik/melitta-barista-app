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
      {/* Page dots — top */}
      {pages.length > 1 && (
        <div className="flex justify-center gap-1.5 py-2 shrink-0">
          {pages.map((_, idx) => (
            <button
              key={idx}
              onClick={() => emblaApi?.scrollTo(idx)}
              aria-label={`Go to page ${idx + 1}`}
              className="w-1.5 h-1.5 rounded-full transition-all duration-300"
              style={{
                background: idx === selectedPage ? "var(--accent)" : "var(--text-tertiary)",
                opacity: idx === selectedPage ? 1 : 0.3,
                transform: idx === selectedPage ? "scale(1.3)" : "scale(1)",
              }}
            />
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

      {/* Brew button */}
      {selectedRecipe && (
        <div className="flex justify-center shrink-0 px-1">
          <button
            className="py-2.5 px-8 text-xs tracking-widest uppercase font-semibold transition-all duration-200 active:scale-[0.98]"
            style={{
              background: "var(--recipe-label-bg)",
              color: "var(--recipe-label-text)",
              letterSpacing: "0.12em",
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
