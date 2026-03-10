import { describe, it, expect } from "vitest";
import { getCupCounts } from "../src/lib/entities";
import type { HassEntities } from "home-assistant-js-websocket";

function makeEntities(attrs: Record<string, unknown>): HassEntities {
  return {
    "sensor.melitta_total_cups": {
      entity_id: "sensor.melitta_total_cups",
      state: "42",
      attributes: attrs,
      last_changed: "",
      last_updated: "",
      context: { id: "", user_id: null, parent_id: null },
    },
  };
}

describe("getCupCounts", () => {
  it("extracts numeric cup counts from attributes", () => {
    const entities = makeEntities({
      Espresso: 15,
      Cappuccino: 10,
      "Latte Macchiato": 7,
      friendly_name: "Total Cups",
      unit_of_measurement: "cups",
      icon: "mdi:coffee",
      state_class: "total_increasing",
    });
    const counts = getCupCounts(entities, "melitta");
    expect(counts).toEqual({
      Espresso: 15,
      Cappuccino: 10,
      "Latte Macchiato": 7,
    });
  });

  it("returns empty object when entity missing", () => {
    expect(getCupCounts({}, "melitta")).toEqual({});
  });

  it("returns empty object when no numeric attributes", () => {
    const entities = makeEntities({
      friendly_name: "Total Cups",
      icon: "mdi:coffee",
    });
    expect(getCupCounts(entities, "melitta")).toEqual({});
  });

  it("filters out HA metadata keys", () => {
    const entities = makeEntities({
      Espresso: 5,
      friendly_name: "Total Cups",
      unit_of_measurement: "cups",
      state_class: "total_increasing",
      icon: "mdi:coffee",
    });
    const counts = getCupCounts(entities, "melitta");
    expect(Object.keys(counts)).toEqual(["Espresso"]);
  });

  it("handles zero counts", () => {
    const entities = makeEntities({
      Espresso: 0,
      Cappuccino: 3,
    });
    const counts = getCupCounts(entities, "melitta");
    expect(counts).toEqual({ Espresso: 0, Cappuccino: 3 });
  });
});

describe("recipe sorting by popularity", () => {
  it("sorts recipes by descending cup count", () => {
    const cupCounts: Record<string, number> = {
      Espresso: 5,
      Cappuccino: 20,
      "Latte Macchiato": 12,
      Lungo: 0,
    };
    const recipeOptions = ["Espresso", "Cappuccino", "Latte Macchiato", "Lungo"];
    const sorted = [...recipeOptions].sort(
      (a, b) => (cupCounts[b] ?? 0) - (cupCounts[a] ?? 0),
    );
    expect(sorted).toEqual(["Cappuccino", "Latte Macchiato", "Espresso", "Lungo"]);
  });

  it("keeps original order when no cup data", () => {
    const recipeOptions = ["Espresso", "Cappuccino", "Lungo"];
    const cupCounts: Record<string, number> = {};
    // When no counts, we return recipeOptions as-is
    const sorted =
      Object.keys(cupCounts).length === 0
        ? recipeOptions
        : [...recipeOptions].sort((a, b) => (cupCounts[b] ?? 0) - (cupCounts[a] ?? 0));
    expect(sorted).toEqual(["Espresso", "Cappuccino", "Lungo"]);
  });

  it("recipes not in stats get 0 count and sort last", () => {
    const cupCounts: Record<string, number> = {
      Espresso: 10,
      Cappuccino: 5,
    };
    const recipeOptions = ["Lungo", "Espresso", "Cappuccino", "Ristretto"];
    const sorted = [...recipeOptions].sort(
      (a, b) => (cupCounts[b] ?? 0) - (cupCounts[a] ?? 0),
    );
    expect(sorted).toEqual(["Espresso", "Cappuccino", "Lungo", "Ristretto"]);
  });

  it("equal counts preserve relative order (stable sort)", () => {
    const cupCounts: Record<string, number> = {
      Espresso: 5,
      Cappuccino: 5,
      Lungo: 5,
    };
    const recipeOptions = ["Espresso", "Cappuccino", "Lungo"];
    const sorted = [...recipeOptions].sort(
      (a, b) => (cupCounts[b] ?? 0) - (cupCounts[a] ?? 0),
    );
    // JS Array.sort is stable — same count preserves original order
    expect(sorted).toEqual(["Espresso", "Cappuccino", "Lungo"]);
  });

  it("most popular recipe is first (carousel focus target)", () => {
    const cupCounts: Record<string, number> = {
      Espresso: 3,
      Cappuccino: 25,
      Lungo: 1,
    };
    const recipeOptions = ["Espresso", "Cappuccino", "Lungo"];
    const sorted = [...recipeOptions].sort(
      (a, b) => (cupCounts[b] ?? 0) - (cupCounts[a] ?? 0),
    );
    expect(sorted[0]).toBe("Cappuccino");
  });
});
