import { Fragment, useContext, useState, type ReactNode } from "react";
import { Heart, ChevronDown, Check, Snowflake, Trash2 } from "lucide-react";
import { usePreferences } from "../lib/preferences";
import { displayNameFor, type Locale, type TranslationKey } from "../lib/i18n";
import type { AiRecipe } from "../hooks/useSommelier";
import {
  fmt,
  hasPhasePlan,
  recipeMachinePhases,
  type BrewPlanRecipe,
  type PhaseComponent,
} from "../lib/brew-plan";
import { BrewWizardContext } from "../hooks/useBrewPhase";
import { BrewWizard } from "./BrewWizard";
import { CoffeeIcon } from "./CoffeeIcon";
import { Dot, DrinkStage, Panel, Rule, TRUTH_UNSERVED, Word } from "./ui";
import { usePrefersReducedMotion } from "./ui/reduced-motion";
import { suggestionLabel } from "../lib/sommelier-vocab";
import { pourSummaries, readableSteps, hopperNumber } from "../lib/recipe-summary";
import { noteBrewStarted } from "../lib/brew-origin";
import { drinkBounds } from "./CoffeeIcon";

/** §6.1 ladder — a sommelier card is a paged grid cell, so its glass is 140. */
export const SOMMELIER_ICON_SIZE = 140;

/** §G2.4b — the paged drink matrix is four across. */
export const SOMMELIER_COLUMNS = 4;

/** §G2.4b — …and two down. One page is eight cells, everywhere. */
export const SOMMELIER_ROWS = 2;

/**
 * The cell's own measure, in px (C14).
 *
 * `gridAutoRows: minmax(0, 1fr)` let a page that was not full inflate its
 * cells: the Generate tab pages one row of four while Favourites and History
 * page 4×2, so the identical card drew at roughly twice the height on one tab
 * as on the other. A row track now grows to fill the shelf but stops here, so
 * a cell is the same object wherever it is paged — which is the whole of
 * "one paged idiom at one cell proportion".
 */
export const SOMMELIER_CELL_MAX = 280;

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
  /**
   * §6.3 truth scale: this drink's served volume as a 0–1 fraction of the
   * shelf's maximum. Build it with `shelfScale()` so every cell in a row is
   * measured against the same maximum; left out, the glass draws at the
   * unserved 0.80×.
   */
  scaleTo?: number;
}

/** Served `name_key` (§6.3.6) when the row carries one; the type predates it. */
function readNameKey(recipe: AiRecipe): string | undefined {
  const key = (recipe as { name_key?: unknown }).name_key;
  return typeof key === "string" && key ? key : undefined;
}

/** The pours a recipe actually dispenses, phase plan first, legacy pair after. */
function pourComponents(recipe: BrewPlanRecipe): (PhaseComponent | null | undefined)[] {
  const phases = recipeMachinePhases(recipe);
  return phases.length ? phases.map((p) => p.component) : [recipe.component1, recipe.component2];
}

/**
 * The composition band as §7's value strip: one `label value unit` group per
 * pour, the LABEL half in `--accent`, the VALUE half in `--text-primary` and
 * the UNIT one value step quieter at the same size, groups divided by a short
 * hairline. The prose form (`pourSummaries`) is longer than a 140px cell can
 * hold without wrapping — and a divided strip that wraps orphans its rules —
 * so the cell carries the groups and the details drawer carries the sentences.
 *
 * The number and its unit are separate spans on purpose (C22): baked into one
 * `"120 ml"` string they could only ever be inked as one thing, which is why
 * this strip used to render its units at full `--text-primary` while the
 * identical strip on the Recipes page had them right.
 */
function pourPairs(
  locale: Locale,
  recipe: BrewPlanRecipe,
): { key: string; label: string; ml: number | null }[] {
  const pairs: { key: string; label: string; ml: number | null }[] = [];
  pourComponents(recipe).forEach((component, i) => {
    if (!component) return;
    const process = typeof component.process === "string" ? component.process : "";
    if (!process || process === "none") return;
    const ml = Number(component.portion_ml);
    pairs.push({
      key: `${i}-${process}`,
      label: displayNameFor(locale, "process", process),
      ml: Number.isFinite(ml) && ml > 0 ? ml : null,
    });
  });
  return pairs;
}

/** Everything a recipe pours, in ml. 0 when no pour carries a volume. */
export function recipeTotalMl(recipe: BrewPlanRecipe): number {
  let total = 0;
  for (const component of pourComponents(recipe)) {
    if (!component) continue;
    const process = typeof component.process === "string" ? component.process : "";
    if (!process || process === "none") continue;
    const ml = Number(component.portion_ml);
    if (Number.isFinite(ml) && ml > 0) total += ml;
  }
  return total;
}

/**
 * §6.3 truth scale for one shelf of drinks: each recipe's volume against the
 * largest volume on the shelf, so an espresso and a latte macchiato stop
 * drawing at the same height. Where nothing is served a volume there is no
 * truth to scale to and every glass falls back to the unserved 0.80×.
 *
 * The maximum belongs to the shelf, not to the card, which is why this is a
 * factory the list components call once rather than a lookup inside the cell.
 */
export function shelfScale<T extends BrewPlanRecipe>(items: T[]): (item: T) => number {
  const totals = new Map<T, number>();
  let max = 0;
  for (const item of items) {
    const ml = recipeTotalMl(item);
    totals.set(item, ml);
    if (ml > max) max = ml;
  }
  return (item: T) => {
    const ml = totals.get(item) ?? recipeTotalMl(item);
    return max > 0 && ml > 0 ? ml / max : TRUTH_UNSERVED;
  };
}

/**
 * One sommelier recipe, wherever it appears — a fresh suggestion, a saved
 * favourite, or a row out of the history.
 *
 * A drink cell of the same species as a Recipes-page cell: the glass on top at
 * grid scale (140) over its §6.2 glow, horizon and reflection, bottom-aligned
 * and scaled to its real volume (§6.3), the name under it at the SAME type
 * step a Recipes cell uses (`t-body` — it read `t-title` here, which is C11),
 * then the composition, then the actions — all on hard-reserved bands (§R1.5)
 * so names and figures line up across a row however many components a recipe
 * has.
 *
 * Nothing here is boxed: no card, no fill, no radius, no ring. The only
 * saturated ink is the label half of a value pair (§8.1d). Brew is a bare
 * `Word` rather than a filled chip, because a grid of cells cannot hold eight
 * commit rectangles — the screen's one commit lives on the Generate brief
 * (§C3.5) — and it reads the app-wide `brew.brew` string, not a sommelier
 * duplicate that had drifted to a different Russian verb (C2).
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
  scaleTo = TRUTH_UNSERVED,
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

      {/* The drink leads — everything else describes it. Bases land on one
          line and the tops stay ragged: that ragged edge is the comparison,
          read before any number is (§6.3). */}
      <div className="flex w-full min-h-0 items-end justify-center">
        <DrinkStage
          size={SOMMELIER_ICON_SIZE}
          active={Boolean(brewing)}
          bounds={drinkBounds(recipe.name, undefined, recipe.icon)}
        >
          <CoffeeIcon
            recipe={recipe.name}
            nameKey={readNameKey(recipe)}
            icon={recipe.icon}
            size={SOMMELIER_ICON_SIZE}
            baseline
            scaleTo={scaleTo}
          />
        </DrinkStage>
      </div>

      <div className="flex w-full min-w-0 items-center justify-center gap-2">
        {/* §7.7 / C11 — a cell names its drink at one type step, and a
            sommelier cell is a grid cell like any other. */}
        <h3 className="t-body text-primary truncate">{recipe.name}</h3>
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
            {pair.ml === null ? null : (
              <>
                <span className="text-primary num" style={{ fontWeight: 600 }}> {pair.ml}</span>
                <span className="text-tertiary"> ml</span>
              </>
            )}
          </span>
        ))}
      </div>

      <div className="flex w-full items-center justify-center gap-1">
        {/* R8 — a disclosure with a word beside its chevron, and a handler
            that actually toggles, so `aria-expanded` is a live contract. */}
        <Word
          label={detailsLabel}
          icon={<ChevronDown size={16} />}
          ariaExpanded={expanded}
          onClick={() => setExpanded((v) => !v)}
        />

        {onFavorite && (
          <button
            type="button"
            onClick={() => onFavorite(recipe.id)}
            aria-pressed={isFavorited}
            aria-label={t("sommelier.favorite" as TranslationKey)}
            className="tap press shrink-0"
            /* §8.2 withholds accent from a toggled state: a favourite is said
               in value, like every other chosen mark in the app. */
            style={{ color: isFavorited ? "var(--text-primary)" : "var(--text-tertiary)", borderRadius: 0 }}
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
        <Word
          label={t("brew.brew" as TranslationKey)}
          busyLabel={t("sommelier.brewing" as TranslationKey)}
          busy={Boolean(brewing)}
          tone="strong"
          onClick={() => {
            // The machine reports a phase and never a product, so a drink is
            // nameable later only if the client that asked for it remembers.
            noteBrewStarted(recipe.name);
            if (wizardBrew) setWizardOpen(true);
            else onBrew(recipe.id);
          }}
        />
      </div>

      {expanded && (
        <SommelierDetails title={recipe.name} onClose={() => setExpanded(false)}>
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
 * It is the shared `Panel` and nothing more — §5.A's scrim over §5.B's one
 * flat `--surface` rectangle, one header, one close control. The hand-rolled
 * version it replaces set its fill through the `surface` CLASS, whose rule
 * uses the `background` shorthand that jsdom drops, so this panel's fill was
 * the one no test in the repo could see (R3); it also closed with a
 * `ChevronUp` where every other modal closed with an X (C9) and ran rail to
 * rail where the other four picked four different caps (C8).
 */
function SommelierDetails({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const { t } = usePreferences();
  return (
    <Panel
      title={title}
      onClose={onClose}
      closeLabel={t("app.close" as TranslationKey)}
      measure="lg"
      align="end"
      maxHeight="80%"
      bodyClassName="space-y-3 px-6 py-4"
    >
      {children}
    </Panel>
  );
}

/**
 * The 4-across drink matrix one page of a sommelier list is laid out on
 * (§G2.4b), declared exactly the way the Recipes page declares its own
 * (`RecipeGrid`): explicit column AND row tracks, `content-center`, so the
 * frame stays drawn where a slot is empty instead of reflowing. Franke does
 * the same — an empty 8th cell is left empty.
 *
 * A row track grows to fill the shelf but stops at `SOMMELIER_CELL_MAX`, which
 * is what keeps a one-row Generate page and a 4×2 Favourites page drawing the
 * SAME cell rather than one at twice the height of the other (C14).
 */
export function SommelierMatrix({
  children,
  columns = SOMMELIER_COLUMNS,
  rows = SOMMELIER_ROWS,
}: {
  children: ReactNode;
  columns?: number;
  rows?: number;
}) {
  return (
    <div
      data-ui="sommelier-matrix"
      data-rows={rows}
      className="grid h-full content-center gap-3 p-2"
      style={{
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${rows}, minmax(0, ${SOMMELIER_CELL_MAX}px))`,
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
 *
 * The page's row count comes from `perPage` rather than from a per-tab guess,
 * so the matrix always declares the frame it is actually paging.
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
  const rows = Math.max(1, Math.ceil(perPage / columns));
  const pages = paginate(items, perPage).map((page, pageIdx) => (
    <SommelierMatrix key={pageIdx} columns={columns} rows={rows}>
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
 * (§G2.2), and the marks are the shared `Dot` — true circles riding ON the
 * section rule, a solid `--accent` disc where you are and `--accent` rings
 * whose `--bg` interiors interrupt the rule behind them everywhere else
 * (§C-Nav b). The painted mark stays 8px in every state; only the reach is
 * 48px, and it belongs to the button, not to the mark.
 *
 * The third hand-rolled copy of that mark lived here (C20): it kept its ring
 * under the current disc and tagged itself `data-fill="meter"`, which quietly
 * exempted it from every audit query written against the fill inventory (C21).
 * The accessible name is now the app's own `app.page` string rather than the
 * bare numeral this had to fall back on when no locale carried one (R2).
 */
export function SommelierPager({ pages }: { pages: ReactNode[] }) {
  const { t } = usePreferences();
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
                aria-label={fmt(t("app.page" as TranslationKey), { n: i + 1 })}
                aria-current={i === current ? "true" : undefined}
                className="tap press w-10"
                style={{ borderRadius: 0 }}
              >
                <Dot current={i === current} />
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
