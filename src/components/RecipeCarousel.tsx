import { useCallback, useEffect, useState, useMemo } from "react";
import useEmblaCarousel from "embla-carousel-react";
import type { RecipeDetails } from "../lib/entities";
import { CoffeeIcon } from "./CoffeeIcon";

interface RecipeSlide {
  name: string;
  isSelected: boolean;
  details?: RecipeDetails;
}

interface Props {
  recipes: RecipeSlide[];
  /** Called when user explicitly clicks a non-selected recipe (first tap). */
  onSelect: (name: string) => void;
  /** Called when user clicks an already-selected recipe (second tap = brew). */
  onBrew: (name: string) => void;
  renderInfo: (details: RecipeDetails) => React.ReactNode;
  brewLabel: string;
}

const MAX_DOTS = 10;

export function RecipeCarousel({ recipes, onSelect, onBrew, renderInfo, brewLabel }: Props) {
  const startIndex = useMemo(
    () => Math.max(0, recipes.findIndex((r) => r.isSelected)),
    // Only compute on mount — recipe list is cached and stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: false,
    align: "center",
    containScroll: "trimSnaps",
    dragFree: false,
    startIndex,
  });
  const [selectedSnap, setSelectedSnap] = useState(startIndex);

  const onEmblaSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedSnap(emblaApi.selectedScrollSnap());
    // NOTE: we intentionally do NOT call onSelect here.
    // Swiping only changes the visual position, not the HA entity.
    // This matches Grid/List behavior where selection requires an explicit click.
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

  const handleSlideClick = useCallback(
    (idx: number, recipe: RecipeSlide) => {
      if (idx !== selectedSnap) {
        // Tapped a side slide — just scroll to it
        emblaApi?.scrollTo(idx);
        return;
      }
      // Tapped the center slide
      if (recipe.isSelected) {
        // Already selected in HA — brew
        onBrew(recipe.name);
      } else {
        // Not yet selected in HA — select it
        onSelect(recipe.name);
      }
    },
    [selectedSnap, emblaApi, onBrew, onSelect],
  );

  const showDots = recipes.length > 1 && recipes.length <= MAX_DOTS;
  const showCounter = recipes.length > MAX_DOTS;

  return (
    <div className="flex flex-col h-full">
      {/* Carousel */}
      <div className="flex-1 min-h-0 flex items-center" data-embla-carousel>
        <div className="overflow-hidden w-full" ref={emblaRef}>
          <div className="flex">
            {recipes.map((recipe, idx) => {
              const isCurrent = idx === selectedSnap;
              return (
                <div
                  key={recipe.name}
                  className="flex-[0_0_60%] min-w-0 px-3 transition-all duration-300"
                  style={{
                    opacity: isCurrent ? 1 : 0.4,
                    transform: isCurrent ? "scale(1)" : "scale(0.85)",
                  }}
                >
                  <div
                    className="flex flex-col items-center justify-center rounded-2xl ring-1 ring-border p-4 h-full transition-colors duration-300 cursor-pointer"
                    style={{
                      background: isCurrent && recipe.isSelected
                        ? "var(--recipe-selected-bg)"
                        : "var(--bg)",
                    }}
                    onClick={() => handleSlideClick(idx, recipe)}
                  >
                    <CoffeeIcon recipe={recipe.name} size={160} />
                    <span
                      className="text-sm font-medium mt-3 text-center transition-colors duration-300"
                      style={{
                        color: isCurrent ? "var(--text-primary)" : "var(--text-tertiary)",
                      }}
                    >
                      {isCurrent && recipe.isSelected
                        ? `${brewLabel} ${recipe.name}`
                        : recipe.name}
                    </span>
                    {isCurrent && recipe.isSelected && recipe.details && (
                      <div className="mt-2 recipe-overlay-enter">
                        {renderInfo(recipe.details)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Dot indicators (≤10 recipes) */}
      {showDots && (
        <div className="flex justify-center gap-1.5 py-2 shrink-0">
          {recipes.map((_, idx) => (
            <button
              key={idx}
              onClick={() => emblaApi?.scrollTo(idx)}
              aria-label={`Go to slide ${idx + 1}`}
              className="w-1.5 h-1.5 rounded-full transition-all duration-300"
              style={{
                background:
                  idx === selectedSnap ? "var(--accent)" : "var(--text-tertiary)",
                opacity: idx === selectedSnap ? 1 : 0.3,
                transform: idx === selectedSnap ? "scale(1.3)" : "scale(1)",
              }}
            />
          ))}
        </div>
      )}

      {/* Counter (>10 recipes) */}
      {showCounter && (
        <div className="flex justify-center py-2 shrink-0">
          <span
            className="text-xs tabular-nums font-medium"
            style={{ color: "var(--text-secondary)" }}
          >
            {selectedSnap + 1} / {recipes.length}
          </span>
        </div>
      )}
    </div>
  );
}
