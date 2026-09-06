/**
 * The three sommelier lists share one recipe card, and history is a place you
 * can order from — it used to be a read-only log of names.
 */
import { describe, it, expect, vi } from "vitest";
import { act, fireEvent, screen, within } from "@testing-library/react";
import { renderWithProviders } from "./test-utils";
import { SommelierHistory } from "../src/components/SommelierHistory";
import { SommelierFavorites } from "../src/components/SommelierFavorites";
import type { useSommelier } from "../src/hooks/useSommelier";

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
