import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import type { Connection, HassEntities } from "home-assistant-js-websocket";
import { renderWithProviders } from "./test-utils";
import { hardRuleViolations } from "./hard-rules";
import { FreestyleSection } from "../src/components/FreestyleSection";
import { RecipeEditModal } from "../src/components/RecipeEditModal";
import { GLASS_ASPECT, GLASS_BASE_FRACTION } from "../src/components/FreestyleGlass";
import type { DirectKeyRecipe } from "../src/lib/entities";

/**
 * Freestyle and the DirectKey editor draw the SAME three-up configure surface —
 * the same parameter rows, the same glass, the same commit — one on the page
 * and one inside a panel. Nothing rendered either of them before, which is how
 * they drifted into two hero sizes, two grounds, two modal headers and two
 * copies of every row (C7, C8, C9, C15, C29, C30, C31, C34).
 *
 * These tests pin the shapes, not the pixels: that both surfaces reach for the
 * same primitives, and that neither breaks the two hard rules.
 */

const CTX = { id: "", user_id: null, parent_id: null };
function ent(state: string, attributes: Record<string, unknown> = {}) {
  return { entity_id: "", state, attributes, last_changed: "", last_updated: "", context: CTX };
}

const conn = { sendMessagePromise: vi.fn().mockResolvedValue({}) } as unknown as Connection;

const COMPONENT_1 = {
  c1_process: "coffee",
  c1_intensity: "medium",
  c1_aroma: "standard",
  c1_temperature: "normal",
  c1_shots: 1,
  c1_portion_ml: 40,
};

const entities = {
  "sensor.mb_state": ent("Ready", {}),
  "sensor.mb_connection": ent("Connected", {}),
  "select.mb_recipe": ent("Espresso", {
    options: ["Espresso", "Cappuccino"],
    recipes: {
      Espresso: {
        ...COMPONENT_1,
        c2_process: "none", c2_intensity: "medium", c2_aroma: "standard",
        c2_temperature: "normal", c2_shots: 0, c2_portion_ml: 0,
      },
      Cappuccino: {
        ...COMPONENT_1,
        c2_process: "milk", c2_intensity: "medium", c2_aroma: "standard",
        c2_temperature: "normal", c2_shots: 0, c2_portion_ml: 120,
      },
    },
  }),
} as unknown as HassEntities;

const recipe = {
  ...COMPONENT_1,
  c2_process: "none",
  c2_intensity: "medium",
  c2_aroma: "standard",
  c2_temperature: "normal",
  c2_shots: 0,
  c2_portion_ml: 0,
} as unknown as DirectKeyRecipe;

function renderFreestyle() {
  return renderWithProviders(
    <FreestyleSection conn={conn} entities={entities} prefix="mb" />,
  );
}

function renderEditor(onClose = () => {}) {
  return renderWithProviders(
    <RecipeEditModal
      conn={conn}
      brewEntityId="button.mb_brew"
      category="espresso"
      categoryLabel="Espresso"
      recipe={recipe}
      profileId={1}
      onClose={onClose}
    />,
  );
}

describe("the freestyle page", () => {
  it("obeys both hard rules — no radius but 0, no fill without a carve-out", () => {
    const { container } = renderFreestyle();
    expect(hardRuleViolations(container)).toEqual([]);
  });

  it("gives the drink the one ground, placed on the glass's own base", () => {
    const { container } = renderFreestyle();
    const stage = container.querySelector<HTMLElement>('[data-ui="drink-stage"]');
    expect(stage).toBeTruthy();
    // C29/R6: the reflection is DrinkStage's and only DrinkStage's, so the
    // glass must not be opted out of it any more.
    expect(stage!.querySelector('[data-ui="drink-reflection"]')).toBeTruthy();
    expect(stage!.querySelector('[data-ui="drink-glow"]')).toBeTruthy();
    expect(stage!.querySelector('[data-ui="drink-contact"]')).toBeTruthy();
  });

  it("writes the drink name on the app's one input form", () => {
    const { container } = renderFreestyle();
    const input = container.querySelector<HTMLInputElement>('[data-ui="field-input"]');
    expect(input).toBeTruthy();
    // C6: one hairline colour, one width, both from tokens.
    expect(input!.style.borderBottomColor).toBe("var(--input-border)");
    expect(input!.style.borderBottomWidth).toBe("var(--underline-w)");
    expect(input!.style.backgroundColor).toBe("transparent");
  });

  it("commits inside an action band, and only once", () => {
    const { container } = renderFreestyle();
    expect(container.querySelectorAll('[data-ui="action-band"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-ui="commit"]')).toHaveLength(1);
  });

  it("gives every numeric row the discrete-step affordance (C34)", () => {
    const { container } = renderFreestyle();
    const fields = container.querySelectorAll('[data-ui="meter-field"]');
    expect(fields).toHaveLength(2);
    for (const field of Array.from(fields)) {
      expect(field.querySelectorAll("button")).toHaveLength(2);
    }
  });

  it("names its groups with the one heading treatment (C31)", () => {
    const { container } = renderFreestyle();
    const headings = container.querySelectorAll('[data-ui="heading"]');
    expect(headings).toHaveLength(2);
    for (const h of Array.from(headings)) {
      expect(h.className).toContain("text-tertiary");
      expect((h as HTMLElement).style.fontWeight).toBe("");
    }
  });

  it("opens the recipe picker as the shared Panel, not a hand-rolled modal", () => {
    const { baseElement } = renderFreestyle();
    fireEvent.click(screen.getByRole("button", { name: /recipe/i }));

    const panel = baseElement.querySelector<HTMLElement>('[data-ui="panel"]');
    expect(panel).toBeTruthy();
    expect(panel!.getAttribute("data-measure")).toBe("md");
    // C9: one close control, drawn one way.
    expect(baseElement.querySelectorAll('[data-ui="panel-close"]')).toHaveLength(1);
    expect(hardRuleViolations(baseElement)).toEqual([]);
  });

  it("tiles the picker as a hairline mosaic at ONE column count (C13/H6)", () => {
    const { baseElement } = renderFreestyle();
    fireEvent.click(screen.getByRole("button", { name: /recipe/i }));

    const grid = baseElement.querySelector<HTMLElement>('[data-fill="rule"].grid');
    expect(grid).toBeTruthy();
    // §R1.2: the dividers are 1px GAPS over a tinted ground, not borders.
    // The gap is the divider, declared by the shared Mosaic rather than by a
    // utility class, and every mosaic in the app now uses the same ground.
    expect(grid!.style.gap).toBe("1px");
    expect(grid!.style.backgroundColor).toBe("var(--section-divider)");
    // One count, no breakpoint ladder: the app never renders below 1024px, so
    // a `sm:`/`md:` variant here is a third grid idiom that never varies. The
    // count is declared by Mosaic, which needs it to complete the last row.
    expect(grid!.style.gridTemplateColumns).toBe("repeat(6, minmax(0, 1fr))");
    expect(grid!.className).not.toMatch(/\b(sm|md|lg|xl):/);

    // Every cell repaints the page ground and nothing else.
    const cells = grid!.querySelectorAll<HTMLElement>('[data-fill="ground"]');
    expect(cells.length).toBeGreaterThan(0);
    for (const cell of Array.from(cells)) {
      expect(cell.style.backgroundColor).toBe("var(--bg)");
    }
  });
});

describe("the DirectKey recipe editor", () => {
  it("obeys both hard rules", () => {
    const { baseElement } = renderEditor();
    expect(hardRuleViolations(baseElement)).toEqual([]);
  });

  it("is the same Panel shape as every other modal (C7, C8, C9)", () => {
    const { baseElement } = renderEditor();
    const panel = baseElement.querySelector<HTMLElement>('[data-ui="panel"]');
    expect(panel).toBeTruthy();
    expect(panel!.getAttribute("data-measure")).toBe("lg");
    expect(panel!.getAttribute("data-fill")).toBe("panel");
    // R3: the fill is a longhand, so a test can actually see it.
    expect(panel!.style.backgroundColor).toBe("var(--surface)");
    expect(baseElement.querySelectorAll('[data-ui="panel-close"]')).toHaveLength(1);
  });

  it("gives its glass the same ground and the same hero rung as Freestyle (C15, C16)", () => {
    const { baseElement } = renderEditor();
    const stage = baseElement.querySelector<HTMLElement>('[data-ui="drink-stage"]');
    expect(stage).toBeTruthy();
    expect(stage!.querySelector('[data-ui="drink-glow"]')).toBeTruthy();
    expect(stage!.querySelector('[data-ui="drink-reflection"]')).toBeTruthy();

    const svg = stage!.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("280");

    const page = renderFreestyle();
    const pageSvg = page.container.querySelector('[data-ui="drink-stage"] svg');
    expect(pageSvg?.getAttribute("width")).toBe(svg?.getAttribute("width"));
  });

  it("closes with a word and commits with the one rectangle, in one band (C10)", () => {
    const onClose = vi.fn();
    const { baseElement } = renderEditor(onClose);

    const band = baseElement.querySelector('[data-ui="action-band"]');
    expect(band).toBeTruthy();
    expect(band!.querySelectorAll('[data-ui="commit"]')).toHaveLength(1);

    const word = band!.querySelector<HTMLElement>('[data-ui="word"]');
    expect(word).toBeTruthy();
    // An action never wears an underline — that would say "chosen".
    expect(word!.style.borderBottomWidth).toBe("");
    fireEvent.click(word!);
    expect(onClose).toHaveBeenCalled();
  });

  it("gives every numeric row steppers and every group one heading", () => {
    const { baseElement } = renderEditor();
    expect(baseElement.querySelectorAll('[data-ui="meter-field"]')).toHaveLength(2);
    expect(baseElement.querySelectorAll('[data-ui="heading"]')).toHaveLength(2);
  });
});

describe("the glass hands its geometry to the ground", () => {
  it("reports the aspect and base fraction DrinkStage needs", () => {
    // 120×150 viewBox, base at y=112. Without these the horizon lands 38
    // viewBox units below the glass, on empty drawing.
    expect(GLASS_ASPECT).toBeCloseTo(150 / 120, 10);
    expect(GLASS_BASE_FRACTION).toBeCloseTo(112 / 150, 10);
  });
});
