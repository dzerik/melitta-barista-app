import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "./test-utils";
import { RecipeCarousel } from "../src/components/RecipeCarousel";
import { attachContractRecipes, recipeDisplayName } from "../src/lib/recipes";
import { setServerStrings, resetServerStrings } from "../src/lib/server-strings";
import { MELITTA_CONTRACT, clone } from "./fixtures/contracts";

// Mock embla-carousel-react
const mockScrollTo = vi.fn();
const mockSelectedScrollSnap = vi.fn(() => 0);
const mockOn = vi.fn();
const mockOff = vi.fn();

vi.mock("embla-carousel-react", () => ({
  default: () => {
    const ref = vi.fn();
    return [
      ref,
      {
        scrollTo: mockScrollTo,
        selectedScrollSnap: mockSelectedScrollSnap,
        on: mockOn,
        off: mockOff,
        canScrollPrev: () => false,
        canScrollNext: () => true,
      },
    ];
  },
}));

const MOCK_RECIPES = [
  { name: "Espresso", isSelected: true, details: undefined },
  { name: "Cappuccino", isSelected: false, details: undefined },
  { name: "Latte Macchiato", isSelected: false, details: undefined },
];

const MOCK_RECIPES_WITH_DETAILS = [
  {
    name: "Espresso",
    isSelected: true,
    details: {
      c1_process: "coffee",
      c1_intensity: "strong",
      c1_aroma: "standard",
      c1_temperature: "normal",
      c1_shots: 1,
      c1_portion_ml: 40,
      c2_process: "none",
      c2_intensity: "medium",
      c2_aroma: "standard",
      c2_temperature: "normal",
      c2_shots: 0,
      c2_portion_ml: 0,
    },
  },
  { name: "Cappuccino", isSelected: false, details: undefined },
];

describe("RecipeCarousel", () => {
  const defaultProps = {
    recipes: MOCK_RECIPES,
    onSelect: vi.fn(),
    onBrew: vi.fn(),
    renderInfo: vi.fn(() => <span data-testid="recipe-info">Info</span>),
    brewLabel: "Brew",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("renders all recipe slides", () => {
    renderWithProviders(<RecipeCarousel {...defaultProps} />);
    expect(screen.getByText("Espresso")).toBeInTheDocument();
    expect(screen.getByText("Cappuccino")).toBeInTheDocument();
    expect(screen.getByText("Latte Macchiato")).toBeInTheDocument();
  });

  it("renders dot indicators for ≤10 recipes", () => {
    renderWithProviders(<RecipeCarousel {...defaultProps} />);
    const dots = screen.getAllByRole("button", { name: /^Page / });
    expect(dots).toHaveLength(3);
  });

  it("renders counter instead of dots for >10 recipes", () => {
    const manyRecipes = Array.from({ length: 15 }, (_, i) => ({
      name: `Recipe ${i + 1}`,
      isSelected: i === 0,
    }));
    renderWithProviders(
      <RecipeCarousel {...defaultProps} recipes={manyRecipes} />,
    );
    expect(screen.queryByRole("button", { name: /^Page / })).not.toBeInTheDocument();
    expect(screen.getByText("1 / 15")).toBeInTheDocument();
  });

  it("dot click calls embla scrollTo", async () => {
    const user = userEvent.setup();
    renderWithProviders(<RecipeCarousel {...defaultProps} />);
    const dots = screen.getAllByRole("button", { name: /^Page / });

    await user.click(dots[1]);
    expect(mockScrollTo).toHaveBeenCalledWith(1);
  });

  it("shows brew button on current slide", () => {
    renderWithProviders(<RecipeCarousel {...defaultProps} />);
    expect(screen.getByText("Brew")).toBeInTheDocument();
  });

  it("shows recipe name without brew prefix", () => {
    renderWithProviders(<RecipeCarousel {...defaultProps} />);
    expect(screen.getByText("Espresso")).toBeInTheDocument();
    expect(screen.queryByText("Brew Espresso")).not.toBeInTheDocument();
  });

  it("renders recipe info only when selected AND current", () => {
    renderWithProviders(
      <RecipeCarousel
        {...defaultProps}
        recipes={MOCK_RECIPES_WITH_DETAILS}
        renderInfo={() => <span data-testid="recipe-info">Info</span>}
      />,
    );
    expect(screen.getByTestId("recipe-info")).toBeInTheDocument();
  });

  it("renders recipe info for current slide even when not selected", () => {
    const recipes = [
      { name: "Espresso", isSelected: false, details: MOCK_RECIPES_WITH_DETAILS[0].details },
    ];
    renderWithProviders(
      <RecipeCarousel
        {...defaultProps}
        recipes={recipes}
        renderInfo={() => <span data-testid="recipe-info">Info</span>}
      />,
    );
    // Details are always shown on the center slide (regardless of isSelected)
    expect(screen.getByTestId("recipe-info")).toBeInTheDocument();
  });

  it("registers embla event listeners", () => {
    renderWithProviders(<RecipeCarousel {...defaultProps} />);
    expect(mockOn).toHaveBeenCalledWith("select", expect.any(Function));
    expect(mockOn).toHaveBeenCalledWith("reInit", expect.any(Function));
  });

  it("does not render dots for single recipe", () => {
    renderWithProviders(
      <RecipeCarousel
        {...defaultProps}
        recipes={[{ name: "Espresso", isSelected: true }]}
      />,
    );
    expect(screen.queryByRole("button", { name: /^Page / })).not.toBeInTheDocument();
  });

  it("has data-embla-carousel attribute for swipe conflict prevention", () => {
    const { container } = renderWithProviders(<RecipeCarousel {...defaultProps} />);
    expect(container.querySelector("[data-embla-carousel]")).toBeInTheDocument();
  });

  it("clicking brew button on selected slide triggers onBrew", async () => {
    const user = userEvent.setup();
    const onBrew = vi.fn();
    const onSelect = vi.fn();
    renderWithProviders(
      <RecipeCarousel {...defaultProps} onBrew={onBrew} onSelect={onSelect} />,
    );
    await user.click(screen.getByText("Brew"));
    expect(onBrew).toHaveBeenCalledWith("Espresso");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("clicking brew button on non-selected slide triggers onSelect", async () => {
    const user = userEvent.setup();
    const onBrew = vi.fn();
    const onSelect = vi.fn();
    const recipes = [
      { name: "Espresso", isSelected: false },
      { name: "Cappuccino", isSelected: false },
    ];
    renderWithProviders(
      <RecipeCarousel {...defaultProps} recipes={recipes} onBrew={onBrew} onSelect={onSelect} />,
    );
    await user.click(screen.getByText("Brew"));
    expect(onSelect).toHaveBeenCalledWith("Espresso");
    expect(onBrew).not.toHaveBeenCalled();
  });

  it("clicking non-current slide calls scrollTo (no select/brew)", async () => {
    const user = userEvent.setup();
    const onBrew = vi.fn();
    const onSelect = vi.fn();
    renderWithProviders(
      <RecipeCarousel {...defaultProps} onBrew={onBrew} onSelect={onSelect} />,
    );
    await user.click(screen.getByText("Cappuccino").closest("button[class*='cursor-pointer']")!);
    expect(mockScrollTo).toHaveBeenCalledWith(1);
    expect(onBrew).not.toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("swiping does NOT trigger onSelect (visual-only)", () => {
    renderWithProviders(<RecipeCarousel {...defaultProps} />);
    // Simulate embla's select event (swipe)
    const selectCallback = mockOn.mock.calls.find(
      ([event]: [string]) => event === "select",
    )?.[1];
    expect(selectCallback).toBeDefined();

    // Call the select handler as embla would on swipe
    selectCallback();

    // onSelect should NOT have been called
    expect(defaultProps.onSelect).not.toHaveBeenCalled();
  });

  it("marks the current cell with the drink glow, not with a fill or a ring", () => {
    const { container } = renderWithProviders(<RecipeCarousel {...defaultProps} />);
    const stages = container.querySelectorAll('[data-ui="drink-stage"]');
    expect(stages).toHaveLength(3);
    // The active cell burns its glow at 1×; every other cell idles at 0.55×.
    expect(stages[0].getAttribute("data-active")).toBe("true");
    expect(stages[1].getAttribute("data-active")).toBe("false");

    const cards = container.querySelectorAll("button[class*='cursor-pointer']");
    // No card paints itself any more, in either state.
    for (const card of cards) {
      const el = card as HTMLElement;
      expect(el.style.backgroundColor).toBe("");
      expect(el.style.background).toBe("");
      expect(el.style.boxShadow).toBe("none");
      expect(el.style.borderRadius).toBe("0px");
      expect(el.className).not.toMatch(/rounded-|ring-|shadow-/);
    }
  });

  it("selection is the name in a lit accent underline, with the slot always reserved", () => {
    const { container } = renderWithProviders(<RecipeCarousel {...defaultProps} />);
    const cards = container.querySelectorAll('[data-ui="recipe-card"]');
    expect(cards[0].getAttribute("data-underline")).toBe("lit");
    expect(cards[1].getAttribute("data-underline")).toBe("reserved");

    const names = container.querySelectorAll('[data-ui="recipe-name"]');
    const chosen = names[0] as HTMLElement;
    const other = names[1] as HTMLElement;
    expect(chosen.style.borderBottomColor).toBe("var(--accent)");
    expect(chosen.style.color).toBe("var(--text-primary)");
    // The underline is declared in both states so nothing shifts on selection.
    expect(other.style.borderBottomStyle).toBe("solid");
    expect(other.style.borderBottomColor).toBe("transparent");
  });

  it("arrows are bare glyphs with a 48px reach and no disc plate", () => {
    renderWithProviders(<RecipeCarousel {...defaultProps} />);
    for (const name of ["Previous", "Next"]) {
      const arrow = screen.getByRole("button", { name });
      expect(arrow.className).toContain("tap");
      expect(arrow.className).toContain("press");
      expect(arrow.className).not.toMatch(/rounded-/);
      expect(arrow.style.backgroundColor).toBe("");
      expect(arrow.querySelector("polygon")).toBeInTheDocument();
    }
  });

  it("pager dots are 8px circles — a solid disc for the current page, rings for the rest", () => {
    const { container } = renderWithProviders(<RecipeCarousel {...defaultProps} />);
    const dots = container.querySelectorAll('[data-ui="dot"]');
    expect(dots).toHaveLength(3);

    const current = dots[0] as HTMLElement;
    const other = dots[1] as HTMLElement;
    expect(current.getAttribute("data-current")).toBe("true");
    expect(current.style.backgroundColor).toBe("var(--accent)");
    expect(other.style.borderColor).toBe("var(--accent)");
    expect(other.style.backgroundColor).toBe("var(--bg)");
    // Same painted size in both states — no growing capsule, no opacity fade.
    expect(current.style.width).toBe("var(--dot)");
    expect(other.style.width).toBe("var(--dot)");
    expect(current.style.width).toBe(current.style.height);

    // The mark stays 8px; the reach does not.
    const reach = screen.getAllByRole("button", { name: /^Page / });
    for (const button of reach) {
      expect(button.className).toContain("tap");
    }
  });

  it("only the tap that actually brews is painted as the commit rectangle", () => {
    const { container, unmount } = renderWithProviders(
      <RecipeCarousel {...defaultProps} />,
    );
    const commit = container.querySelector('[data-ui="commit"]') as HTMLElement;
    expect(commit).toBeInTheDocument();
    expect(commit.getAttribute("data-fill")).toBe("commit");
    expect(commit.style.borderRadius).toBe("0px");
    expect(commit.style.backgroundColor).toBe("var(--accent)");
    expect(commit.style.boxShadow).toBe("none");
    // Width comes from the caller's column, never from a slide percentage.
    expect(commit.className).toContain("w-full");
    expect(commit.className).not.toMatch(/max-w-|px-16/);
    unmount();

    // Stage one of the two-stage gesture only selects, so it is a bare word.
    const staged = renderWithProviders(
      <RecipeCarousel
        {...defaultProps}
        recipes={[{ name: "Espresso", isSelected: false }, { name: "Cappuccino", isSelected: false }]}
      />,
    );
    expect(staged.container.querySelector('[data-ui="commit"]')).toBeNull();
    const word = screen.getByText("Brew").closest("button") as HTMLElement;
    expect(word.getAttribute("data-ui")).toBe("word");
    expect(word.style.backgroundColor).toBe("");
    // An underline says "chosen" in this language, so an ACTION wears none —
    // the eight hand-rolled copies of this word disagreed about its colour
    // precisely because none of them could say what the line meant (C5).
    expect(word.style.borderBottomStyle).toBe("");
    expect(word.style.borderBottomColor).toBe("");
  });

  it("puts brew in the one action band, opened by the 2px accent rule", () => {
    const { container } = renderWithProviders(<RecipeCarousel {...defaultProps} />);
    const band = container.querySelector('[data-ui="action-band"]') as HTMLElement;
    expect(band).toBeInTheDocument();

    const rule = band.querySelector('[data-ui="rule"]') as HTMLElement;
    expect(rule.style.height).toBe("2px");
    expect(rule.style.backgroundColor).toBe("var(--accent)");

    // Exactly one commit lives in the band, and it is the band's commit slot.
    const commits = band.querySelectorAll('[data-ui="commit"]');
    expect(commits).toHaveLength(1);
    expect(
      band.querySelector('[data-ui="action-band-commit"]')!.contains(commits[0]),
    ).toBe(true);
  });

  it("names both arrows and every pager dot from the bundle, never in English literals", () => {
    renderWithProviders(<RecipeCarousel {...defaultProps} />);
    // The four labels the audit found hardcoded (R2) now come from
    // `app.previous` / `app.next` / `app.page`, which all 29 bundles carry.
    expect(screen.getByRole("button", { name: "Previous" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Page 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Page 3" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /slide/i })).not.toBeInTheDocument();
  });
});

describe("RecipeCarousel — contract catalog adoption (v1)", () => {
  const carouselProps = {
    onSelect: vi.fn(),
    onBrew: vi.fn(),
    renderInfo: vi.fn(() => <span data-testid="recipe-info">Info</span>),
    brewLabel: "Brew",
  };

  afterEach(() => {
    resetServerStrings();
  });

  it("attachContractRecipes joins icon spec and name_key by display name", () => {
    const contract = clone(MELITTA_CONTRACT);
    contract.recipes[0].name_key = "espresso";
    const joined = attachContractRecipes(MOCK_RECIPES, contract);
    expect(joined[0].nameKey).toBe("espresso");
    expect(joined[0].icon).toEqual(contract.recipes[0].icon);
    // Rows without a catalog match pass through untouched
    expect(joined[1]).toEqual(MOCK_RECIPES[1]);
    expect(joined[1].icon).toBeUndefined();
  });

  it("attachContractRecipes is a no-op without a contract (legacy fallback)", () => {
    expect(attachContractRecipes(MOCK_RECIPES, null)).toEqual(MOCK_RECIPES);
  });

  it("renders served icon specs as SVG drawings inside the carousel", () => {
    const contract = clone(MELITTA_CONTRACT);
    contract.recipes[0].name_key = "espresso";
    const { container } = renderWithProviders(
      <RecipeCarousel
        {...carouselProps}
        recipes={attachContractRecipes(MOCK_RECIPES, contract)}
      />,
    );
    const svg = container.querySelector('svg[data-icon-spec][aria-label="Espresso"]');
    expect(svg).toBeInTheDocument();
  });

  it("labels recipes via served recipes.name.<name_key> strings, falling back to the name", () => {
    setServerStrings({ "recipes.name.espresso": "Эспрессо" });
    const recipes = [
      { name: "Espresso", isSelected: true, nameKey: "espresso" },
      { name: "Cappuccino", isSelected: false, nameKey: "cappuccino" },
    ];
    renderWithProviders(<RecipeCarousel {...carouselProps} recipes={recipes} />);
    expect(screen.getByText("Эспрессо")).toBeInTheDocument();
    expect(screen.queryByText("Espresso")).not.toBeInTheDocument();
    // no served string for cappuccino → English display name (legacy tier)
    expect(screen.getByText("Cappuccino")).toBeInTheDocument();
  });

  it("recipeDisplayName never depends on server strings when no name_key is served", () => {
    setServerStrings({ "recipes.name.espresso": "Should not be used" });
    expect(recipeDisplayName({ name: "Espresso" })).toBe("Espresso");
    expect(recipeDisplayName({ name: "Espresso", nameKey: "espresso" })).toBe("Should not be used");
    resetServerStrings();
    expect(recipeDisplayName({ name: "Espresso", nameKey: "espresso" })).toBe("Espresso");
  });
});
