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
import type { useSommelier } from "../src/hooks/useSommelier";

/**
 * The two hard rules, read off the rendered tree.
 *
 * Radius: only a true circle (50%) survives; every other rounding — inline or
 * via a `rounded-*` utility — is a violation. Fill: an element that paints a
 * background must DECLARE what the paint is, and only the §5 carve-outs are
 * legal names.
 */
/**
 * The primitives' allowlist, extended by the two carve-outs this pass needed:
 * `scrim`/`panel` (§5.A/§5.B, the details drawer) and `ground` — §S4.3's
 * 1px-gap mosaic, where a cell paints `--bg` to let the page ground show
 * through the hairline grid rather than to give itself a surface. `ground` is
 * held to that one value below, so it cannot become a licence for a tint.
 */
const LEGAL_FILLS = new Set([
  "commit",
  "meter",
  "glow",
  "contact",
  "rule",
  "scrim",
  "panel",
  "ground",
]);

function hardRuleViolations(root: HTMLElement): string[] {
  const found: string[] = [];
  for (const el of Array.from(root.querySelectorAll<HTMLElement>("*"))) {
    const cls = el.getAttribute("class") ?? "";
    if (/(^|\s)rounded-/.test(cls)) found.push(`rounded class: ${cls}`);
    if (/(^|\s)ring-[0-9]/.test(cls)) found.push(`ring class: ${cls}`);
    if (/(^|\s)shadow-/.test(cls)) found.push(`shadow class: ${cls}`);
    if (/tracking-(wide|widest)/.test(cls)) found.push(`tracking class: ${cls}`);
    if (/(^|\s)uppercase(\s|$)/.test(cls)) found.push(`uppercase class: ${cls}`);

    const radius = el.style.borderRadius;
    if (radius && radius !== "0px" && radius !== "0" && radius !== "50%") {
      found.push(`inline radius: ${radius}`);
    }
    if (el.style.letterSpacing) found.push(`inline letterSpacing: ${el.style.letterSpacing}`);
    if (el.style.boxShadow && el.style.boxShadow !== "none") {
      found.push(`inline boxShadow: ${el.style.boxShadow}`);
    }

    const paints = Boolean(el.style.backgroundColor) || Boolean(el.style.backgroundImage);
    const declared = el.getAttribute("data-fill");
    if (paints && (declared === null || !LEGAL_FILLS.has(declared))) {
      found.push(`undeclared fill: ${el.tagName}.${cls} → ${declared ?? "(none)"}`);
    }
    if (declared === "ground" && el.style.backgroundColor !== "var(--bg)") {
      found.push(`"ground" fill that is not the page ground: ${el.style.backgroundColor}`);
    }
  }
  return found;
}

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
    // §7.7 — the same verb must not sit two type steps below the Recipes Brew.
    expect(brew.className).toContain("t-body");
    expect(brew.className).toContain("tap");
    expect(brew.className).toContain("press");
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

  it("marks position with 8px circles — a solid disc now, rings for the rest", () => {
    const { container } = renderWithProviders(
      <SommelierFavorites sommelier={hook({ favorites: manyFavorites(12) as never })} />,
    );
    const dots = Array.from(container.querySelectorAll<HTMLElement>('[data-ui="pager-dot"]'));
    expect(dots.length).toBe(2);
    expect(dots.map((d) => d.dataset.selected)).toEqual(["true", "false"]);
    for (const dot of dots) {
      expect(dot.style.width).toBe("var(--dot)");
      expect(dot.style.height).toBe("var(--dot)");
      expect(dot.style.borderRadius).toBe("50%");
    }
    expect(dots[0].style.backgroundColor).toBe("var(--accent)");
    expect(dots[1].style.backgroundColor).toBe("var(--bg)");
    expect(dots[1].style.borderColor).toBe("var(--accent)");
  });

  it("turns a page when its mark is pressed, and keeps the 48px reach", () => {
    const { container } = renderWithProviders(
      <SommelierFavorites sommelier={hook({ favorites: manyFavorites(12) as never })} />,
    );
    const marks = Array.from(container.querySelectorAll<HTMLElement>('[data-ui="pager-dot"]')).map(
      (d) => d.closest("button")!,
    );
    expect(marks[0].className).toContain("tap");
    fireEvent.click(marks[1]);
    expect(
      container.querySelector<HTMLElement>('[data-ui="pager-dot"][data-selected="true"]')!
        .closest("button"),
    ).toBe(marks[1]);
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
    expect(more.style.borderBottomColor).toBe("var(--border)");
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

  it("caps the magnitude wash at the §5.D ceiling and scales the glass by count", () => {
    const { container } = renderWithProviders(
      <StatsSection entities={entities({ Espresso: 40, Cappuccino: 10 })} prefix="mel" />,
    );
    const washes = Array.from(container.querySelectorAll<HTMLElement>('[data-fill="glow"]'));
    // The leader is the row maximum: 0.06 + 1 × 0.10. Nothing may exceed it.
    expect(washes[0].style.opacity).toBe("0.16");
    expect(Number(washes[1].style.opacity)).toBeLessThan(0.16);
    for (const wash of washes) expect(Number(wash.style.opacity)).toBeLessThanOrEqual(0.16);

    // §6.3 truth scale: a quarter of the leader's count is a smaller glass.
    const [lead, minor] = Array.from(container.querySelectorAll<HTMLElement>("img"));
    expect(Number(lead.getAttribute("width"))).toBeGreaterThan(
      Number(minor.getAttribute("width")),
    );
  });
});
