import { useCallback, useEffect, useState, useMemo } from "react";
import useEmblaCarousel from "embla-carousel-react";
import type { RecipeDetails } from "../lib/entities";
import { RecipeCard, type RecipeCardData } from "./RecipeCard";
import { Commit, Rule } from "./ui";

interface Props {
  recipes: RecipeCardData[];
  onSelect: (name: string) => void;
  onBrew: (name: string) => void;
  renderInfo: (details: RecipeDetails) => React.ReactNode;
  brewLabel: string;
}

const MAX_DOTS = 10;

/**
 * A navigation arrow: a bare filled triangle in `--text-secondary` at ~12px
 * inside a 48px reach (§C6c). The `p-1.5 rounded-full` disc plate on
 * `--surface-elevated` is gone — an arrow is a mark, not a button-shaped
 * object, and lucide's chevron is a stroke where the references draw a solid.
 */
function ArrowGlyph({ direction }: { direction: "prev" | "next" }) {
  return (
    <svg width={12} height={14} viewBox="0 0 12 14" aria-hidden="true">
      <polygon
        points={direction === "prev" ? "11,0 11,14 0,7" : "1,0 1,14 12,7"}
        fill="currentColor"
      />
    </svg>
  );
}

/** The same 8px position mark the paged grid uses — see RecipeGrid's PagerDot. */
function PagerDot({ current }: { current: boolean }) {
  return (
    <span
      aria-hidden="true"
      data-ui="pager-dot"
      data-current={current ? "true" : "false"}
      data-fill="dot"
      className="block"
      style={{
        width: "var(--dot)",
        height: "var(--dot)",
        borderRadius: "50%",
        backgroundColor: current ? "var(--accent)" : "var(--bg)",
        borderWidth: current ? 0 : "1px",
        borderStyle: "solid",
        borderColor: "var(--accent)",
      }}
    />
  );
}

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

  // The two-stage gesture, drawn honestly (§5.C): only the tap that actually
  // brews is painted as the screen's one commit rectangle. Where the centred
  // slide is not yet the machine's chosen recipe the same tap merely selects,
  // so it is a bare word with a hairline under it — which also means the
  // Recipes page never shows two commits when a DirectKey tile holds the one.
  const commits = currentRecipe?.isSelected === true;
  const runAction = useCallback(() => {
    if (!currentRecipe) return;
    if (currentRecipe.isSelected) {
      onBrew(currentRecipe.name);
    } else {
      onSelect(currentRecipe.name);
    }
  }, [currentRecipe, onBrew, onSelect]);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Carousel with navigation arrows */}
      <div className="flex-1 min-h-0 flex items-center relative" data-embla-carousel>
        {showArrows && (
          <button
            onClick={scrollPrev}
            aria-label="Previous slide"
            className="tap press absolute left-0 z-20"
            style={{ color: "var(--text-secondary)", borderRadius: 0 }}
          >
            <ArrowGlyph direction="prev" />
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
            className="tap press absolute right-0 z-20"
            style={{ color: "var(--text-secondary)", borderRadius: 0 }}
          >
            <ArrowGlyph direction="next" />
          </button>
        )}
      </div>

      {/* Brew — locked to the page column, never to the slide's 28%. */}
      {currentRecipe && (
        <div className="shrink-0 w-full px-4">
          {commits ? (
            <Commit label={brewLabel} onCommit={runAction} />
          ) : (
            <button
              onClick={runAction}
              className="tap tap-lg press w-full t-body"
              style={{
                color: "var(--text-secondary)",
                borderBottomWidth: "var(--underline-w)",
                borderBottomStyle: "solid",
                borderBottomColor: "var(--border)",
                borderRadius: 0,
              }}
            >
              {brewLabel}
            </button>
          )}
        </div>
      )}

      {/* Dot indicators — true circles on the rule, 8px painted, 48px reached */}
      {showDots && (
        <div className="relative flex justify-center shrink-0">
          <Rule rail className="absolute left-0 right-0 top-1/2" />
          {recipes.map((_, idx) => (
            <button
              key={idx}
              onClick={() => emblaApi?.scrollTo(idx)}
              aria-label={`Go to slide ${idx + 1}`}
              aria-current={idx === selectedSnap ? "true" : undefined}
              className="tap press w-10 relative"
              style={{ borderRadius: 0 }}
            >
              <PagerDot current={idx === selectedSnap} />
            </button>
          ))}
        </div>
      )}

      {/* Counter (>10 recipes) */}
      {showCounter && (
        <div className="flex justify-center py-2 shrink-0">
          <span className="t-label num" style={{ color: "var(--text-secondary)" }}>
            {selectedSnap + 1} / {recipes.length}
          </span>
        </div>
      )}
    </div>
  );
}
