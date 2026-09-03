import { describe, it, expect } from "vitest";
import {
  resolveEnumTokens,
  resolveProcessTokens,
  resolvePortionRange,
  ordinalFraction,
  intensityColor,
  cremaColor,
  heatFor,
  processColor,
  CONST_FREESTYLE_TOKENS,
  CONST_PORTION_RANGES,
  COFFEE_INTENSITY_COLORS,
} from "../src/lib/parameters";
import type { UiContract } from "../src/lib/contract";
import {
  MELITTA_CONTRACT,
  MELITTA_CONTRACT_FULL,
  NIVONA_CONTRACT_FULL,
  clone,
} from "./fixtures/contracts";

const ENTITY_INTENSITY = ["mild", "medium", "strong"];

describe("resolveEnumTokens — §6.1.5 three tiers", () => {
  it("tier 1: contract parameters win over entity options", () => {
    const r = resolveEnumTokens(MELITTA_CONTRACT_FULL, "intensity", ENTITY_INTENSITY);
    expect(r.source).toBe("contract");
    expect(r.tokens).toEqual(["very_mild", "mild", "medium", "strong", "very_strong"]);
  });

  it("tier 2: a v1-only contract (no parameters) lands on entity options", () => {
    const r = resolveEnumTokens(MELITTA_CONTRACT, "intensity", ENTITY_INTENSITY);
    expect(r.source).toBe("entity");
    expect(r.tokens).toEqual(ENTITY_INTENSITY);
  });

  it("tier 3: no contract, no entity options → hardcoded consts", () => {
    const r = resolveEnumTokens(null, "intensity");
    expect(r.source).toBe("const");
    expect(r.tokens).toEqual([...CONST_FREESTYLE_TOKENS.intensity]);
  });

  it("a brew_override-scoped descriptor is not freestyle UI (§6.1.1)", () => {
    // Nivona's intensity is scope ["brew_override"] — the freestyle form
    // must skip it and fall through per-parameter.
    const r = resolveEnumTokens(NIVONA_CONTRACT_FULL, "intensity", ENTITY_INTENSITY);
    expect(r.source).toBe("entity");
    expect(r.tokens).toEqual(ENTITY_INTENSITY);
  });

  it("unknown descriptor kind is ignored per-parameter (§6.1.1)", () => {
    const c = clone(MELITTA_CONTRACT_FULL);
    (c.parameters!.intensity as { kind: string }).kind = "gradient";
    const r = resolveEnumTokens(c, "intensity", ENTITY_INTENSITY);
    expect(r.source).toBe("entity");
    // Sibling families keep resolving from the contract independently.
    expect(resolveEnumTokens(c, "aroma").source).toBe("contract");
  });

  it("malformed/empty token lists fall through", () => {
    const c = clone(MELITTA_CONTRACT_FULL);
    (c.parameters!.shots as { tokens: unknown }).tokens = [];
    expect(resolveEnumTokens(c, "shots", ["one"]).source).toBe("entity");
    (c.parameters!.shots as { tokens: unknown }).tokens = ["one", 2];
    expect(resolveEnumTokens(c, "shots").source).toBe("const");
  });

  it("unknown family with no other source resolves to an empty const list", () => {
    const r = resolveEnumTokens(null, "grind_level");
    expect(r).toEqual({ tokens: [], source: "const" });
  });

  it("returned arrays are copies (callers may not mutate the contract)", () => {
    const r = resolveEnumTokens(MELITTA_CONTRACT_FULL, "aroma");
    r.tokens.push("x");
    expect(MELITTA_CONTRACT_FULL.parameters!.aroma.tokens).toEqual(["standard", "intense"]);
  });
});

describe("resolveProcessTokens — component asymmetry", () => {
  it("component 1 never offers none, whichever tier resolved", () => {
    expect(resolveProcessTokens(MELITTA_CONTRACT_FULL, 1).tokens).toEqual([
      "coffee", "milk", "water",
    ]);
    expect(resolveProcessTokens(null, 1).tokens).toEqual(["coffee", "milk", "water"]);
    expect(resolveProcessTokens(null, 1, ["none", "coffee"]).tokens).toEqual(["coffee"]);
  });

  it("component 2 keeps the full served list", () => {
    const r = resolveProcessTokens(MELITTA_CONTRACT_FULL, 2);
    expect(r.source).toBe("contract");
    expect(r.tokens).toEqual(["none", "coffee", "milk", "water"]);
  });
});

describe("resolvePortionRange — §6.1.5 for ranges", () => {
  it("tier 1: contract parameters.portion_ml per component", () => {
    expect(resolvePortionRange(MELITTA_CONTRACT_FULL, "c1")).toEqual({
      min: 5, max: 250, step: 5, source: "contract",
    });
    expect(resolvePortionRange(MELITTA_CONTRACT_FULL, "c2")).toEqual({
      min: 0, max: 250, step: 5, source: "contract",
    });
  });

  it("tier 2: v1 limits.portion_ml when parameters are absent", () => {
    const r = resolvePortionRange(MELITTA_CONTRACT, "c1");
    expect(r).toEqual({ min: 5, max: 250, step: 5, source: "entity" });
  });

  it("brew_override-scoped portion_ml (Nivona) falls to the v1 limits", () => {
    expect(resolvePortionRange(NIVONA_CONTRACT_FULL, "c2").source).toBe("entity");
  });

  it("tier 3: no contract → the hardcoded slider bounds", () => {
    expect(resolvePortionRange(null, "c1")).toEqual({
      ...CONST_PORTION_RANGES.c1, source: "const",
    });
    expect(resolvePortionRange(null, "c2")).toEqual({
      ...CONST_PORTION_RANGES.c2, source: "const",
    });
  });

  it("a malformed served range (step 0) falls through", () => {
    const c = clone(MELITTA_CONTRACT_FULL);
    c.parameters!.portion_ml.c1 = { min: 5, max: 250, step: 0 };
    expect(resolvePortionRange(c, "c1").source).toBe("entity");
  });
});

describe("ordinalFraction", () => {
  it("maps list position to a 0..1 fraction", () => {
    const scale = ["a", "b", "c", "d", "e"];
    expect(ordinalFraction("a", scale)).toBe(0);
    expect(ordinalFraction("c", scale)).toBe(0.5);
    expect(ordinalFraction("e", scale)).toBe(1);
  });

  it("returns null for tokens outside the scale or without one", () => {
    expect(ordinalFraction("x", ["a", "b"])).toBeNull();
    expect(ordinalFraction("x", [])).toBeNull();
    expect(ordinalFraction("x", undefined)).toBeNull();
  });

  it("a single-token scale centers at 0.5", () => {
    expect(ordinalFraction("only", ["only"])).toBe(0.5);
  });
});

describe("glass color/heat — legacy maps first, ordinal interpolation after", () => {
  it("frozen v1 intensity tokens keep their exact legacy colors", () => {
    for (const [token, color] of Object.entries(COFFEE_INTENSITY_COLORS)) {
      // Even with a scale present the legacy map is authoritative.
      expect(intensityColor(token, ["something_else", token])).toBe(color);
    }
  });

  it("unknown intensity tokens interpolate by ordinal position", () => {
    const scale = ["level_1", "level_2", "level_3"];
    expect(intensityColor("level_1", scale)).toBe("#8B6B4A"); // lightest end
    expect(intensityColor("level_3", scale)).toBe("#1A0D04"); // darkest end
    const mid = intensityColor("level_2", scale);
    expect(mid).toMatch(/^#[0-9A-F]{6}$/);
    expect(mid).not.toBe("#8B6B4A");
    expect(mid).not.toBe("#1A0D04");
  });

  it("unknown intensity without a scale keeps the legacy medium default", () => {
    expect(intensityColor("mystery")).toBe(COFFEE_INTENSITY_COLORS.medium);
  });

  it("crema keeps legacy buckets and thirds unknown tokens ordinally", () => {
    expect(cremaColor("mild")).toBe("#D4A860");
    expect(cremaColor("very_strong")).toBe("#8B6030");
    expect(cremaColor("medium")).toBe("#C49545");
    const scale = ["l1", "l2", "l3"];
    expect(cremaColor("l1", scale)).toBe("#D4A860");
    expect(cremaColor("l2", scale)).toBe("#C49545");
    expect(cremaColor("l3", scale)).toBe("#8B6030");
    expect(cremaColor("mystery")).toBe("#C49545");
  });

  it("heat keeps the legacy map and interpolates unknown tokens", () => {
    expect(heatFor("cold")).toBe(0.2);
    expect(heatFor("normal")).toBe(0.6);
    expect(heatFor("high")).toBe(1.0);
    const scale = ["t1", "t2", "t3"];
    expect(heatFor("t1", scale)).toBeCloseTo(0.2);
    expect(heatFor("t2", scale)).toBeCloseTo(0.6);
    expect(heatFor("t3", scale)).toBeCloseTo(1.0);
    expect(heatFor("mystery")).toBe(0.5);
  });

  it("processColor keeps the frozen milk/water/none colors", () => {
    expect(processColor("milk", "medium")).toBe("#F0E6D8");
    expect(processColor("water", "medium")).toBe("#9DC4D8");
    expect(processColor("none", "medium")).toBe("transparent");
    expect(processColor("coffee", "strong")).toBe(COFFEE_INTENSITY_COLORS.strong);
  });
});

describe("degradation invariant — a pre-contract setup is byte-identical", () => {
  it("null contract with the legacy entity options reproduces today's lists", () => {
    const entityOpts = {
      process1: ["coffee", "milk", "water"],
      process2: ["none", "coffee", "milk", "water"],
      intensity: ["very_mild", "mild", "medium", "strong", "very_strong"],
    };
    expect(resolveProcessTokens(null, 1, entityOpts.process1).tokens).toEqual(entityOpts.process1);
    expect(resolveProcessTokens(null, 2, entityOpts.process2).tokens).toEqual(entityOpts.process2);
    expect(resolveEnumTokens(null, "intensity", entityOpts.intensity).tokens).toEqual(entityOpts.intensity);
  });

  it("mirror invariant sanity (§6.1.2): tier 1 equals tier 2 on the fixture", () => {
    const full: UiContract = MELITTA_CONTRACT_FULL;
    for (const family of ["process", "intensity", "aroma", "temperature", "shots"] as const) {
      expect(resolveEnumTokens(full, family).tokens).toEqual(
        full.vocabularies.freestyle[family],
      );
    }
  });
});
