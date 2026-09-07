/**
 * The artwork is the scale, and these are the invariants that make that true.
 *
 * The 25 recipe PNGs share one canvas and stand on one baseline, which is why
 * rendering every file at the same width is already correct — an espresso
 * measures 0.44× a latte macchiato in the artwork and 0.43× on the counter.
 * Break either invariant and the app starts lying about size without anything
 * failing to compile, so they are pinned here.
 */
import { describe, it, expect } from "vitest";
import { DRINK_BOUNDS, FULL_BOUNDS } from "../src/lib/drink-metrics";
import { drinkAssetKey, drinkBounds } from "../src/components/CoffeeIcon";

const KEYS = Object.keys(DRINK_BOUNDS);

describe("drink artwork", () => {
  it("measures every drawing in the set", () => {
    expect(KEYS.length).toBe(25);
  });

  it("stands every glass on the same baseline", () => {
    // Every base sits within 1.5% of the canvas floor: the shared line is what
    // lets a row of drinks be compared at a glance.
    for (const key of KEYS) {
      expect(DRINK_BOUNDS[key].bottom, key).toBeGreaterThan(0.98);
      expect(DRINK_BOUNDS[key].bottom, key).toBeLessThanOrEqual(1);
    }
  });

  it("keeps the true relative sizes the app depends on", () => {
    const height = (k: string) => DRINK_BOUNDS[k].bottom - DRINK_BOUNDS[k].top;
    const latte = height("latte_macchiato");
    // Physical vessels: espresso cup ~60mm, café crème cup ~100mm, latte
    // glass ~140mm. The artwork is within a few percent of each ratio.
    expect(height("espresso") / latte).toBeCloseTo(0.43, 1);
    expect(height("cafe_creme") / latte).toBeCloseTo(0.72, 1);
    expect(height("espresso")).toBeLessThan(height("cafe_creme"));
    expect(height("cafe_creme")).toBeLessThan(latte);
  });

  it("leaves no glass filling its frame, which is why the light needs bounds", () => {
    for (const key of KEYS) {
      const b = DRINK_BOUNDS[key];
      expect(b.right - b.left, key).toBeLessThan(1);
      expect(b.bottom - b.top, key).toBeLessThanOrEqual(1);
    }
    // The extremes this exists for.
    expect(DRINK_BOUNDS.espresso.right - DRINK_BOUNDS.espresso.left).toBeLessThan(0.3);
    expect(DRINK_BOUNDS.water.right - DRINK_BOUNDS.water.left).toBeGreaterThan(0.6);
  });
});

describe("resolving a drink to its artwork", () => {
  it("prefers the served name_key, then the display name", () => {
    expect(drinkAssetKey("Espresso")).toBe("espresso");
    expect(drinkAssetKey("anything", "cafe_creme")).toBe("cafe_creme");
    // The three keys whose file carries a suffix still resolve.
    expect(drinkAssetKey("anything", "americano_extra")).toBe("americano_extra_shot2");
  });

  it("falls back to the placeholder, which is now on the same canvas", () => {
    expect(drinkAssetKey("A drink the sommelier invented")).toBe("freestyle_placeholder");
    const b = DRINK_BOUNDS.freestyle_placeholder;
    expect(b.bottom).toBeGreaterThan(0.98);
  });

  it("reports the whole box for a procedural drawing, which fills it", () => {
    const spec = {
      spec_version: 1,
      glass: "cup",
      total_ml: 200,
      fill_level: 0.8,
      layers: [{ role: "coffee", ml: 200, fraction: 1, intensity: 0.6, crema: true }],
      foam: null,
      steam: false,
    } as never;
    expect(drinkBounds("Whatever", undefined, spec)).toEqual(FULL_BOUNDS);
    expect(drinkBounds("Espresso")).toEqual(DRINK_BOUNDS.espresso);
  });
});
