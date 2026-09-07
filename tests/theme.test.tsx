import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { readFileSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import {
  PreferencesProvider,
  usePreferences,
  THEME_FAMILIES,
  FAMILY_MODES,
  FAMILY_GROUND,
  familySupportsMode,
  isSingleModeFamily,
  resolveMode,
  groundColor,
} from "../src/lib/preferences";
import type { Theme, ThemeFamily } from "../src/lib/preferences";

/**
 * THE THEME FOUNDATION.
 *
 * Two axes — `data-theme-family` (the material) and `data-theme` (the mode) —
 * and one rule that keeps them from fighting: family blocks are written with
 * two attribute selectors, mode blocks with one, so (0,2,0) beats (0,1,0)
 * without a single `!important` and without depending on source order.
 *
 * These tests come in two halves, and the split is deliberate. The RESOLUTION
 * half renders the provider and reads the attributes it writes. The MATERIAL
 * half never renders anything: `vitest.config.ts` sets `css: false`, so jsdom
 * has no stylesheet to compute against and `getComputedStyle` would answer ""
 * for every custom property in the file. So the material half parses
 * `index.css` and resolves the cascade itself. That is not a workaround — it
 * is the only way to assert what a family DECLARES rather than what one
 * rendered component happened to ask for, which is exactly the "no family
 * half-declared" invariant.
 */

// ═══════════════════════════════════════════════════════════════════════════
// A cascade resolver for the theme blocks in index.css
// ═══════════════════════════════════════════════════════════════════════════

// Read from the vitest root rather than `import.meta.url`: the jsdom
// environment rewrites module URLs to a non-file scheme.
const CSS = readFileSync(resolvePath(process.cwd(), "src/index.css"), "utf8");

interface Block {
  /** The full selector list, whitespace-collapsed. */
  selector: string;
  /** Declarations in source order; later wins within a block. */
  decls: [property: string, value: string][];
  /** Position in the file — the tiebreak when specificity is equal. */
  order: number;
}

interface Resolved {
  value: string;
  /** Attribute-selector count of the arm that won. 2 = a family block. */
  specificity: number;
  selector: string;
}

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

function parseDecls(body: string): [string, string][] {
  const out: [string, string][] = [];
  for (const raw of body.split(";")) {
    const part = raw.trim();
    if (part === "") continue;
    const colon = part.indexOf(":");
    if (colon === -1) continue;
    out.push([
      part.slice(0, colon).trim(),
      part.slice(colon + 1).trim().replace(/\s+/g, " "),
    ]);
  }
  return out;
}

/**
 * Every innermost `selector { … }` in the file. `[^{}]` can never cross a
 * brace, so an `@media`/`@keyframes` wrapper simply fails to match and its
 * inner rules are picked up on their own — which is what we want: none of
 * them is a theme block, and all of them are then visible to the sweeps
 * below rather than hidden inside a wrapper.
 */
function parseBlocks(css: string): Block[] {
  const out: Block[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    // Everything up to the last `;` belongs to a preceding statement, not to
    // this selector — `@import "tailwindcss";` sits directly above the first
    // theme block and would otherwise be glued onto its `:root` arm.
    const head = m[1];
    out.push({
      selector: head
        .slice(head.lastIndexOf(";") + 1)
        .trim()
        .replace(/\s+/g, " "),
      decls: parseDecls(m[2]),
      order: out.length,
    });
  }
  return out;
}

const BLOCKS = parseBlocks(stripComments(CSS));

const MODE_ARM = /^\[data-theme="(dark|light)"\]$/;
const FAMILY_ARM =
  /^\[data-theme-family="([a-z]+)"\](\[data-theme(?:="(dark|light)")?\])?$/;

/**
 * How specific a matching arm is, in the only dimension this file uses:
 * attribute selectors, plus `:root`'s one pseudo-class. Returns `null` when
 * the arm does not match the combination at all.
 *
 * An arm that mentions `data-theme` in a shape this resolver does not know
 * THROWS rather than being skipped. A silently-ignored selector would let a
 * future family declare its tokens somewhere this test cannot see, and every
 * assertion below would keep passing while the theme was broken.
 */
function armSpecificity(
  arm: string,
  family: ThemeFamily,
  mode: Theme,
): number | null {
  if (arm === ":root") return 1;

  const asMode = MODE_ARM.exec(arm);
  if (asMode) return asMode[1] === mode ? 1 : null;

  const asFamily = FAMILY_ARM.exec(arm);
  if (asFamily) {
    if (asFamily[1] !== family) return null;
    if (asFamily[3] !== undefined && asFamily[3] !== mode) return null;
    return asFamily[2] ? 2 : 1;
  }

  if (arm.includes("data-theme")) {
    throw new Error(
      `index.css: unrecognised theme selector "${arm}". Add it to ` +
        `armSpecificity() in tests/theme.test.tsx — a theme block this ` +
        `resolver cannot see is a family that can half-declare unnoticed.`,
    );
  }
  return null;
}

/** The best (highest) specificity at which a block matches, or null. */
function blockSpecificity(
  block: Block,
  family: ThemeFamily,
  mode: Theme,
): number | null {
  let best: number | null = null;
  for (const arm of block.selector.split(",")) {
    const spec = armSpecificity(arm.trim(), family, mode);
    if (spec !== null && (best === null || spec > best)) best = spec;
  }
  return best;
}

/** Resolve every custom property for one family/mode pair, as CSS would. */
function resolve(family: ThemeFamily, mode: Theme): Map<string, Resolved> {
  const out = new Map<string, Resolved>();
  for (const block of BLOCKS) {
    const spec = blockSpecificity(block, family, mode);
    if (spec === null) continue;
    for (const [prop, value] of block.decls) {
      if (!prop.startsWith("--")) continue;
      const held = out.get(prop);
      // Higher specificity wins; equal specificity falls to source order,
      // and `decls` is already in order, so ">=" is the whole cascade.
      if (held === undefined || spec >= held.specificity) {
        out.set(prop, { value, specificity: spec, selector: block.selector });
      }
    }
  }
  return out;
}

/** The five combinations that exist. Obsidian has no light. */
const COMBOS: { family: ThemeFamily; mode: Theme }[] = [
  { family: "cappuccino", mode: "dark" },
  { family: "cappuccino", mode: "light" },
  { family: "obsidian", mode: "dark" },
  { family: "caramel", mode: "dark" },
  { family: "caramel", mode: "light" },
];

/** The tokens the spec lists. Every family declares every one of them. */
const MATERIAL_TOKENS = [
  "--ground-wash",
  "--rule-fill",
  "--rule-fill-inline",
  "--underline-fill",
  "--commit-fill",
  "--drink-sheen",
  "--reflection-alpha",
  "--reflection-height",
] as const;

const WEIGHT_TOKENS = ["--w-title", "--w-body", "--w-chosen"] as const;

const SPEC_TOKENS = [...MATERIAL_TOKENS, ...WEIGHT_TOKENS];

/** The subset that is a `background-image` value, and may therefore be a gradient. */
const IMAGE_TOKENS = [
  "--ground-wash",
  "--rule-fill",
  "--rule-fill-inline",
  "--underline-fill",
  "--commit-fill",
  "--drink-sheen",
] as const;

// ═══════════════════════════════════════════════════════════════════════════
// Resolution — family × mode → the two attributes on <html>
// ═══════════════════════════════════════════════════════════════════════════

function wrapper({ children }: { children: ReactNode }) {
  return <PreferencesProvider>{children}</PreferencesProvider>;
}

/** A `matchMedia` we control; the shared mock in setup.ts is frozen at light. */
function mockPrefersDark(dark: boolean) {
  Object.defineProperty(globalThis, "matchMedia", {
    value: () => ({
      matches: dark,
      media: "(prefers-color-scheme: dark)",
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
    configurable: true,
  });
}

function attributes() {
  const root = document.documentElement;
  return {
    family: root.getAttribute("data-theme-family"),
    theme: root.getAttribute("data-theme"),
  };
}

function themeColor(): string | null {
  return (
    document.querySelector('meta[name="theme-color"]')?.getAttribute("content") ??
    null
  );
}

describe("theme resolution", () => {
  const originalMatchMedia = globalThis.matchMedia;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.removeAttribute("data-theme-family");
    document.head.innerHTML = '<meta name="theme-color" content="#000000" />';
    mockPrefersDark(true);
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "matchMedia", {
      value: originalMatchMedia,
      configurable: true,
    });
  });

  /** The resolution table, one row at a time. */
  const TABLE: {
    stored: ThemeFamily | null;
    mode: "dark" | "light" | "system";
    device?: boolean;
    family: ThemeFamily;
    theme: Theme;
  }[] = [
    { stored: null, mode: "dark", family: "cappuccino", theme: "dark" },
    { stored: "cappuccino", mode: "dark", family: "cappuccino", theme: "dark" },
    { stored: "cappuccino", mode: "light", family: "cappuccino", theme: "light" },
    {
      stored: "cappuccino",
      mode: "system",
      device: false,
      family: "cappuccino",
      theme: "light",
    },
    { stored: "obsidian", mode: "dark", family: "obsidian", theme: "dark" },
    // The clamp: obsidian paints dark whatever the mode says.
    { stored: "obsidian", mode: "light", family: "obsidian", theme: "dark" },
    {
      stored: "obsidian",
      mode: "system",
      device: false,
      family: "obsidian",
      theme: "dark",
    },
    { stored: "caramel", mode: "dark", family: "caramel", theme: "dark" },
    { stored: "caramel", mode: "light", family: "caramel", theme: "light" },
    {
      stored: "caramel",
      mode: "system",
      device: false,
      family: "caramel",
      theme: "light",
    },
  ];

  for (const row of TABLE) {
    const name =
      `${row.stored ?? "(unset)"} + ${row.mode}` +
      (row.device === undefined ? "" : ` (device ${row.device ? "dark" : "light"})`);

    it(`resolves ${name} → family=${row.family} theme=${row.theme}`, () => {
      if (row.device !== undefined) mockPrefersDark(row.device);
      if (row.stored) localStorage.setItem("melitta_theme_family", row.stored);
      localStorage.setItem("melitta_theme", row.mode);

      const { result } = renderHook(() => usePreferences(), { wrapper });

      expect(result.current.themeFamily).toBe(row.family);
      expect(result.current.theme).toBe(row.theme);
      expect(attributes()).toEqual({ family: row.family, theme: row.theme });
    });
  }

  it("writes both attributes together, never one without the other", () => {
    const { result } = renderHook(() => usePreferences(), { wrapper });
    act(() => result.current.setThemeFamily("caramel"));
    expect(attributes()).toEqual({ family: "caramel", theme: "dark" });
    act(() => result.current.setTheme("light"));
    expect(attributes()).toEqual({ family: "caramel", theme: "light" });
  });

  it("clamps obsidian to dark WITHOUT overwriting the stored mode", () => {
    localStorage.setItem("melitta_theme", "light");
    const { result } = renderHook(() => usePreferences(), { wrapper });
    expect(result.current.theme).toBe("light");

    act(() => result.current.setThemeFamily("obsidian"));
    expect(result.current.theme).toBe("dark");
    // The choice is untouched: it is held, not edited.
    expect(result.current.themePreference).toBe("light");
    expect(localStorage.getItem("melitta_theme")).toBe("light");

    // …and leaving obsidian gives the user back exactly what they had.
    act(() => result.current.setThemeFamily("cappuccino"));
    expect(result.current.theme).toBe("light");
  });

  it("keeps a mode chosen WHILE on obsidian, for the family the user returns to", () => {
    localStorage.setItem("melitta_theme_family", "obsidian");
    const { result } = renderHook(() => usePreferences(), { wrapper });

    act(() => result.current.setTheme("light"));
    // Still dark on screen — obsidian cannot paint light.
    expect(result.current.theme).toBe("dark");
    expect(result.current.themePreference).toBe("light");

    act(() => result.current.setThemeFamily("caramel"));
    expect(result.current.theme).toBe("light");
  });

  it("reports the modes a family paints, and whether the row is held", () => {
    localStorage.setItem("melitta_theme_family", "obsidian");
    const { result } = renderHook(() => usePreferences(), { wrapper });
    expect(result.current.themeModes).toEqual(["dark"]);
    expect(result.current.themeModeLocked).toBe(true);

    act(() => result.current.setThemeFamily("caramel"));
    expect(result.current.themeModes).toEqual(["dark", "light"]);
    expect(result.current.themeModeLocked).toBe(false);
  });

  it("points the theme-color meta at the resolved family's ground", () => {
    const { result } = renderHook(() => usePreferences(), { wrapper });
    act(() => result.current.setTheme("dark"));
    expect(themeColor()).toBe("#100e0c");

    act(() => result.current.setTheme("light"));
    expect(themeColor()).toBe("#f4f0e9");

    act(() => result.current.setThemeFamily("caramel"));
    expect(themeColor()).toBe("#f7ece0");

    act(() => result.current.setTheme("dark"));
    expect(themeColor()).toBe("#170f07");

    // Obsidian is clamped to dark, and contributes the ground wash's TOP stop:
    // the browser chrome sits against the top of the page, not its midpoint.
    act(() => result.current.setThemeFamily("obsidian"));
    expect(themeColor()).toBe("#07070a");
    act(() => result.current.setTheme("light"));
    expect(themeColor()).toBe("#07070a");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Persistence and fallbacks
// ═══════════════════════════════════════════════════════════════════════════

describe("theme family persistence", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.removeAttribute("data-theme-family");
  });

  it("defaults to cappuccino when nothing was ever chosen", () => {
    const { result } = renderHook(() => usePreferences(), { wrapper });
    expect(result.current.themeFamily).toBe("cappuccino");
    expect(localStorage.getItem("melitta_theme_family")).toBeNull();
  });

  it("persists under melitta_theme_family", () => {
    const { result } = renderHook(() => usePreferences(), { wrapper });
    act(() => result.current.setThemeFamily("obsidian"));
    expect(localStorage.getItem("melitta_theme_family")).toBe("obsidian");
  });

  it("reads the stored family on init", () => {
    localStorage.setItem("melitta_theme_family", "caramel");
    const { result } = renderHook(() => usePreferences(), { wrapper });
    expect(result.current.themeFamily).toBe("caramel");
  });

  for (const bad of ["", "espresso", "Cappuccino", "obsidian ", "null"]) {
    it(`falls back to cappuccino for the unknown family ${JSON.stringify(bad)}`, () => {
      localStorage.setItem("melitta_theme_family", bad);
      const { result } = renderHook(() => usePreferences(), { wrapper });
      expect(result.current.themeFamily).toBe("cappuccino");
    });
  }

  it("an unknown family does not disturb the stored mode", () => {
    localStorage.setItem("melitta_theme_family", "espresso");
    localStorage.setItem("melitta_theme", "light");
    const { result } = renderHook(() => usePreferences(), { wrapper });
    expect(result.current.theme).toBe("light");
    expect(localStorage.getItem("melitta_theme")).toBe("light");
  });
});

describe("family capability helpers", () => {
  it("declares three families, cappuccino first", () => {
    expect(THEME_FAMILIES).toEqual(["cappuccino", "obsidian", "caramel"]);
  });

  it("declares the modes each family paints", () => {
    expect(FAMILY_MODES).toEqual({
      cappuccino: ["dark", "light"],
      obsidian: ["dark"],
      caramel: ["dark", "light"],
    });
  });

  it("answers whether a family can paint a mode", () => {
    expect(familySupportsMode("cappuccino", "light")).toBe(true);
    expect(familySupportsMode("caramel", "light")).toBe(true);
    expect(familySupportsMode("obsidian", "light")).toBe(false);
    expect(familySupportsMode("obsidian", "dark")).toBe(true);
  });

  it("names the single-mode families, and only those", () => {
    expect(isSingleModeFamily("obsidian")).toBe(true);
    expect(isSingleModeFamily("cappuccino")).toBe(false);
    expect(isSingleModeFamily("caramel")).toBe(false);
  });

  it("clamps a mode a family cannot paint to the one it can", () => {
    expect(resolveMode("obsidian", "light")).toBe("dark");
    expect(resolveMode("obsidian", "dark")).toBe("dark");
    expect(resolveMode("caramel", "light")).toBe("light");
    expect(resolveMode("cappuccino", "light")).toBe("light");
  });

  it("gives a ground for every family and mode, clamped like the paint", () => {
    for (const family of THEME_FAMILIES) {
      for (const mode of ["dark", "light"] as const) {
        expect(groundColor(family, mode)).toMatch(/^#[0-9a-f]{6}$/);
        expect(groundColor(family, mode)).toBe(
          FAMILY_GROUND[family][resolveMode(family, mode)],
        );
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// The material: what each family DECLARES
// ═══════════════════════════════════════════════════════════════════════════

describe("index.css: the theme cascade", () => {
  it("parses into blocks the resolver understands", () => {
    // The throw in armSpecificity() is the point of this one: if a new theme
    // selector shape appears, every combination below would silently skip it.
    expect(() => COMBOS.forEach((c) => resolve(c.family, c.mode))).not.toThrow();
    expect(BLOCKS.length).toBeGreaterThan(10);
  });

  it("needs no !important anywhere: family beats mode on specificity alone", () => {
    // No theme block shouts. (The reduced-motion block does, legitimately —
    // §11 collapses every animation over the top of whatever declared it.)
    for (const block of BLOCKS) {
      if (!block.selector.includes("data-theme")) continue;
      for (const [prop, value] of block.decls) {
        expect(value, `${block.selector} { ${prop} }`).not.toContain("!important");
      }
    }

    // Every family block is (0,2,0); every mode block is (0,1,0).
    for (const block of BLOCKS) {
      for (const arm of block.selector.split(",").map((a) => a.trim())) {
        const asFamily = FAMILY_ARM.exec(arm);
        if (!asFamily) continue;
        expect(
          asFamily[2],
          `${arm} must pair the family with [data-theme] so it outranks the mode blocks`,
        ).toBeTruthy();
      }
    }
  });

  it("declares no family block for cappuccino — it IS the mode blocks", () => {
    const familyBlocks = BLOCKS.filter((b) =>
      b.selector.includes("data-theme-family"),
    );
    expect(familyBlocks.map((b) => b.selector)).toEqual([
      '[data-theme-family="obsidian"][data-theme]',
      '[data-theme-family="caramel"][data-theme="dark"]',
      '[data-theme-family="caramel"][data-theme="light"]',
    ]);
  });

  for (const { family, mode } of COMBOS) {
    it(`${family}/${mode} resolves every token the spec lists`, () => {
      const tokens = resolve(family, mode);
      for (const token of SPEC_TOKENS) {
        expect(tokens.get(token)?.value, `${token} in ${family}/${mode}`)
          .toBeTruthy();
      }
    });
  }

  for (const { family, mode } of COMBOS.filter(
    (c) => c.family !== "cappuccino",
  )) {
    it(`${family}/${mode} declares every token itself — no family half-declared`, () => {
      const tokens = resolve(family, mode);
      for (const token of SPEC_TOKENS) {
        // Specificity 2 means the winning declaration came from a FAMILY
        // block. A token that resolved at 1 would be leaking through from
        // cappuccino, which is precisely the half-declared failure.
        expect(
          tokens.get(token)?.specificity,
          `${token} in ${family}/${mode} leaks from ${tokens.get(token)?.selector}`,
        ).toBe(2);
      }
    });
  }

  it("caramel declares the same token set in both of its modes", () => {
    const dark = new Set(
      BLOCKS.filter(
        (b) => b.selector === '[data-theme-family="caramel"][data-theme="dark"]',
      ).flatMap((b) => b.decls.map(([p]) => p)),
    );
    const light = new Set(
      BLOCKS.filter(
        (b) => b.selector === '[data-theme-family="caramel"][data-theme="light"]',
      ).flatMap((b) => b.decls.map(([p]) => p)),
    );
    expect([...dark].sort()).toEqual([...light].sort());
  });

  it("gives obsidian one mode, and pins it there whatever data-theme says", () => {
    // The CSS half of the dark-only clamp: even handed a stale
    // data-theme="light", obsidian resolves to its own material, never to
    // cappuccino's porcelain.
    const asDark = resolve("obsidian", "dark");
    const asLight = resolve("obsidian", "light");
    for (const token of [...SPEC_TOKENS, "--bg", "--accent", "--text-primary"]) {
      expect(asLight.get(token)?.value, token).toBe(asDark.get(token)?.value);
    }
    expect(asLight.get("--bg")?.value).toBe("#0b0b0f");
  });
});

describe("index.css: cappuccino is a refactor, not a redesign", () => {
  /**
   * Every value the app painted before the theme axis existed, frozen. If a
   * family block ever reaches cappuccino — by dropping a `[data-theme]` from a
   * selector, say, and widening it to every family — this is what catches it.
   *
   * Three values moved once, deliberately, when the theme audit measured them:
   * `--text-tertiary` in both modes and the light `--accent` were below WCAG AA
   * at the sizes they are actually set in (2.99:1 for grey on porcelain). They
   * were raised to clear 4.5:1 and frozen again here.
   */
  const CAPPUCCINO_DARK: Record<string, string> = {
    "--bg": "#100e0c",
    "--surface": "#1e1915",
    "--border": "rgba(217, 165, 102, 0.10)",
    "--border-hover": "rgba(217, 165, 102, 0.24)",
    "--border-active": "rgba(217, 165, 102, 0.44)",
    "--section-divider": "rgba(217, 165, 102, 0.10)",
    "--text-primary": "#f7f3ec",
    "--text-secondary": "#b5a899",
    "--text-tertiary": "#867a6f",
    "--text-inverse": "#17130f",
    "--accent": "#d9a566",
    "--accent-strong": "#e8bc85",
    "--meter-empty": "#2a221c",
    "--input-border": "rgba(217, 165, 102, 0.20)",
    "--success": "#7fb069",
    "--error-text": "#f0938a",
    "--error-border": "rgba(200, 80, 68, 0.45)",
    "--overlay-bg": "rgba(10, 8, 7, 0.86)",
    "--glass-stroke": "rgba(255, 255, 255, 0.42)",
    "--glass-fill": "rgba(255, 255, 255, 0.05)",
    "--glass-reflection": "rgba(255, 255, 255, 0.16)",
    "--drink-glow": "rgba(247, 243, 236, 0.10)",
    "--drink-contact": "rgba(0, 0, 0, 0.55)",
  };

  const CAPPUCCINO_LIGHT: Record<string, string> = {
    "--bg": "#f4f0e9",
    "--surface": "#ffffff",
    "--border": "rgba(42, 30, 20, 0.12)",
    "--border-hover": "rgba(42, 30, 20, 0.24)",
    "--border-active": "rgba(169, 113, 58, 0.55)",
    "--section-divider": "rgba(42, 30, 20, 0.12)",
    "--text-primary": "#211c18",
    "--text-secondary": "#6a5f55",
    "--text-tertiary": "#786a5d",
    "--text-inverse": "#fbf8f3",
    "--accent": "#986029",
    "--accent-strong": "#8d5c2c",
    "--meter-empty": "#e2d8c9",
    "--input-border": "rgba(42, 30, 20, 0.18)",
    "--success": "#4d7c3f",
    "--error-text": "#b3261e",
    "--error-border": "rgba(179, 38, 30, 0.35)",
    "--overlay-bg": "rgba(244, 240, 233, 0.90)",
    "--glass-stroke": "rgba(42, 30, 20, 0.28)",
    "--glass-fill": "rgba(42, 30, 20, 0.04)",
    "--glass-reflection": "rgba(255, 255, 255, 0.40)",
    "--drink-glow": "rgba(42, 30, 20, 0.07)",
    "--drink-contact": "rgba(42, 30, 20, 0.14)",
  };

  it("resolves the shipped dark palette unchanged", () => {
    const tokens = resolve("cappuccino", "dark");
    for (const [token, value] of Object.entries(CAPPUCCINO_DARK)) {
      expect(tokens.get(token)?.value, token).toBe(value);
    }
  });

  it("resolves the shipped light palette unchanged", () => {
    const tokens = resolve("cappuccino", "light");
    for (const [token, value] of Object.entries(CAPPUCCINO_LIGHT)) {
      expect(tokens.get(token)?.value, token).toBe(value);
    }
  });

  for (const mode of ["dark", "light"] as const) {
    it(`paints no new material in ${mode}: every image token is none`, () => {
      const tokens = resolve("cappuccino", mode);
      for (const token of IMAGE_TOKENS) {
        // A `none` layer is a no-op, which is the mechanical proof that
        // cappuccino cannot have moved a pixel.
        expect(tokens.get(token)?.value, token).toBe("none");
      }
    });

    it(`keeps the literals the primitives used to hardcode in ${mode}`, () => {
      const tokens = resolve("cappuccino", mode);
      expect(tokens.get("--reflection-alpha")?.value).toBe("0.28");
      expect(tokens.get("--reflection-height")?.value).toBe("0.18");
      expect(tokens.get("--w-title")?.value).toBe("600");
      expect(tokens.get("--w-body")?.value).toBe("400");
      expect(tokens.get("--w-chosen")?.value).toBe("600");
    });
  }
});

describe("index.css: what no family may do", () => {
  /** Every declaration in the file, with the selector it was written under. */
  const ALL = BLOCKS.flatMap((b) =>
    b.decls.map(([prop, value]) => ({ selector: b.selector, prop, value })),
  );

  const THEME_BLOCKS = BLOCKS.filter(
    (b) =>
      b.selector.includes("data-theme") ||
      b.selector.split(",").some((a) => a.trim() === ":root"),
  );

  it("introduces no radius: border-radius is 0 wherever it is written", () => {
    for (const { selector, prop, value } of ALL) {
      if (prop !== "border-radius") continue;
      expect(value, `${selector} { border-radius: ${value} }`).toBe("0");
    }
    // …and no family reintroduces the retired radius scale by the back door.
    for (const block of THEME_BLOCKS) {
      for (const [prop] of block.decls) {
        expect(prop, `${block.selector} declares ${prop}`).not.toMatch(
          /^--(r|radius)(-|$)/,
        );
        expect(prop).not.toBe("border-radius");
      }
    }
  });

  it("introduces no fifth type size: the four steps are the whole scale", () => {
    const sizes = ALL.filter((d) => d.prop === "font-size");
    expect(sizes.map((d) => `${d.selector} → ${d.value}`).sort()).toEqual([
      ".t-body → 0.9375rem",
      ".t-display → 1.75rem",
      ".t-label → 0.8125rem",
      ".t-title → 1.25rem",
      "body → 16px",
    ]);
    // A theme block may re-WEIGHT the scale and may not re-SIZE it.
    for (const block of THEME_BLOCKS) {
      for (const [prop] of block.decls) {
        expect(prop, `${block.selector} declares ${prop}`).not.toBe("font-size");
        // No family may smuggle a type STEP in as a token of its own.
        expect(prop).not.toMatch(/^--(t|type|step|size|font-size)-/);
      }
    }
  });

  it("re-weights the four steps from the weight axis, and nowhere else", () => {
    const weights = ALL.filter(
      (d) => d.prop === "font-weight" && !d.selector.includes("data-theme"),
    );
    expect(weights.map((d) => `${d.selector} → ${d.value}`).sort()).toEqual([
      ".t-body → var(--w-body)",
      ".t-display → var(--w-title)",
      ".t-label → calc(var(--w-body) + 100)",
      ".t-title → var(--w-title)",
      "body → var(--w-body)",
    ]);
  });

  it("keeps every gradient on one of the four permitted surfaces", () => {
    // The amendment, pinned on the CSS side: a gradient may only ever be the
    // value of a token that paints the ground, a rule, the selection underline
    // or the one commit rectangle — plus `--drink-sheen`, which is §S4.4
    // imagery riding on the neutral glow layer DrinkStage already draws, not a
    // container fill. Anything else painting a gradient is a violation
    // wherever it is written.
    const permitted = new Set<string>(IMAGE_TOKENS);
    for (const { selector, prop, value } of ALL) {
      if (!/\b(linear|radial|conic)-gradient\(/.test(value)) continue;
      expect(
        permitted.has(prop),
        `${selector} { ${prop}: … } paints a gradient outside the amendment`,
      ).toBe(true);
    }
  });

  it("lays the ground wash on the ground and on nothing else", () => {
    const carriers = ALL.filter((d) => d.value.includes("var(--ground-wash)"));
    expect(carriers.map((d) => d.selector).sort()).toEqual([".bg-page", "body"]);
    for (const d of carriers) expect(d.prop).toBe("background-image");
  });
});
