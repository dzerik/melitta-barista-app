import { Fragment, useContext, useEffect, useState, type ReactNode } from "react";
import { Heart, ChevronDown, ChevronUp, Check, Snowflake, Trash2 } from "lucide-react";
import { usePreferences } from "../lib/preferences";
import { displayNameFor, type Locale, type TranslationKey } from "../lib/i18n";
import type { AiRecipe } from "../hooks/useSommelier";
import { hasPhasePlan, recipeMachinePhases, type BrewPlanRecipe, type PhaseComponent } from "../lib/brew-plan";
import { BrewWizardContext } from "../hooks/useBrewPhase";
import { BrewWizard } from "./BrewWizard";
import { CoffeeIcon } from "./CoffeeIcon";
import { DrinkStage } from "./ui/DrinkStage";
import { Rule } from "./ui/Rule";
import { usePrefersReducedMotion } from "./ui/reduced-motion";
import { suggestionLabel } from "../lib/sommelier-vocab";
import { pourSummaries, readableSteps, hopperNumber } from "../lib/recipe-summary";

/** §6.1 ladder — a sommelier card is a paged grid cell, so its glass is 140. */
export const SOMMELIER_ICON_SIZE = 140;

/** §G2.4b — the paged drink matrix is four across. */
export const SOMMELIER_COLUMNS = 4;

interface Props {
  recipe: AiRecipe;
  onBrew: (id: string) => void;
  /** Omitted where favouriting makes no sense (the favourites list itself). */
  onFavorite?: (id: string) => void;
  /** Only the favourites list can remove a favourite. */
  onRemove?: (id: string) => void;
  isFavorited?: boolean;
  brewing?: boolean;
  /** A quiet line above the drink: the time it was suggested, times brewed. */
  meta?: string | null;
  /** §11 — newly served content arrives on a 60ms/index stagger. */
  enterIndex?: number;
}

/** Served `name_key` (§6.3.6) when the row carries one; the type predates it. */
function readNameKey(recipe: AiRecipe): string | undefined {
  const key = (recipe as { name_key?: unknown }).name_key;
  return typeof key === "string" && key ? key : undefined;
}

/**
 * The composition band as §7's value strip: one `label value` pair per pour,
 * the LABEL half in `--accent` and the VALUE half in `--text-primary`, groups
 * divided by a short hairline. The prose form (`pourSummaries`) is longer than
 * a 140px cell can hold without wrapping — and a divided strip that wraps
 * orphans its rules — so the cell carries the pairs and the details drawer
 * carries the sentences.
 */
function pourPairs(
  locale: Locale,
  recipe: BrewPlanRecipe,
): { key: string; label: string; value: string }[] {
  const phases = recipeMachinePhases(recipe);
  const components: (PhaseComponent | null | undefined)[] = phases.length
    ? phases.map((p) => p.component)
    : [recipe.component1, recipe.component2];

  const pairs: { key: string; label: string; value: string }[] = [];
  components.forEach((component, i) => {
    if (!component) return;
    const process = typeof component.process === "string" ? component.process : "";
    if (!process || process === "none") return;
    const ml = Number(component.portion_ml);
    pairs.push({
      key: `${i}-${process}`,
      label: displayNameFor(locale, "process", process),
      // The unit symbol is written exactly as `recipe-summary.ts` writes it,
      // so a pour reads the same in the cell and in the drawer.
      value: Number.isFinite(ml) && ml > 0 ? `${ml} ml` : "",
    });
  });
  return pairs;
}

/**
 * One sommelier recipe, wherever it appears — a fresh suggestion, a saved
 * favourite, or a row out of the history.
 *
 * A drink cell of the same species as a Recipes-page cell: the glass on top at
 * grid scale (140) over its §6.2 glow, horizon and reflection, the name under
 * it, then the composition, then the actions — all on hard-reserved bands
 * (§R1.5) so names and figures line up across a row however many components a
 * recipe has. The 84px left-rail thumbnail beside running prose that this used
 * to be was the only place in the app where the drink was not the subject.
 *
 * Nothing here is boxed: no card, no fill, no radius, no ring. The only
 * saturated ink is the label half of a value pair (§8.1d). Brew is a bare word
 * with a hairline underline rather than a filled chip, because a grid of cells
 * cannot hold eight commit rectangles — the screen's one commit lives on the
 * Generate brief (§C3.5).
 *
 * The Brew button routes per Zone P-H: when the hosting section provides a
 * `BrewWizardContext` AND the row carries `machine_phases` (0.89+ servers),
 * it opens the step-machine `BrewWizard` — multi-phase recipes must not
 * one-shot brew. Otherwise (pre-contract rows, or no wizard host) it keeps
 * the legacy one-shot `onBrew` path, byte-identically.
 */
export function SommelierRecipeCard({
  recipe,
  onBrew,
  onFavorite,
  onRemove,
  isFavorited,
  brewing,
  meta = null,
  enterIndex,
}: Props) {
  const { t, locale } = usePreferences();
  const [expanded, setExpanded] = useState(false);
  const wizardEnv = useContext(BrewWizardContext);
  const [wizardOpen, setWizardOpen] = useState(false);
  const wizardBrew = wizardEnv !== null && hasPhasePlan(recipe);

  const extras = recipe.extras;
  const steps = expanded ? readableSteps(locale, recipe as never) : [];
  const hopper = hopperNumber(recipe);
  const pairs = pourPairs(locale, recipe as never);

  // The pours as sentences, plus whatever was stirred in — read in the drawer,
  // where there is room for a line that does not have to fit a grid cell.
  const pours = expanded ? pourSummaries(locale, recipe as never) : [];
  const addIns = ([["syrup_", extras?.syrup], ["topping_", extras?.topping], ["liqueur_", extras?.liqueur]] as const)
    .filter(([, value]) => Boolean(value))
    .map(([prefix, value]) => suggestionLabel(locale, prefix, value as string));

  const detailsLabel = t("sommelier.details" as TranslationKey);

  return (
    <article
      data-ui="sommelier-cell"
      className={`grid h-full w-full min-h-0 justify-items-center gap-2 p-3 ${
        enterIndex === undefined ? "" : "recipe-item-enter"
      }`}
      // Five hard reservations — meta, drink, name, composition, actions — so
      // every card in a row lands its name and its figures on the same line.
      style={{
        gridTemplateRows: "1rem 1fr auto 2.75rem 3rem",
        borderRadius: 0,
        animationDelay: enterIndex === undefined ? undefined : `${enterIndex * 60}ms`,
      }}
    >
      <div className="t-label text-tertiary num w-full truncate text-center">{meta ?? ""}</div>

      {/* The drink leads — everything else describes it. */}
      <div className="flex w-full min-h-0 items-end justify-center">
        <DrinkStage size={SOMMELIER_ICON_SIZE} active={Boolean(brewing)}>
          <CoffeeIcon
            recipe={recipe.name}
            nameKey={readNameKey(recipe)}
            icon={recipe.icon}
            size={SOMMELIER_ICON_SIZE}
          />
        </DrinkStage>
      </div>

      <div className="flex w-full min-w-0 items-center justify-center gap-2">
        <h3 className="t-title font-light text-primary truncate">{recipe.name}</h3>
        {recipe.brewed && (
          <Check size={16} className="shrink-0" style={{ color: "var(--success)" }} />
        )}
        {extras?.ice && (
          <Snowflake size={16} className="shrink-0" style={{ color: "var(--text-secondary)" }} />
        )}
      </div>

      <div className="flex w-full min-w-0 items-start justify-center overflow-hidden">
        {pairs.map((pair, i) => (
          <span
            key={pair.key}
            className={`t-label whitespace-nowrap ${i > 0 ? "border-l pl-3 ml-3" : ""}`}
            style={i > 0 ? { borderColor: "var(--border)" } : undefined}
          >
            <span style={{ color: "var(--accent)" }}>{pair.label}</span>
            {pair.value ? <span className="text-primary num"> {pair.value}</span> : null}
          </span>
        ))}
      </div>

      <div className="flex w-full items-center justify-center gap-1">
        <button
          type="button"
          onClick={() => setExpanded(true)}
          aria-expanded={expanded}
          aria-label={detailsLabel}
          className="tap press t-label text-tertiary hover:text-secondary gap-1.5"
          style={{ borderRadius: 0 }}
        >
          <ChevronDown size={16} />
        </button>

        {onFavorite && (
          <button
            type="button"
            onClick={() => onFavorite(recipe.id)}
            aria-pressed={isFavorited}
            aria-label={t("sommelier.favorite" as TranslationKey)}
            className="tap press shrink-0"
            style={{ color: isFavorited ? "var(--accent)" : "var(--text-tertiary)", borderRadius: 0 }}
          >
            <Heart size={18} fill={isFavorited ? "currentColor" : "none"} />
          </button>
        )}

        {onRemove && (
          <button
            type="button"
            onClick={() => onRemove(recipe.id)}
            aria-label={t("sommelier.remove" as TranslationKey)}
            className="tap press text-tertiary hover:text-primary"
            style={{ borderRadius: 0 }}
          >
            <Trash2 size={18} />
          </button>
        )}

        {/* Not a commit: at grid scale the fill would be eight saturated
            rectangles on one screen. A bare word — and bare it stays, because
            an underline in this language means "chosen", not "tappable". */}
        <button
          type="button"
          onClick={() => (wizardBrew ? setWizardOpen(true) : onBrew(recipe.id))}
          disabled={brewing}
          className="tap press t-body"
          style={{
            color: brewing ? "var(--text-secondary)" : "var(--text-primary)",
            fontWeight: 600,
            borderRadius: 0,
            opacity: brewing ? 0.5 : 1,
            pointerEvents: brewing ? "none" : undefined,
          }}
        >
          {brewing ? t("sommelier.brewing" as TranslationKey) : t("sommelier.brew" as TranslationKey)}
        </button>
      </div>

      {expanded && (
        <SommelierDetails
          title={recipe.name}
          label={detailsLabel}
          onClose={() => setExpanded(false)}
        >
          {recipe.description && (
            <p className="t-body text-secondary max-w-prose">{recipe.description}</p>
          )}

          {/* The sommelier's own justification — the answer to the question
              the user is actually asking of this card. */}
          {recipe.reasoning && (
            <div>
              <div className="t-label text-tertiary">
                {t("sommelier.reasoning" as TranslationKey)}
              </div>
              <p className="t-label text-secondary mt-1 max-w-prose">{recipe.reasoning}</p>
            </div>
          )}

          {pours.length > 0 && (
            <div className="t-label text-secondary max-w-prose">
              {pours.map((pour, i) => (
                <div key={`${pour}-${i}`}>{pour}</div>
              ))}
              {addIns.length > 0 && <div>{addIns.join(" · ")}</div>}
            </div>
          )}

          {steps.length > 0 && (
            <div>
              <div className="t-label text-tertiary">
                {t("sommelier.steps" as TranslationKey)}
              </div>
              <ol className="mt-1.5 space-y-1.5 max-w-prose">
                {steps.map((line, i) => (
                  <li key={i} className="t-label text-secondary flex gap-3">
                    <span className="num" style={{ color: "var(--text-tertiary)" }}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span>{line}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {(recipe.estimated_caffeine || recipe.calories_approx != null) && (
            <div className="flex items-center">
              {recipe.estimated_caffeine && (
                <span className="t-label text-tertiary">
                  {t("sommelier.caffeine" as TranslationKey)}:{" "}
                  <span className="text-secondary">{recipe.estimated_caffeine}</span>
                </span>
              )}
              {recipe.calories_approx != null && (
                <span
                  className={`t-label text-tertiary ${recipe.estimated_caffeine ? "border-l pl-3 ml-3" : ""}`}
                  style={recipe.estimated_caffeine ? { borderColor: "var(--border)" } : undefined}
                >
                  <span className="text-secondary num">~{recipe.calories_approx}</span>{" "}
                  {t("sommelier.calories" as TranslationKey)}
                </span>
              )}
            </div>
          )}

          {hopper !== null && (
            <div className="t-label text-tertiary">
              {t("sommelier.blend" as TranslationKey)}:{" "}
              <span className="text-secondary">
                {t(`sommelier.hopper${hopper}` as TranslationKey)}
              </span>
            </div>
          )}

          {extras?.instruction && (
            <div className="t-label text-tertiary">
              {t("sommelier.instruction" as TranslationKey)}:{" "}
              <span className="text-secondary">{extras.instruction}</span>
            </div>
          )}
        </SommelierDetails>
      )}

      {wizardBrew && (
        <BrewWizard
          open={wizardOpen}
          recipe={recipe}
          onClose={() => setWizardOpen(false)}
        />
      )}
    </article>
  );
}

/**
 * The details drawer, drawn as an overlay rather than as an inline expansion:
 * the cell now lives on hard-reserved bands inside a paged matrix, and a card
 * that grows when it is opened would break the shelf every other card is
 * aligned to.
 *
 * §5.A gives it the scrim, §5.B gives it the single flat `--surface` panel —
 * radius 0, no border, no ring, no shadow, no blur of its own — and everything
 * inside the panel is unfilled. The prose scrolls (the §G2.2 carve-out for a
 * drawer), the close control is the same disclosure word that opened it, and
 * Escape closes it.
 */
function SommelierDetails({
  title,
  label,
  onClose,
  children,
}: {
  title: string;
  label: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm"
      data-fill="scrim"
      style={{
        backgroundColor: "var(--overlay-bg)",
        paddingLeft: "var(--rail)",
        paddingRight: "var(--rail)",
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label={title}
        data-ui="sommelier-details"
        data-fill="panel"
        className="surface flex w-full max-h-[80%] flex-col"
        // Rail to rail like every other structure in the app (the scrim owns
        // the rail); the measure cap that keeps the text readable lives on the
        // prose inside (§G2.3).
        style={{ borderRadius: 0, boxShadow: "none" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 px-6">
          <h2 className="t-title font-light text-primary truncate">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-expanded={true}
            aria-label={label}
            className="tap press t-label text-tertiary hover:text-secondary gap-1.5 shrink-0"
            style={{ borderRadius: 0 }}
          >
            <ChevronUp size={16} />
          </button>
        </div>
        <Rule />
        <div className="custom-scroll min-h-0 flex-1 space-y-3 overflow-y-auto px-6 py-4">
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * The 4-across drink matrix one page of a sommelier list is laid out on
 * (§G2.4b). Rows are created as the cells need them and the block is centred,
 * so a page of two drinks is a single centred row rather than a half-empty
 * 4×2 frame.
 */
export function SommelierMatrix({
  children,
  columns = SOMMELIER_COLUMNS,
}: {
  children: ReactNode;
  columns?: number;
}) {
  return (
    <div
      data-ui="sommelier-matrix"
      className="grid h-full content-center gap-3 p-2"
      style={{
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gridAutoRows: "minmax(0, 1fr)",
      }}
    >
      {children}
    </div>
  );
}

/** Split a list into pages of at most `perPage` entries, order preserved. */
function paginate<T>(items: T[], perPage: number): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += perPage) pages.push(items.slice(i, i + perPage));
  return pages.length > 0 ? pages : [[]];
}

/**
 * A whole shelf of sommelier drinks: the list chunked into pages, each page
 * laid out on the 4-across matrix, the lot handed to the pager. The two flat
 * lists (fresh results, favourites) are exactly this; the history tab builds
 * its own pages because each one is headed by the generation it came from.
 */
export function SommelierShelf<T>({
  items,
  perPage,
  columns = SOMMELIER_COLUMNS,
  cellKey,
  renderCell,
}: {
  items: T[];
  perPage: number;
  columns?: number;
  cellKey: (item: T, index: number) => string;
  renderCell: (item: T, index: number) => ReactNode;
}) {
  const pages = paginate(items, perPage).map((page, pageIdx) => (
    <SommelierMatrix key={pageIdx} columns={columns}>
      {page.map((item, i) => {
        const index = pageIdx * perPage + i;
        return <Fragment key={cellKey(item, index)}>{renderCell(item, index)}</Fragment>;
      })}
    </SommelierMatrix>
  ));
  return <SommelierPager pages={pages} />;
}

/**
 * The sommelier's pager: a tab body overflows by PAGING, never by scrolling
 * (§G2.2), and the marks are true circles riding ON the section rule — the
 * current page a solid `--accent` disc, the others `--accent` rings whose
 * `--bg` interiors visibly interrupt the rule passing behind them (§C-Nav b).
 * The painted dot stays 8px in every state; only its reach is 48px.
 *
 * The dot's accessible name is its page NUMBER rather than a sentence: the app
 * has no page-navigation string in any of its 29 locales, and a numeral is the
 * one label that is honest in all of them.
 */
export function SommelierPager({ pages }: { pages: ReactNode[] }) {
  const reduced = usePrefersReducedMotion();
  const [page, setPage] = useState(0);
  const count = Math.max(1, pages.length);
  const current = Math.min(page, count - 1);

  return (
    <div
      className="flex h-full min-h-0 flex-col"
      /* The app-level tab pager stands down inside this element, so a sideways
         drag pages the shelf instead of leaving the sommelier. */
      data-embla-carousel
      data-ui="sommelier-pager"
    >
      {pages.length > 1 && (
        <div className="relative flex shrink-0 justify-center">
          {/* The rule the marks ride on. It is already inside the tab's rail,
              so it spans this container edge to edge rather than insetting
              itself a second time. */}
          <div className="pointer-events-none absolute left-0 right-0 top-1/2 flex">
            <Rule className="flex-1" />
          </div>
          <div className="relative flex">
            {pages.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setPage(i)}
                aria-label={String(i + 1)}
                aria-current={i === current ? "true" : undefined}
                className="tap press w-10"
              >
                <span
                  className="block"
                  data-ui="pager-dot"
                  /** §8.1c — a position mark, the one place a curve is honest. */
                  data-fill="meter"
                  data-selected={i === current ? "true" : "false"}
                  style={{
                    width: "var(--dot)",
                    height: "var(--dot)",
                    borderRadius: "50%",
                    backgroundColor: i === current ? "var(--accent)" : "var(--bg)",
                    borderWidth: "1px",
                    borderStyle: "solid",
                    borderColor: "var(--accent)",
                  }}
                />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-hidden">
        <div
          className="flex h-full"
          style={{
            width: `${count * 100}%`,
            transform: `translateX(-${current * (100 / count)}%)`,
            transition: reduced ? "none" : "transform 0.35s var(--ease)",
          }}
        >
          {pages.map((node, i) => (
            <div key={i} className="h-full min-w-0" style={{ width: `${100 / count}%` }}>
              {node}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
