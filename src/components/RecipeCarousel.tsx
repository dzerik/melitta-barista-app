import { useCallback, useEffect, useState } from "react";
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
  onSelect: (name: string) => void;
  onBrew: (name: string) => void;
  renderInfo: (details: RecipeDetails) => React.ReactNode;
  brewLabel: string;
}

export function RecipeCarousel({ recipes, onSelect, onBrew, renderInfo, brewLabel }: Props) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: false,
    align: "center",
    containScroll: "trimSnaps",
    dragFree: false,
  });
  const [selectedSnap, setSelectedSnap] = useState(0);

  const onEmblaSelect = useCallback(() => {
    if (!emblaApi) return;
    const idx = emblaApi.selectedScrollSnap();
    setSelectedSnap(idx);
    if (recipes[idx]) {
      onSelect(recipes[idx].name);
    }
  }, [emblaApi, recipes, onSelect]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on("select", onEmblaSelect);
    emblaApi.on("reInit", onEmblaSelect);
    return () => {
      emblaApi.off("select", onEmblaSelect);
      emblaApi.off("reInit", onEmblaSelect);
    };
  }, [emblaApi, onEmblaSelect]);

  // Sync external selection to embla
  useEffect(() => {
    if (!emblaApi) return;
    const activeIdx = recipes.findIndex((r) => r.isSelected);
    if (activeIdx >= 0 && activeIdx !== emblaApi.selectedScrollSnap()) {
      emblaApi.scrollTo(activeIdx);
    }
  }, [emblaApi, recipes]);

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
                      background: isCurrent ? "var(--recipe-selected-bg)" : "var(--bg)",
                    }}
                    onClick={() => {
                      if (isCurrent && recipe.isSelected) {
                        onBrew(recipe.name);
                      } else if (!isCurrent && emblaApi) {
                        emblaApi.scrollTo(idx);
                      }
                    }}
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
                    {isCurrent && recipe.details && (
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

      {/* Dot indicators */}
      {recipes.length > 1 && (
        <div className="flex justify-center gap-1.5 py-2 shrink-0">
          {recipes.map((_, idx) => (
            <button
              key={idx}
              onClick={() => emblaApi?.scrollTo(idx)}
              aria-label={`Go to slide ${idx + 1}`}
              className="w-1.5 h-1.5 rounded-full transition-all duration-300"
              style={{
                background:
                  idx === selectedSnap
                    ? "var(--accent)"
                    : "var(--text-tertiary)",
                opacity: idx === selectedSnap ? 1 : 0.3,
                transform: idx === selectedSnap ? "scale(1.3)" : "scale(1)",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
