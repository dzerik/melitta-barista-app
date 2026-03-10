import { useCallback, useEffect, useState, useMemo } from "react";
import useEmblaCarousel from "embla-carousel-react";
import type { RecipeDetails } from "../lib/entities";
import { RecipeCard, type RecipeCardData } from "./RecipeCard";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  recipes: RecipeCardData[];
  onSelect: (name: string) => void;
  onBrew: (name: string) => void;
  renderInfo: (details: RecipeDetails) => React.ReactNode;
  brewLabel: string;
}

const MAX_DOTS = 10;

export function RecipeCarousel({ recipes, onSelect, onBrew, renderInfo, brewLabel }: Props) {
  const startIndex = useMemo(
    () => Math.max(0, recipes.findIndex((r) => r.isSelected)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: false,
    align: "center",
    containScroll: false,
    dragFree: true,
    startIndex,
  });
  const [selectedSnap, setSelectedSnap] = useState(startIndex);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const onEmblaScroll = useCallback(() => {
    if (!emblaApi) return;
    const snaps = emblaApi.scrollSnapList();
    const progress = emblaApi.scrollProgress();
    let closest = 0;
    let minDist = Infinity;
    for (let i = 0; i < snaps.length; i++) {
      const dist = Math.abs(snaps[i] - progress);
      if (dist < minDist) {
        minDist = dist;
        closest = i;
      }
    }
    setSelectedSnap(closest);
  }, [emblaApi]);

  const onEmblaSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedSnap(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on("scroll", onEmblaScroll);
    emblaApi.on("select", onEmblaSelect);
    emblaApi.on("reInit", onEmblaSelect);
    return () => {
      emblaApi.off("scroll", onEmblaScroll);
      emblaApi.off("select", onEmblaSelect);
      emblaApi.off("reInit", onEmblaSelect);
    };
  }, [emblaApi, onEmblaScroll, onEmblaSelect]);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  const currentRecipe = recipes[selectedSnap];
  const showDots = recipes.length > 1 && recipes.length <= MAX_DOTS;
  const showCounter = recipes.length > MAX_DOTS;
  const showArrows = recipes.length > 1;

  return (
    <div className="flex flex-col h-full">
      {/* Carousel with navigation arrows */}
      <div className="flex-1 min-h-0 flex items-center relative" data-embla-carousel>
        {showArrows && (
          <button
            onClick={scrollPrev}
            aria-label="Previous slide"
            className="absolute left-1 z-20 p-1.5 rounded-full transition-colors duration-200"
            style={{ background: "var(--surface-elevated)", color: "var(--text-secondary)" }}
          >
            <ChevronLeft size={18} />
          </button>
        )}

        <div className="overflow-hidden w-full h-full" ref={emblaRef}>
          <div className="flex h-full items-center">
            {recipes.map((recipe, idx) => {
              const isCurrent = idx === selectedSnap;
              return (
                <div
                  key={recipe.name}
                  className="flex-[0_0_28%] min-w-0 h-full px-1 flex flex-col items-center justify-center transition-all duration-300"
                  style={{
                    transform: isCurrent ? "scale(1)" : "scale(0.9)",
                    zIndex: isCurrent ? 10 : 1,
                    position: "relative",
                  }}
                >
                  <RecipeCard
                    recipe={recipe}
                    active={isCurrent}
                    hovered={hoveredIdx === idx}
                    iconSize={240}
                    onClick={() => {
                      if (idx !== selectedSnap) {
                        emblaApi?.scrollTo(idx);
                      } else if (!recipe.isSelected) {
                        onSelect(recipe.name);
                      }
                    }}
                    onPointerEnter={() => setHoveredIdx(idx)}
                    onPointerLeave={() => setHoveredIdx((h) => h === idx ? null : h)}
                    renderInfo={renderInfo}
                    className="pt-5 px-4 pb-8"
                  />
                </div>
              );
            })}
          </div>
        </div>

        {showArrows && (
          <button
            onClick={scrollNext}
            aria-label="Next slide"
            className="absolute right-1 z-20 p-1.5 rounded-full transition-colors duration-200"
            style={{ background: "var(--surface-elevated)", color: "var(--text-secondary)" }}
          >
            <ChevronRight size={18} />
          </button>
        )}
      </div>

      {/* Brew button */}
      {currentRecipe && (
        <div className="flex justify-center shrink-0 px-1">
          <button
            className="py-2.5 text-xs tracking-widest uppercase font-semibold transition-all duration-200 active:scale-[0.98]"
            style={{
              width: "28%",
              background: "var(--recipe-label-bg)",
              color: "var(--recipe-label-text)",
              letterSpacing: "0.12em",
            }}
            onClick={() => {
              if (currentRecipe.isSelected) {
                onBrew(currentRecipe.name);
              } else {
                onSelect(currentRecipe.name);
              }
            }}
          >
            {brewLabel}
          </button>
        </div>
      )}

      {/* Dot indicators */}
      {showDots && (
        <div className="flex justify-center gap-1.5 py-2 shrink-0">
          {recipes.map((_, idx) => (
            <button
              key={idx}
              onClick={() => emblaApi?.scrollTo(idx)}
              aria-label={`Go to slide ${idx + 1}`}
              className="w-1.5 h-1.5 rounded-full transition-all duration-300"
              style={{
                background: idx === selectedSnap ? "var(--accent)" : "var(--text-tertiary)",
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
