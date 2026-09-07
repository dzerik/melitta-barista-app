/**
 * The three sommelier lists share one recipe card, and history is a place you
 * can order from — it used to be a read-only log of names.
 *
 * Also pins the visual contract the sommelier was rebuilt onto: a card is a
 * drink CELL of the same species as a Recipes-page cell (drink above name, on
 * hard-reserved bands, over the §6.2 stage), lists PAGE rather than scroll,
 * and nothing in the tab draws a radius, a ring, a shadow or an undeclared
 * fill. StatsSection rides along because it is the other surface this pass
 * rebuilt and it has no test file of its own.
 */
import { describe, it, expect, vi } from "vitest";
import { act, fireEvent, screen, within } from "@testing-library/react";
import { renderWithProviders } from "./test-utils";
import { SommelierHistory } from "../src/components/SommelierHistory";
import { SommelierFavorites } from "../src/components/SommelierFavorites";
import { StatsSection } from "../src/components/StatsSection";
import en from "../src/locales/en.json";
import type { useSommelier } from "../src/hooks/useSommelier";
import { hardRuleViolations } from "./hard-rules";


type SommelierHook = ReturnType<typeof useSommelier>;

const COFFEE = {
  process: "coffee",
  intensity: "strong",
  aroma: "standard",
  temperature: "normal",
  shots: "two",
  portion_ml: 40,
};

function recipe(id: string, name: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    name,
    description: `${name} description`,
    blend: 1,
    component1: COFFEE,
    component2: { ...COFFEE, process: "none", portion_ml: 0 },
    brewed: false,
    machine_phases: [{ component: COFFEE, user_action_before: [] }],
    ...extra,
  };
}

function hook(overrides: Partial<SommelierHook> = {}): SommelierHook {
  return {
    hoppers: { hopper1: null, hopper2: null },
    milkTypes: [],
    favorites: [],
    history: [],
    extras: { syrups: [], toppings: [], liqueurs: [] },
    vocab: null,
    currentSession: null,
    generating: false,
    loading: false,
    error: null,
    generate: vi.fn(),
    brewRecipe: vi.fn(),
    brewFavorite: vi.fn(),
    addFavorite: vi.fn(),
    removeFavorite: vi.fn(),
    loadMoreHistory: vi.fn(),
    refresh: vi.fn(),
    ...overrides,
  } as unknown as SommelierHook;
}

const SESSION = {
  id: "s1",
  mode: "surprise_me",
  preference: null,
  created_at: "2026-09-02T20:49:00.000Z",
  recipes: [recipe("r1", "Pistachio Cloud"), recipe("r2", "Berry Breeze")],
};

describe("SommelierHistory", () => {
  it("offers every past suggestion for brewing", async () => {
    const brewRecipe = vi.fn();
    renderWithProviders(
      <SommelierHistory sommelier={hook({ history: [SESSION] as never, brewRecipe })} />,
    );

    expect(screen.getByText("Pistachio Cloud")).toBeTruthy();
    const brewButtons = screen.getAllByRole("button", { name: /brew/i });
    expect(brewButtons.length).toBe(2);

    // The handler flips a busy flag around an await, so let it settle.
    await act(async () => { fireEvent.click(brewButtons[0]); });
    expect(brewRecipe).toHaveBeenCalledWith("r1");
  });

  it("lets a past suggestion be favourited", () => {
    const addFavorite = vi.fn();
    renderWithProviders(
      <SommelierHistory sommelier={hook({ history: [SESSION] as never, addFavorite })} />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: /favourites/i })[0]);
    expect(addFavorite).toHaveBeenCalledWith("r1");
  });

  it("marks a suggestion that is already a favourite", () => {
    renderWithProviders(
      <SommelierHistory
        sommelier={hook({
          history: [SESSION] as never,
          favorites: [{ id: "f1", source_recipe_id: "r2" }] as never,
        })}
      />,
    );

    const hearts = screen.getAllByRole("button", { name: /favourites/i });
    expect(hearts[0].getAttribute("aria-pressed")).toBe("false");
    expect(hearts[1].getAttribute("aria-pressed")).toBe("true");
  });

  it("shows the sommelier's own words behind the details toggle", () => {
    const withReasoning = {
      ...SESSION,
      recipes: [recipe("r1", "Pistachio Cloud", { reasoning: "Because the evening is long" })],
    };
    renderWithProviders(
      <SommelierHistory sommelier={hook({ history: [withReasoning] as never })} />,
    );

    expect(screen.queryByText("Because the evening is long")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /details/i }));
    expect(screen.getByText("Because the evening is long")).toBeTruthy();
  });

  it("dates the sessions in the app's language, not the browser's", () => {
    renderWithProviders(
      <SommelierHistory sommelier={hook({ history: [SESSION] as never })} />,
    );
    // en locale, long month — never the bare 9/2/2026 the browser default gave.
    expect(screen.getByText(/September/)).toBeTruthy();
  });
});

describe("SommelierFavorites", () => {
  const FAV = {
    ...recipe("f1", "Morning Berry Burst"),
    brew_count: 3,
    last_brewed_at: "2026-09-02T20:49:00.000Z",
    source_recipe_id: "r9",
  };

  it("brews through the favourites path, which is what counts the brews", async () => {
    const brewFavorite = vi.fn();
    renderWithProviders(
      <SommelierFavorites sommelier={hook({ favorites: [FAV] as never, brewFavorite })} />,
    );
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /brew/i })); });
    expect(brewFavorite).toHaveBeenCalledWith("f1");
  });

  it("says how often it was brewed instead of printing x3", () => {
    renderWithProviders(
      <SommelierFavorites sommelier={hook({ favorites: [FAV] as never })} />,
    );
    expect(screen.getByText(/Brewed 3×/)).toBeTruthy();
    expect(screen.queryByText("x3")).toBeNull();
  });

  it("keeps removal available and does not offer to favourite a favourite", () => {
    const removeFavorite = vi.fn();
    const { container } = renderWithProviders(
      <SommelierFavorites sommelier={hook({ favorites: [FAV] as never, removeFavorite })} />,
    );
    expect(within(container).queryByRole("button", { name: /favourites/i })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /remove/i }));
    expect(removeFavorite).toHaveBeenCalledWith("f1");
  });
});

// ---------------------------------------------------------------------------
// The visual contract the rebuild put the sommelier on
// ---------------------------------------------------------------------------

describe("the sommelier drink cell", () => {
  const FAV = {
    ...recipe("f1", "Morning Berry Burst"),
    brew_count: 3,
    last_brewed_at: "2026-09-02T20:49:00.000Z",
    source_recipe_id: "r9",
  };

  it("obeys both hard rules — no radius but a circle, no undeclared fill", () => {
    const { container } = renderWithProviders(
      <SommelierFavorites sommelier={hook({ favorites: [FAV] as never })} />,
    );
    expect(hardRuleViolations(container)).toEqual([]);
  });

  it("puts the drink above the name at grid scale, on the §6.2 stage", () => {
    const { container } = renderWithProviders(
      <SommelierHistory sommelier={hook({ history: [SESSION] as never })} />,
    );

    const cell = container.querySelector('[data-ui="sommelier-cell"]')!;
    expect(cell).toBeTruthy();

    // Five hard reservations, so names and figures line up across a row.
    expect((cell as HTMLElement).style.gridTemplateRows).toBe("1rem 1fr auto 2.75rem 3rem");

    // The stage — glow, contact, reflection — and not a card, ring or fill.
    const stage = cell.querySelector('[data-ui="drink-stage"]')!;
    expect(stage).toBeTruthy();
    expect(stage.querySelector('[data-ui="drink-glow"]')).toBeTruthy();
    expect(stage.querySelector('[data-ui="drink-reflection"]')).toBeTruthy();

    // The drink leads the name: it is earlier in document order.
    const name = cell.querySelector("h3")!;
    expect(name.textContent).toBe("Pistachio Cloud");
    expect(stage.compareDocumentPosition(name) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // Retired: the 84px left-rail thumbnail. A cell's glass is 140.
    const img = stage.querySelector("img");
    if (img) expect(img.getAttribute("width")).not.toBe("84");

    // C11 — the name is set at the same type step a Recipes cell uses. It
    // read `t-title` here, two steps up from the identical cell next door.
    expect(name.className).toContain("t-body");
    expect(name.className).not.toContain("t-title");
  });

  it("scales a cell's glass to its volume on a common baseline (§6.3)", () => {
    // Two drinks in one generation, one twice the pour of the other: the
    // bases land on one line and the glasses do NOT come out the same size.
    //
    // A sommelier drink is drawn PROCEDURALLY — the server attaches an
    // IconSpec to every suggestion (§3.9) because no artwork exists for a name
    // the model just invented — and a procedural drawing carries no scale of
    // its own, so this is where §6.3 does its work. The recipe PNGs are the
    // opposite case and are deliberately left alone: they already draw each
    // glass at its real relative size.
    const spec = {
      spec_version: 1,
      glass: "cup",
      total_ml: 200,
      fill_level: 0.8,
      layers: [{ role: "coffee", ml: 200, fraction: 1, intensity: 0.6, crema: true }],
      foam: null,
      steam: false,
    };
    const session = {
      ...SESSION,
      recipes: [
        recipe("r1", "Long", {
          icon: spec,
          machine_phases: [{ component: { ...COFFEE, portion_ml: 200 }, user_action_before: [] }],
        }),
        recipe("r2", "Short", {
          icon: { ...spec, total_ml: 30 },
          machine_phases: [{ component: { ...COFFEE, portion_ml: 30 }, user_action_before: [] }],
        }),
      ],
    };
    const { container } = renderWithProviders(
      <SommelierHistory sommelier={hook({ history: [session] as never })} />,
    );

    const cells = Array.from(container.querySelectorAll('[data-ui="sommelier-cell"]'));
    const drawn = cells.map(
      (cell) => Number(cell.querySelector("img,svg")!.getAttribute("width")),
    );
    expect(drawn[0]).toBeGreaterThan(drawn[1]);
    // The band is 0.55×–1.0× of the 140px cell glass, never outside it.
    expect(drawn[0]).toBe(140);
    expect(drawn[1]).toBeGreaterThanOrEqual(Math.round(140 * 0.55));

    // The shrunken glass still reserves the full box, so bases align.
    for (const cell of cells) {
      const box = cell.querySelector<HTMLElement>('[data-ui="coffee-icon-baseline"]')!;
      expect(box).toBeTruthy();
      expect(box.style.height).toBe(`${Math.round(140 * (720 / 1080))}px`);
    }
  });

  it("splits the number from its unit in the value strip (C22)", () => {
    const { container } = renderWithProviders(
      <SommelierHistory sommelier={hook({ history: [SESSION] as never })} />,
    );
    const cell = container.querySelector('[data-ui="sommelier-cell"]')!;
    const strip = cell.children[3] as HTMLElement;

    // …the label half in accent, the figure in primary, the unit one value
    // step quieter — three spans, never one baked "40 ml" string.
    const value = Array.from(strip.querySelectorAll("span")).find(
      (s) => s.textContent?.trim() === "40",
    )!;
    expect(value).toBeTruthy();
    expect(value.className).toContain("num");
    expect(value.className).toContain("text-primary");
    const unit = value.nextElementSibling as HTMLElement;
    expect(unit.textContent).toBe(" ml");
    expect(unit.className).toContain("text-tertiary");
  });

  it("gives the details disclosure a word beside its chevron, and it toggles (R8)", () => {
    renderWithProviders(<SommelierHistory sommelier={hook({ history: [SESSION] as never })} />);
    const details = screen.getAllByRole("button", { name: /details/i })[0];

    // Not a naked 16px chevron: the quietest target in the cell now says
    // what it does, and `aria-expanded` is a live contract in both directions.
    expect(details.textContent).toContain("Details");
    expect(details.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(details);
    expect(
      screen.getAllByRole("button", { name: /details/i })[0].getAttribute("aria-expanded"),
    ).toBe("true");
  });

  it("brews from a bare word — no chip, and no underline either", () => {
    renderWithProviders(<SommelierHistory sommelier={hook({ history: [SESSION] as never })} />);
    const brew = screen.getAllByRole("button", { name: /brew/i })[0];

    expect(brew.style.backgroundColor).toBe("");
    expect(brew.style.borderRadius).toBe("0px");
    // An underline says "chosen" in this language, so an action must not wear
    // one: eight cells each underlining their verb read as eight selections.
    expect(brew.style.borderBottomColor).toBe("");
    expect(brew.style.borderBottomWidth).toBe("");
    // §7.7 / C3 — the same verb must not sit two type steps below the
    // Recipes Brew, and `Word` has exactly one type step for that reason.
    expect(brew.className).toContain("t-body");
    expect(brew.className).toContain("tap");
    expect(brew.className).toContain("press");
    expect(brew.getAttribute("data-ui")).toBe("word");
    // C2 — one verb, one key. `sommelier.brew` had drifted to a different
    // Russian word from `brew.brew` and nothing in the app caught it.
    expect(brew.textContent).toBe(en["brew.brew"]);
    expect(en).not.toHaveProperty("sommelier.brew");
  });

  it("opens the details drawer as a scrim over one flat panel", () => {
    renderWithProviders(
      <SommelierHistory
        sommelier={hook({
          history: [
            { ...SESSION, recipes: [recipe("r1", "Pistachio Cloud", { reasoning: "Long evening" })] },
          ] as never,
        })}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /details/i }));

    const panel = screen.getByRole("dialog");
    expect(panel.getAttribute("data-fill")).toBe("panel");
    expect(panel.style.borderRadius).toBe("0px");
    expect(panel.style.boxShadow).toBe("none");
    expect(screen.getByText("Long evening")).toBeTruthy();

    // C7/C8/C9/R3 — the shared `Panel`: one measure, one header, one close
    // control (an X, not this file's private ChevronUp), and the fill set as
    // a `backgroundColor` longhand rather than through the `surface` class,
    // whose `background` shorthand jsdom drops entirely.
    expect(panel.getAttribute("data-ui")).toBe("panel");
    expect(panel.getAttribute("data-measure")).toBe("lg");
    expect(panel.style.backgroundColor).toBe("var(--surface)");
    expect(panel.className).not.toContain("surface");
    expect(panel.querySelector('[data-ui="panel-close"]')).toBeTruthy();
  });
});

describe("the sommelier lists page instead of scrolling", () => {
  function manyFavorites(n: number) {
    return Array.from({ length: n }, (_, i) => ({
      ...recipe(`f${i}`, `Drink ${i}`),
      brew_count: 0,
      source_recipe_id: `r${i}`,
    }));
  }

  it("never scrolls a list body — §G2.2 pages it", () => {
    const { container } = renderWithProviders(
      <SommelierFavorites sommelier={hook({ favorites: manyFavorites(12) as never })} />,
    );
    expect(container.querySelector(".overflow-y-auto")).toBeNull();
    // …and no `max-w-*` cap survives on the structure that holds the drinks.
    const matrix = container.querySelector('[data-ui="sommelier-matrix"]') as HTMLElement;
    expect(matrix).toBeTruthy();
    expect(matrix.className).not.toMatch(/max-w-/);
  });

  it("marks position with the shared Dot — a solid disc now, rings for the rest", () => {
    const { container } = renderWithProviders(
      <SommelierFavorites sommelier={hook({ favorites: manyFavorites(12) as never })} />,
    );
    // C20 — one implementation of the mark, not a third hand-rolled copy.
    const dots = Array.from(container.querySelectorAll<HTMLElement>('[data-ui="dot"]'));
    expect(dots.length).toBe(2);
    expect(dots.map((d) => d.dataset.current)).toEqual(["true", "false"]);
    for (const dot of dots) {
      expect(dot.style.width).toBe("var(--dot)");
      expect(dot.style.height).toBe("var(--dot)");
      expect(dot.style.borderRadius).toBe("50%");
      // C21 — a position mark declares itself "dot", which is what the fill
      // inventory is queried on. This copy used to claim "meter".
      expect(dot.getAttribute("data-fill")).toBe("dot");
    }
    expect(dots[0].style.backgroundColor).toBe("var(--accent)");
    // …and the current disc drops its ring, which this copy alone kept.
    expect(dots[0].style.borderWidth).toBe("0px");
    expect(dots[1].style.backgroundColor).toBe("var(--bg)");
    expect(dots[1].style.borderColor).toBe("var(--accent)");
  });

  it("names each page in the user's language, not in hardcoded English", () => {
    const { container } = renderWithProviders(
      <SommelierFavorites sommelier={hook({ favorites: manyFavorites(12) as never })} />,
    );
    // R2 — the bare numeral was a workaround for a string no locale carried.
    const marks = Array.from(container.querySelectorAll<HTMLElement>('[data-ui="dot"]')).map(
      (d) => d.closest("button")!,
    );
    expect(marks.map((m) => m.getAttribute("aria-label"))).toEqual(["Page 1", "Page 2"]);
  });

  it("turns a page when its mark is pressed, and keeps the 48px reach", () => {
    const { container } = renderWithProviders(
      <SommelierFavorites sommelier={hook({ favorites: manyFavorites(12) as never })} />,
    );
    const marks = Array.from(container.querySelectorAll<HTMLElement>('[data-ui="dot"]')).map(
      (d) => d.closest("button")!,
    );
    expect(marks[0].className).toContain("tap");
    fireEvent.click(marks[1]);
    expect(
      container.querySelector<HTMLElement>('[data-ui="dot"][data-current="true"]')!
        .closest("button"),
    ).toBe(marks[1]);
  });

  it("pages every shelf at one cell proportion (C14)", () => {
    const { container } = renderWithProviders(
      <SommelierFavorites sommelier={hook({ favorites: manyFavorites(12) as never })} />,
    );
    // The frame is declared, not grown: explicit row tracks capped at the
    // cell's own measure, so a page that is not full cannot inflate its
    // cells the way a one-row Generate page used to.
    for (const m of Array.from(
      container.querySelectorAll<HTMLElement>('[data-ui="sommelier-matrix"]'),
    )) {
      expect(m.style.gridTemplateColumns).toBe("repeat(4, minmax(0, 1fr))");
      expect(m.style.gridTemplateRows).toBe("repeat(2, minmax(0, 280px))");
      expect(m.style.gridAutoRows).toBe("");
    }
  });

  it("asks for more history with a word, not a ringed slab", () => {
    const sessions = Array.from({ length: 20 }, (_, i) => ({
      ...SESSION,
      id: `s${i}`,
      created_at: `2026-09-02T${String(i % 24).padStart(2, "0")}:49:00.000Z`,
    }));
    const loadMoreHistory = vi.fn();
    renderWithProviders(
      <SommelierHistory sommelier={hook({ history: sessions as never, loadMoreHistory })} />,
    );
    const more = screen.getByRole("button", { name: /load more/i });
    expect(more.style.backgroundColor).toBe("");
    expect(more.style.borderRadius).toBe("0px");
    // C5 — the shared `Word`, and bare: an underline in this language means
    // "chosen", so an action wears none. This copy used to draw a --border
    // rule under itself, one of eight hand-rolled variants of the same word.
    expect(more.getAttribute("data-ui")).toBe("word");
    expect(more.style.borderBottomWidth).toBe("");
    expect(more.style.borderBottomColor).toBe("");
    fireEvent.click(more);
    expect(loadMoreHistory).toHaveBeenCalled();
  });
});

describe("StatsSection", () => {
  function entities(counts: Record<string, number>, total = 100) {
    return {
      "sensor.mel_total_cups": {
        entity_id: "sensor.mel_total_cups",
        state: String(total),
        attributes: { friendly_name: "Total", ...counts },
        last_changed: "",
        last_updated: "",
        context: { id: "1", parent_id: null, user_id: null },
      },
    } as never;
  }

  it("draws the tiles as a hairline mosaic — no ring, no radius, no tile fill", () => {
    const { container } = renderWithProviders(
      <StatsSection entities={entities({ Espresso: 40, Cappuccino: 10 })} prefix="mel" />,
    );
    expect(hardRuleViolations(container)).toEqual([]);

    const mosaic = container.querySelector<HTMLElement>('[data-ui="stats-mosaic"]')!;
    expect(mosaic.style.gap).toBe("1px");
    expect(mosaic.style.backgroundColor).toBe("var(--section-divider)");

    for (const tile of Array.from(container.querySelectorAll<HTMLElement>('[data-ui="stat-tile"]'))) {
      // A cell reveals the page ground; it does not paint a surface of its own.
      expect(tile.style.backgroundColor).toBe("var(--bg)");
      expect(tile.className).not.toMatch(/ring|rounded|aspect-square/);
    }
  });

  it("caps the magnitude wash at the §5.D ceiling and leaves the glass alone", () => {
    const { container } = renderWithProviders(
      <StatsSection entities={entities({ Espresso: 40, Cappuccino: 10 })} prefix="mel" />,
    );
    // The value tint has its own name now: the drink's §6.2 glow is a
    // `data-fill="glow"` too, and the two must not be read as one another.
    const washes = Array.from(container.querySelectorAll<HTMLElement>('[data-ui="stat-wash"]'));
    // The leader is the row maximum: 0.06 + 1 × 0.10. Nothing may exceed it.
    expect(washes[0].style.opacity).toBe("0.16");
    expect(Number(washes[1].style.opacity)).toBeLessThan(0.16);
    for (const wash of washes) expect(Number(wash.style.opacity)).toBeLessThanOrEqual(0.16);

    // The glass is NOT a second encoding of the count. It is drawn at the size
    // the artwork gives it — the drink's real size next to its neighbours —
    // and how often it was made is the wash behind it. Scaling it by count
    // would say "an espresso is bigger than a cappuccino because you drink
    // more of them", which is not a fact about either drink.
    const tiles = Array.from(container.querySelectorAll<HTMLElement>('[data-ui="stat-tile"]'));
    const [lead, minor] = tiles.map((tile) => tile.querySelector("img")!);
    expect(lead.getAttribute("width")).toBe(minor.getAttribute("width"));
    // …bottom-aligned inside a box of the FULL unscaled height, so the bases
    // of a row land on one line while the tops stay ragged.
    for (const tile of tiles) {
      const box = tile.querySelector<HTMLElement>('[data-ui="coffee-icon-baseline"]')!;
      expect(box.style.height).toBe(`${Math.round(64 * (720 / 1080))}px`);
    }
  });

  it("stands its drink on the same ground as every other drink (C16)", () => {
    const { container } = renderWithProviders(
      <StatsSection entities={entities({ Espresso: 40, Cappuccino: 10 })} prefix="mel" />,
    );
    for (const tile of Array.from(
      container.querySelectorAll<HTMLElement>('[data-ui="stat-tile"]'),
    )) {
      const stage = tile.querySelector('[data-ui="drink-stage"]')!;
      expect(stage).toBeTruthy();
      expect(stage.querySelector('[data-ui="drink-glow"]')).toBeTruthy();
      expect(stage.querySelector('[data-ui="drink-contact"]')).toBeTruthy();
      expect(stage.querySelector('[data-ui="drink-reflection"]')).toBeTruthy();
    }
  });

  it("marks the leader with the shared Dot, not with a meter segment (C21)", () => {
    const { container } = renderWithProviders(
      <StatsSection entities={entities({ Espresso: 40, Cappuccino: 10 })} prefix="mel" />,
    );
    const marks = Array.from(container.querySelectorAll<HTMLElement>('[data-ui="dot"]'));
    expect(marks.length).toBe(1);
    expect(marks[0].getAttribute("data-fill")).toBe("dot");
    expect(marks[0].getAttribute("data-current")).toBe("true");
    expect(marks[0].style.borderRadius).toBe("50%");
  });
});