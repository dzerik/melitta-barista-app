import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "./test-utils";
import { RecipeCarousel } from "../src/components/RecipeCarousel";

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
    const dots = screen.getAllByRole("button", { name: /Go to slide/ });
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
    expect(screen.queryByRole("button", { name: /Go to slide/ })).not.toBeInTheDocument();
    expect(screen.getByText("1 / 15")).toBeInTheDocument();
  });

  it("dot click calls embla scrollTo", async () => {
    const user = userEvent.setup();
    renderWithProviders(<RecipeCarousel {...defaultProps} />);
    const dots = screen.getAllByRole("button", { name: /Go to slide/ });

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
    expect(screen.queryByRole("button", { name: /Go to slide/ })).not.toBeInTheDocument();
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

  it("background highlights only when isSelected AND isCurrent", () => {
    const { container } = renderWithProviders(<RecipeCarousel {...defaultProps} />);
    const cards = container.querySelectorAll("button[class*='cursor-pointer']");
    // First card: current + selected → gradient with recipe-selected-bg
    expect((cards[0] as HTMLElement).style.background).toContain("linear-gradient");
    // Second card: not current → transparent
    expect(cards[1]).toHaveStyle({ background: "transparent" });
  });
});
