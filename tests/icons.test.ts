import { describe, it, expect } from "vitest";
import {
  Coffee,
  CupSoda,
  Droplet,
  GlassWater,
  Milk,
  Save,
  SlidersHorizontal,
  Thermometer,
  TimerOff,
  Wheat,
} from "lucide-react";
import { resolveMdiIcon, hasMdiMapping, GENERIC_ICON } from "../src/lib/icons";

/** Every mdi name the contract spec serves (§6.2.2, §9.1.5, §9.3.3). */
const SPEC_SERVED_MDI_NAMES = [
  "mdi:air-humidifier",
  "mdi:book-refresh",
  "mdi:check-circle",
  "mdi:check-circle-outline",
  "mdi:coffee",
  "mdi:coffee-maker",
  "mdi:coffee-maker-outline",
  "mdi:coffee-outline",
  "mdi:cog",
  "mdi:cog-refresh",
  "mdi:content-save",
  "mdi:cup",
  "mdi:cup-outline",
  "mdi:cup-water",
  "mdi:dishwasher",
  "mdi:filter-cog",
  "mdi:filter-outline",
  "mdi:filter-plus",
  "mdi:filter-remove",
  "mdi:gesture-tap-button",
  "mdi:glass-mug-variant",
  "mdi:grain",
  "mdi:leaf",
  "mdi:lightning-bolt",
  "mdi:power",
  "mdi:restore",
  "mdi:shimmer",
  "mdi:stop",
  "mdi:stop-circle",
  "mdi:thermometer",
  "mdi:timer-off-outline",
  "mdi:translate",
  "mdi:tune",
  "mdi:water-off",
  "mdi:water-opacity",
  "mdi:water-sync",
];

describe("resolveMdiIcon", () => {
  it("has an explicit non-generic mapping for every spec-served mdi name", () => {
    for (const name of SPEC_SERVED_MDI_NAMES) {
      expect(hasMdiMapping(name), name).toBe(true);
      const icon = resolveMdiIcon(name);
      expect(icon, name).toBeTruthy();
      expect(icon, name).not.toBe(GENERIC_ICON);
    }
  });

  it("maps the §9.1.5 setting icons to sensible lucide components", () => {
    expect(resolveMdiIcon("mdi:grain")).toBe(Wheat);
    expect(resolveMdiIcon("mdi:thermometer")).toBe(Thermometer);
    expect(resolveMdiIcon("mdi:water-opacity")).toBe(Droplet);
    expect(resolveMdiIcon("mdi:timer-off-outline")).toBe(TimerOff);
    expect(resolveMdiIcon("mdi:tune")).toBe(SlidersHorizontal);
  });

  it("maps the §9.3.3 category icons", () => {
    expect(resolveMdiIcon("mdi:coffee")).toBe(Coffee);
    expect(resolveMdiIcon("mdi:coffee-outline")).toBe(Coffee);
    expect(resolveMdiIcon("mdi:glass-mug-variant")).toBe(Milk);
    expect(resolveMdiIcon("mdi:cup")).toBe(CupSoda);
    expect(resolveMdiIcon("mdi:cup-water")).toBe(GlassWater);
    expect(resolveMdiIcon("mdi:content-save")).toBe(Save);
  });

  it("falls back to the generic icon for unknown mdi names (§5.3.2 — hint, never a requirement)", () => {
    expect(resolveMdiIcon("mdi:definitely-not-a-real-icon")).toBe(GENERIC_ICON);
    expect(resolveMdiIcon("mdi:added-in-a-future-release")).toBe(GENERIC_ICON);
  });

  it("falls back to the generic icon for absent or non-mdi values", () => {
    expect(resolveMdiIcon(null)).toBe(GENERIC_ICON);
    expect(resolveMdiIcon(undefined)).toBe(GENERIC_ICON);
    expect(resolveMdiIcon("")).toBe(GENERIC_ICON);
    expect(resolveMdiIcon("coffee")).toBe(GENERIC_ICON);
  });

  it("never returns null — call sites can render unconditionally", () => {
    for (const value of [null, undefined, "", "mdi:unknown", "mdi:coffee"]) {
      expect(resolveMdiIcon(value)).toBeTruthy();
    }
  });

  it("hasMdiMapping is false for unknown/absent names", () => {
    expect(hasMdiMapping("mdi:unknown")).toBe(false);
    expect(hasMdiMapping(null)).toBe(false);
    expect(hasMdiMapping("")).toBe(false);
  });
});
