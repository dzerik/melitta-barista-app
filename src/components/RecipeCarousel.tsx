import { useCallback, useEffect, useState, useMemo } from "react";
import useEmblaCarousel from "embla-carousel-react";
import type { RecipeDetails } from "../lib/entities";
import {
  RecipeCard,
  shelfMaxMl,
  truthFraction,
  type RecipeCardData,
} from "./RecipeCard";
import { ActionBand, Commit, Dot, Rule, Word } from "./ui";
import { usePreferences } from "../lib/preferences";
import { fmt } from "../lib/brew-plan";

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

export function RecipeCarousel({ recipes, onSelect, onBrew, renderInfo, brewLabel }: Props) {
  const { t } = usePreferences();
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

  // §6.3: the same shelf maximum the paged grid measures against, so a drink
  // is the same size whichever view mode you are in.
  const shelfMax = useMemo(() => shelfMaxMl(recipes), [recipes]);

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
  // so it is a bare word — which also means the Recipes page never shows two
  // commits when a DirectKey tile holds the one.
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
            aria-label={t("app.previous")}
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
                    scaleTo={truthFraction(recipe, shelfMax)}
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
            aria-label={t("app.next")}
            className="tap press absolute right-0 z-20"
            style={{ color: "var(--text-secondary)", borderRadius: 0 }}
          >
            <ArrowGlyph direction="next" />
          </button>
        )}
      </div>

      {/* Brew — the same action band every committing screen uses (C10),
          locked to the page column and never to the slide's 28%. Stage one of
          the two-stage gesture only selects, so it is a bare `Word` with no
          rule at all: an underline in this language means "chosen", and an
          action is not chosen. */}
      {currentRecipe && (
        <ActionBand
          inset="rail"
          secondary={
            commits ? undefined : (
              // `tap-lg` so stage one and stage two are the same 60px target
              // and the band keeps one height across the gesture.
              <Word label={brewLabel} onClick={runAction} className="tap-lg" />
            )
          }
          commit={
            commits ? <Commit label={brewLabel} onCommit={runAction} /> : undefined
          }
        />
      )}

      {/* Dot indicators — true circles on the rule, 8px painted, 48px reached */}
      {showDots && (
        <div className="relative flex justify-center shrink-0">
          <Rule rail className="absolute left-0 right-0 top-1/2" />
          {recipes.map((_, idx) => (
            <button
              key={idx}
              onClick={() => emblaApi?.scrollTo(idx)}
              aria-label={fmt(t("app.page"), { n: idx + 1 })}
              aria-current={idx === selectedSnap ? "true" : undefined}
              className="tap press w-10 relative"
              style={{ borderRadius: 0 }}
            >
              <Dot current={idx === selectedSnap} />
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
