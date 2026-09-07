import type { HassEntities } from "home-assistant-js-websocket";
import { getEntity } from "../lib/entities";
import { usePreferences } from "../lib/preferences";
import { CoffeeIcon } from "./CoffeeIcon";
import { Dot, DrinkStage, Glyph, Mosaic, Rule } from "./ui";

interface Props {
  entities: HassEntities;
  prefix: string;
}

interface CounterEntry {
  name: string;
  count: number;
}

/** §6.1 ladder — a mosaic/stat tile draws its drink at 64. */
const TILE_ICON_SIZE = 64;

/** Six across at every supported width — the app never renders below 1024px. */
const STAT_COLUMNS = 6;

/**
 * How much of the machine's life each drink accounts for.
 *
 * Drawn as the §G2.4a hairline mosaic: cells separated by a 1px gap over
 * `--section-divider` and painted with the page ground, so the grid's own
 * rules are the only container. The rounded, ringed, `--surface-card`-filled
 * tiles this replaces were a tint per repeated item — the one thing every
 * reference panel and every design system in the corpus refuses to do.
 *
 * Magnitude is said twice and never with a box: the glass is scaled to its
 * share of the row (§6.3) and a proportional accent wash rises behind it,
 * capped at the §5.D ceiling of `0.06 + fraction × 0.10`. The paint IS the
 * value; it is not a container fill.
 *
 * The truth scale and the common baseline used to be hand-rolled here — a
 * local `truthScale()` and a fixed-height align box — which made this the one
 * row of drinks in the app that was volume-scaled while every other row drew
 * flat (C17). Both now come from `CoffeeIcon`'s own `scaleTo`/`baseline`
 * props, so the shelf, the sommelier and this mosaic share one implementation
 * and one 0.55–1.0 band. The glass also gets the §6.2 ground every other drink
 * in the app has — glow, horizon, contact line and mirrored copy (C16) — which
 * is what makes it read as an object standing in the cell rather than as a
 * sticker printed on it.
 */
export function StatsSection({ entities, prefix }: Props) {
  const { t } = usePreferences();
  const entity = getEntity(entities, prefix, "sensor", "total_cups");
  const total = entity?.state ? parseInt(entity.state, 10) : null;
  const attrs = entity?.attributes || {};

  const counters: CounterEntry[] = [];
  for (const [name, val] of Object.entries(attrs)) {
    if (
      typeof val === "number" &&
      name !== "friendly_name" &&
      name !== "unit_of_measurement" &&
      name !== "state_class" &&
      name !== "icon"
    ) {
      counters.push({ name, count: val });
    }
  }
  counters.sort((a, b) => b.count - a.count);
  const maxCount = counters.length > 0 ? counters[0].count : 1;

  if (total === null || isNaN(total)) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-secondary t-body">{t("stats.not_available")}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 flex-col items-center gap-1 py-8">
        <span className="t-display text-primary num">{total.toLocaleString()}</span>
        <span className="t-label text-tertiary">{t("stats.total_cups")}</span>
      </div>
      <Rule rail />

      <div
        className="min-h-0 flex-1 custom-scroll overflow-y-auto"
        style={{ paddingLeft: "var(--rail)", paddingRight: "var(--rail)", paddingTop: "16px", paddingBottom: "16px" }}
      >
        {counters.length > 0 && (
          <Mosaic id="stats-mosaic" columns={STAT_COLUMNS} count={counters.length}>
            {counters.map(({ name, count }, i) => {
              const fraction = maxCount > 0 ? count / maxCount : 0;
              const isTop = i === 0;
              return (
                <div
                  key={name}
                  data-ui="stat-tile"
                  /** Not a surface: the page ground showing through the grid. */
                  data-fill="ground"
                  className="relative flex flex-col items-center overflow-hidden p-2 pb-3"
                  style={{ backgroundColor: "var(--bg)", borderRadius: 0 }}
                >
                  {/* §5.D — the one value tint: a magnitude, not a container. */}
                  <div
                    aria-hidden="true"
                    data-ui="stat-wash"
                    data-fill="magnitude"
                    className="pointer-events-none absolute bottom-0 left-0 right-0 transition-all duration-700"
                    style={{
                      height: `${fraction * 100}%`,
                      backgroundColor: "var(--accent)",
                      opacity: 0.06 + fraction * 0.1,
                      borderRadius: 0,
                    }}
                  />
                  <div className="relative z-10 flex w-full flex-col items-center">
                    {/* Bases align, tops stay ragged (§6.3), over the same
                        ground every other drink in the app stands on (§6.2). */}
                    <DrinkStage size={TILE_ICON_SIZE} active={isTop}>
                      <CoffeeIcon
                        recipe={name}
                        size={TILE_ICON_SIZE}
                        baseline
                        scaleTo={fraction}
                      />
                    </DrinkStage>
                    <span className="t-label text-secondary mt-1 w-full truncate text-center leading-tight">
                      {name}
                    </span>
                    <span
                      className="t-body num mt-0.5"
                      style={{ color: isTop ? "var(--text-primary)" : "var(--text-secondary)" }}
                    >
                      {count}
                    </span>
                  </div>
                  {/* A true circle — the one honest curve — marks the leader.
                      It is the same `Dot` the pagers draw, so it carries the
                      same `data-fill="dot"` the fill inventory is queried on
                      rather than the `"meter"` it used to claim (C21). */}
                  {isTop && <Dot current className="absolute right-1.5 top-1.5" />}
                </div>
              );
            })}
          </Mosaic>
        )}

        {counters.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-4 py-16">
            {/* §6.6 / C27 — the empty-page mark is one size and one ink. */}
            <Glyph size="state" alt="" className="text-tertiary">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" width="100%" height="100%">
                <path d="M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8zM6 1v3M10 1v3M14 1v3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Glyph>
            <p className="text-tertiary t-body">{t("stats.no_cups")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
