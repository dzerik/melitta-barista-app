import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CoffeeIcon } from "../src/components/CoffeeIcon";
import {
  isRenderableIconSpec,
  normalizeIconLayers,
  iconFillLevel,
} from "../src/lib/icon-spec";
import type { IconSpec } from "../src/lib/contract";
import imgEspresso from "../src/assets/recipes/espresso.png";
import imgFreestyle from "../src/assets/recipes/freestyle_placeholder.png";

/** §3.7 espresso icon spec, verbatim. */
const ESPRESSO_SPEC: IconSpec = {
  spec_version: 1,
  glass: "espresso_cup",
  total_ml: 40,
  fill_level: 0.67,
  layers: [{ role: "coffee", ml: 40, fraction: 1.0, intensity: 0.68, crema: true }],
  foam: null,
  steam: true,
};

/** §3.7 latte-macchiato icon spec, verbatim. */
const LATTE_SPEC: IconSpec = {
  spec_version: 1,
  glass: "tall_glass",
  total_ml: 200,
  fill_level: 0.63,
  layers: [
    { role: "milk", ml: 130, fraction: 0.65, intensity: 0.0 },
    { role: "coffee", ml: 40, fraction: 0.2, intensity: 0.68 },
  ],
  foam: { role: "milk_foam", ml: 30, fraction: 0.15 },
  steam: false,
};

describe("CoffeeIcon", () => {
  it("renders an img element", () => {
    render(<CoffeeIcon recipe="Espresso" />);
    const img = screen.getByRole("img");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("alt", "Espresso");
  });

  it("uses default size of 80", () => {
    render(<CoffeeIcon recipe="Espresso" />);
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("width", "80");
  });

  it("uses custom size", () => {
    render(<CoffeeIcon recipe="Espresso" size={120} />);
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("width", "120");
  });

  it("calculates height based on 720/1080 ratio", () => {
    render(<CoffeeIcon recipe="Espresso" size={120} />);
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("height", String(Math.round(120 * (720 / 1080))));
  });

  it("is not draggable", () => {
    render(<CoffeeIcon recipe="Espresso" />);
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("draggable", "false");
  });

  it("falls back to freestyle placeholder for unknown recipe", () => {
    render(<CoffeeIcon recipe="Unknown Coffee" />);
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("alt", "Unknown Coffee");
    // Should still render (with fallback image)
    expect(img).toBeInTheDocument();
  });
});

describe("CoffeeIcon — served IconSpec rendering (§3.6)", () => {
  it("draws a renderable spec as an SVG with the recipe as accessible name", () => {
    const { container } = render(<CoffeeIcon recipe="Espresso" icon={ESPRESSO_SPEC} size={120} />);
    const svg = container.querySelector("svg[data-icon-spec]");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("role", "img");
    expect(svg).toHaveAttribute("aria-label", "Espresso");
    expect(svg).toHaveAttribute("width", "120");
    expect(svg).toHaveAttribute("height", String(Math.round(120 * (720 / 1080))));
    expect(container.querySelector("img")).not.toBeInTheDocument();
  });

  it("renders one segment per layer plus foam, bottom-up", () => {
    const { container } = render(<CoffeeIcon recipe="Latte Macchiato" icon={LATTE_SPEC} />);
    expect(container.querySelector('[data-role="milk"]')).toBeInTheDocument();
    expect(container.querySelector('[data-role="coffee"]')).toBeInTheDocument();
    expect(container.querySelector('[data-role="milk_foam"]')).toBeInTheDocument();
  });

  it("renders crema and steam markers when the spec calls for them", () => {
    const { container } = render(<CoffeeIcon recipe="Espresso" icon={ESPRESSO_SPEC} />);
    expect(container.querySelector("[data-crema]")).toBeInTheDocument();
    expect(container.querySelector("[data-steam]")).toBeInTheDocument();
    const { container: latte } = render(<CoffeeIcon recipe="Latte" icon={LATTE_SPEC} />);
    expect(latte.querySelector("[data-steam]")).not.toBeInTheDocument();
  });

  it("applies a valid additive color_hint and ignores an invalid one", () => {
    const spec: IconSpec = {
      ...ESPRESSO_SPEC,
      layers: [
        { role: "coffee", ml: 30, fraction: 0.75, intensity: 0.5 },
        { role: "additive", ml: 10, fraction: 0.25, intensity: 0.5, color_hint: "#AB1234" },
      ],
    };
    const { container } = render(<CoffeeIcon recipe="X" icon={spec} />);
    const additive = container.querySelector('[data-role="additive"] rect');
    expect(additive).toHaveAttribute("fill", "#AB1234");

    const bad: IconSpec = {
      ...spec,
      layers: [{ role: "additive", ml: 40, fraction: 1, intensity: 0.5, color_hint: "url(evil)" }],
    };
    const { container: c2 } = render(<CoffeeIcon recipe="X" icon={bad} />);
    expect(c2.querySelector('[data-role="additive"] rect')).toHaveAttribute("fill", "#8a8a8a");
  });

  it("renders unknown layer roles as neutral grey instead of failing (§5.3.2)", () => {
    const spec: IconSpec = {
      ...ESPRESSO_SPEC,
      layers: [{ role: "syrup_v99", ml: 40, fraction: 1, intensity: 0.8 }],
    };
    const { container } = render(<CoffeeIcon recipe="X" icon={spec} />);
    const rect = container.querySelector('[data-role="syrup_v99"] rect');
    expect(rect).toHaveAttribute("fill", "#8a8a8a");
  });

  it("falls back to the PNG lookup for icon null / invalid spec / unknown spec_version", () => {
    for (const icon of [
      null,
      { ...ESPRESSO_SPEC, spec_version: 2 } as IconSpec,
      { ...ESPRESSO_SPEC, layers: [] } as IconSpec,
      { bogus: true } as unknown as IconSpec,
    ]) {
      const { container, unmount } = render(<CoffeeIcon recipe="Espresso" icon={icon} />);
      expect(container.querySelector("svg")).not.toBeInTheDocument();
      expect(container.querySelector("img")).toHaveAttribute("src", imgEspresso);
      unmount();
    }
  });

  it("prefers the served name_key over the display-name lookup, keeping the placeholder last", () => {
    const { container: byKey } = render(
      <CoffeeIcon recipe="Renamed Drink" nameKey="espresso" />,
    );
    expect(byKey.querySelector("img")).toHaveAttribute("src", imgEspresso);

    const { container: unknownKey } = render(
      <CoffeeIcon recipe="Espresso" nameKey="mystery_key" />,
    );
    // unknown name_key → display-name lookup still wins over the placeholder
    expect(unknownKey.querySelector("img")).toHaveAttribute("src", imgEspresso);

    const { container: nothing } = render(
      <CoffeeIcon recipe="Mystery" nameKey="mystery_key" />,
    );
    expect(nothing.querySelector("img")).toHaveAttribute("src", imgFreestyle);
  });
});

describe("IconSpec pure helpers", () => {
  it("isRenderableIconSpec accepts the §3.7 fixtures and rejects malformed specs", () => {
    expect(isRenderableIconSpec(ESPRESSO_SPEC)).toBe(true);
    expect(isRenderableIconSpec(LATTE_SPEC)).toBe(true);
    expect(isRenderableIconSpec(null)).toBe(false);
    expect(isRenderableIconSpec(undefined)).toBe(false);
    expect(isRenderableIconSpec({ ...ESPRESSO_SPEC, spec_version: 2 })).toBe(false);
    expect(isRenderableIconSpec({ ...ESPRESSO_SPEC, layers: "no" })).toBe(false);
    expect(isRenderableIconSpec({ ...ESPRESSO_SPEC, layers: [{ role: 5, fraction: 1 }] })).toBe(false);
    expect(isRenderableIconSpec({ ...ESPRESSO_SPEC, foam: { fraction: "x" } })).toBe(false);
  });

  it("normalizeIconLayers folds the fraction remainder into the last segment (±0.02 rule)", () => {
    const segments = normalizeIconLayers({
      ...LATTE_SPEC,
      layers: [
        { role: "milk", ml: 130, fraction: 0.64, intensity: 0 },
        { role: "coffee", ml: 40, fraction: 0.2, intensity: 0.68 },
      ],
      foam: { role: "milk_foam", ml: 30, fraction: 0.14 },
    });
    expect(segments).toHaveLength(3);
    const sum = segments.reduce((a, s) => a + s.fraction, 0);
    expect(sum).toBeCloseTo(1, 5);
    expect(segments[2].role).toBe("milk_foam");
    expect(segments[2].fraction).toBeCloseTo(0.16, 5);
  });

  it("normalizeIconLayers survives all-zero fractions", () => {
    const segments = normalizeIconLayers({
      ...ESPRESSO_SPEC,
      layers: [{ role: "coffee", ml: 0, fraction: 0, intensity: 0.5 }],
      foam: null,
    });
    expect(segments[0].fraction).toBe(1);
  });

  it("iconFillLevel uses the served value, and the cup nominal for unknown glasses", () => {
    expect(iconFillLevel(ESPRESSO_SPEC)).toBeCloseTo(0.67);
    const noLevel = {
      ...ESPRESSO_SPEC,
      glass: "goblet_v9",
      total_ml: 110,
      fill_level: undefined,
    } as unknown as IconSpec;
    // 110 / 220 (cup nominal per §3.6) = 0.5
    expect(iconFillLevel(noLevel)).toBeCloseTo(0.5);
    expect(iconFillLevel({ ...ESPRESSO_SPEC, fill_level: 9 })).toBe(1);
  });
});
