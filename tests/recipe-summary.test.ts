import { describe, it, expect } from "vitest";
import { hopperNumber, pourSummary, pourSummaries, readableSteps } from "../src/lib/recipe-summary";

const COFFEE = {
  process: "coffee",
  intensity: "strong",
  aroma: "standard",
  temperature: "normal",
  shots: "two",
  portion_ml: 40,
};

const MILK = {
  process: "milk",
  intensity: "medium",
  aroma: "standard",
  temperature: "normal",
  shots: "none",
  portion_ml: 160,
};

describe("pourSummary", () => {
  it("names what is dispensed instead of dumping tokens", () => {
    const line = pourSummary("en", COFFEE as never)!;
    expect(line).toContain("40 ml");
    expect(line).not.toContain("standard"); // aroma is machine detail, not a sentence
    expect(line.split(" · ").length).toBeGreaterThan(1);
  });

  it("omits shots and intensity for a non-coffee pour", () => {
    const line = pourSummary("en", MILK as never)!;
    expect(line).toContain("160 ml");
    expect(line.toLowerCase()).not.toContain("shot");
  });

  it("stays silent about a temperature that is not remarkable", () => {
    const normal = pourSummary("en", COFFEE as never)!;
    const hot = pourSummary("en", { ...COFFEE, temperature: "hot" } as never)!;
    expect(hot.length).toBeGreaterThan(normal.length);
  });

  it("returns null for an absent or empty component", () => {
    expect(pourSummary("en", null)).toBeNull();
    expect(pourSummary("en", { ...COFFEE, process: "none" } as never)).toBeNull();
  });
});

describe("hopperNumber", () => {
  it("reads blend as the hopper selector, never a percentage", () => {
    expect(hopperNumber({ blend: 1 })).toBe(1);
    expect(hopperNumber({ blend: 0 })).toBe(2);
  });

  it("declines to guess for anything else", () => {
    expect(hopperNumber({ blend: 50 })).toBeNull();
    expect(hopperNumber({})).toBeNull();
  });
});

describe("pourSummaries", () => {
  it("lists both pours of a two-component recipe in order", () => {
    const lines = pourSummaries("en", { component1: COFFEE, component2: MILK } as never);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("40 ml");
    expect(lines[1]).toContain("160 ml");
  });

  it("skips a second component the recipe does not use", () => {
    const lines = pourSummaries("en", {
      component1: COFFEE,
      component2: { ...MILK, process: "none", portion_ml: 0 },
    } as never);
    expect(lines).toHaveLength(1);
  });
});

describe("readableSteps", () => {
  const recipe = {
    component1: COFFEE,
    component2: MILK,
    machine_phases: [
      { component: COFFEE, user_action_before: [] },
      {
        component: MILK,
        user_action_before: [
          { order: 1, phase: "pre", action: "Fill the glass with ice", amount: 3, unit: "cubes" },
        ],
      },
    ],
    // The wire shape the server actually sends: one flat list, each row
    // tagged with its phase (ai_recipes.py builds it that way).
    steps: [
      { order: 1, phase: "pre", action: "Chill a tumbler", notes: "five minutes in the freezer" },
      { order: 2, phase: "during", action: "Watch the crema settle" },
      { order: 3, phase: "post", action: "Dust with cocoa" },
    ],
  };

  it("renders the instructions the model wrote, not just the pours", () => {
    const lines = readableSteps("en", recipe as never);
    expect(lines.some((l) => l.includes("Chill a tumbler"))).toBe(true);
    expect(lines.some((l) => l.includes("five minutes in the freezer"))).toBe(true);
    expect(lines.some((l) => l.includes("Fill the glass with ice"))).toBe(true);
    expect(lines.some((l) => l.includes("Dust with cocoa"))).toBe(true);
  });

  it("attaches a during-step to the pour it accompanies", () => {
    const lines = readableSteps("en", recipe as never);
    const crema = lines.findIndex((l) => l.includes("Watch the crema settle"));
    const firstPour = lines.findIndex((l) => l.includes("40 ml"));
    expect(crema).toBe(firstPour + 1);
  });

  it("labels each pour with what it dispenses", () => {
    const lines = readableSteps("en", recipe as never);
    expect(lines.some((l) => l.includes("1/2") && l.includes("40 ml"))).toBe(true);
    expect(lines.some((l) => l.includes("2/2") && l.includes("160 ml"))).toBe(true);
  });

  it("keeps the manual step ahead of the pour it precedes", () => {
    const lines = readableSteps("en", recipe as never);
    const ice = lines.findIndex((l) => l.includes("Fill the glass with ice"));
    const milk = lines.findIndex((l) => l.includes("160 ml"));
    expect(ice).toBeGreaterThanOrEqual(0);
    expect(ice).toBeLessThan(milk);
  });

  it("still describes a recipe that carries no authored steps", () => {
    const lines = readableSteps("en", { component1: COFFEE, component2: MILK } as never);
    expect(lines.length).toBeGreaterThan(0);
  });
});
