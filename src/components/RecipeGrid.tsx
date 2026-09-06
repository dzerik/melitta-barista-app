import { useCallback, useEffect, useState, useMemo } from "react";
import useEmblaCarousel from "embla-carousel-react";
import type { RecipeDetails } from "../lib/entities";
import { RecipeCard, type RecipeCardData } from "./RecipeCard";
import { Commit, Rule } from "./ui";

interface Props {
  recipes: RecipeCardData[];
  onSelect: (name: string) => void;
  onBrew: () => void;
  renderInfo: (details: RecipeDetails) => React.ReactNode;
  brewLabel: string;
  columns?: number;
  rows?: number;
}

/**
 * A pagination dot — the one honest curve in the app (§C6b, §S4.6).
 *
 * The current page is a solid `--accent` disc at `--dot`; every other page is
 * the same 8px circle drawn as a 1px `--accent` ring whose `--bg` interior
 * visibly interrupts the rule passing behind it. No size change between
 * states, no opacity fade, and above all no growing 22×8 capsule. The painted
 * mark stays 8px; the reach is 48px via `.tap`.
 */
function PagerDot({ current }: { current: boolean }) {
  return (
    <span
      aria-hidden="true"
      data-ui="pager-dot"
      data-current={current ? "true" : "false"}
      /** A position mark (§8.1c): the paint IS the position. */
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
    <div className="flex flex-col flex-1 min-h-0">
      {/* Page dots ride ON the section rule: the dot stays 8px, its reach does
          not, and the hollow ones interrupt the rule passing behind them. */}
      {pages.length > 1 && (
        <div className="relative flex justify-center shrink-0">
          <Rule rail className="absolute left-0 right-0 top-1/2" />
          {pages.map((_, idx) => (
            <button
              key={idx}
              onClick={() => emblaApi?.scrollTo(idx)}
              aria-label={`Go to page ${idx + 1}`}
              aria-current={idx === selectedPage ? "true" : undefined}
              className="tap press w-10 relative"
              style={{ borderRadius: 0 }}
            >
              <PagerDot current={idx === selectedPage} />
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

      {/* Brew — the one action this screen exists for, so it gets the page
          column's full width and the only saturated colour on the page. */}
      {selectedRecipe && (
        <div className="shrink-0 w-full px-4 pb-3 pt-1">
          <Commit label={brewLabel} onCommit={onBrew} />
        </div>
      )}
    </div>
  );
}
