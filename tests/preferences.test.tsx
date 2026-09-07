import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { fireEvent, renderHook, act, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  PreferencesProvider,
  THEME_FAMILIES,
  usePreferences,
} from "../src/lib/preferences";
import { renderWithProviders } from "./test-utils";
import { PreferencesModal } from "../src/components/PreferencesModal";
import { SUPPORTED_LOCALES } from "../src/lib/i18n";

function wrapper({ children }: { children: ReactNode }) {
  return <PreferencesProvider>{children}</PreferencesProvider>;
}

/**
 * A `matchMedia` whose answer we control, with working change events — the
 * shared mock in setup.ts is frozen at "light" and never fires.
 */
function mockPrefersDark(dark: boolean) {
  const listeners = new Set<(e: MediaQueryListEvent) => void>();
  const mql = {
    matches: dark,
    media: "(prefers-color-scheme: dark)",
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: (_: string, fn: (e: MediaQueryListEvent) => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: (e: MediaQueryListEvent) => void) => listeners.delete(fn),
    dispatchEvent: () => false,
  };
  Object.defineProperty(globalThis, "matchMedia", {
    value: () => mql,
    configurable: true,
  });
  return {
    /** Flip the device preference the way a user changing their OS theme does. */
    flip(nowDark: boolean) {
      mql.matches = nowDark;
      for (const fn of listeners) fn({ matches: nowDark } as MediaQueryListEvent);
    },
  };
}

describe("usePreferences", () => {
  const originalMatchMedia = globalThis.matchMedia;

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "matchMedia", {
      value: originalMatchMedia,
      configurable: true,
    });
  });

  it("returns default viewMode as grid", () => {
    const { result } = renderHook(() => usePreferences(), { wrapper });
    expect(result.current.viewMode).toBe("grid");
  });

  it("follows the device when nothing was ever chosen", () => {
    mockPrefersDark(false);
    const { result } = renderHook(() => usePreferences(), { wrapper });
    expect(result.current.themePreference).toBe("system");
    expect(result.current.theme).toBe("light");
  });

  it("paints dark for a device that asks for dark", () => {
    mockPrefersDark(true);
    const { result } = renderHook(() => usePreferences(), { wrapper });
    expect(result.current.theme).toBe("dark");
  });

  it("repaints when the device preference changes mid-session", () => {
    const device = mockPrefersDark(false);
    const { result } = renderHook(() => usePreferences(), { wrapper });
    expect(result.current.theme).toBe("light");
    act(() => device.flip(true));
    expect(result.current.theme).toBe("dark");
  });

  it("an explicit choice outranks the device and survives its changes", () => {
    const device = mockPrefersDark(true);
    const { result } = renderHook(() => usePreferences(), { wrapper });
    act(() => result.current.setTheme("light"));
    expect(result.current.theme).toBe("light");
    act(() => device.flip(false));
    expect(result.current.theme).toBe("light");
  });

  it("a theme stored before this option existed stays an explicit choice", () => {
    mockPrefersDark(false);
    localStorage.setItem("melitta_theme", "dark");
    const { result } = renderHook(() => usePreferences(), { wrapper });
    expect(result.current.themePreference).toBe("dark");
    expect(result.current.theme).toBe("dark");
  });

  it("setTheme('system') hands control back to the device", () => {
    mockPrefersDark(true);
    localStorage.setItem("melitta_theme", "light");
    const { result } = renderHook(() => usePreferences(), { wrapper });
    expect(result.current.theme).toBe("light");
    act(() => result.current.setTheme("system"));
    expect(result.current.theme).toBe("dark");
    expect(localStorage.getItem("melitta_theme")).toBe("system");
  });

  it("setViewMode updates the value", () => {
    const { result } = renderHook(() => usePreferences(), { wrapper });
    act(() => result.current.setViewMode("carousel"));
    expect(result.current.viewMode).toBe("carousel");
  });

  it("setViewMode persists to localStorage", () => {
    const { result } = renderHook(() => usePreferences(), { wrapper });
    act(() => result.current.setViewMode("list"));
    expect(localStorage.getItem("melitta_view_mode")).toBe("list");
  });

  it("reads viewMode from localStorage on init", () => {
    localStorage.setItem("melitta_view_mode", "carousel");
    const { result } = renderHook(() => usePreferences(), { wrapper });
    expect(result.current.viewMode).toBe("carousel");
  });

  it("falls back to grid for invalid localStorage value", () => {
    localStorage.setItem("melitta_view_mode", "invalid");
    const { result } = renderHook(() => usePreferences(), { wrapper });
    expect(result.current.viewMode).toBe("grid");
  });

  it("setTheme updates theme", () => {
    const { result } = renderHook(() => usePreferences(), { wrapper });
    act(() => result.current.setTheme("light"));
    expect(result.current.theme).toBe("light");
    expect(localStorage.getItem("melitta_theme")).toBe("light");
  });

  it("setLocale updates locale", () => {
    const { result } = renderHook(() => usePreferences(), { wrapper });
    act(() => result.current.setLocale("de"));
    expect(result.current.locale).toBe("de");
    expect(localStorage.getItem("melitta_locale")).toBe("de");
  });

  it("t function translates keys", () => {
    const { result } = renderHook(() => usePreferences(), { wrapper });
    expect(result.current.t("app.title")).toBe("Melitta Barista");
  });

  it("t function uses locale-specific translations", () => {
    localStorage.setItem("melitta_locale", "ru");
    const { result } = renderHook(() => usePreferences(), { wrapper });
    expect(result.current.t("brew.cancel")).toBe("Отмена");
  });

  it("switching all view modes cycles correctly", () => {
    const { result } = renderHook(() => usePreferences(), { wrapper });
    expect(result.current.viewMode).toBe("grid");

    act(() => result.current.setViewMode("list"));
    expect(result.current.viewMode).toBe("list");

    act(() => result.current.setViewMode("carousel"));
    expect(result.current.viewMode).toBe("carousel");

    act(() => result.current.setViewMode("grid"));
    expect(result.current.viewMode).toBe("grid");
  });

  // -------------------------------------------------------------------------
  // The MATERIAL axis
  // -------------------------------------------------------------------------

  it("starts on cappuccino, by absence rather than by writing one", () => {
    const { result } = renderHook(() => usePreferences(), { wrapper });
    expect(result.current.themeFamily).toBe("cappuccino");
    // Nothing is stored until the user picks, so an untouched install is the
    // base family because no family block matches, not because we wrote one.
    expect(localStorage.getItem("melitta_theme_family")).toBeNull();
  });

  it("falls back to cappuccino for a family this version cannot paint", () => {
    localStorage.setItem("melitta_theme_family", "Obsidian ");
    const { result } = renderHook(() => usePreferences(), { wrapper });
    expect(result.current.themeFamily).toBe("cappuccino");
  });

  it("an unknown family leaves the stored mode alone", () => {
    localStorage.setItem("melitta_theme_family", "titanium");
    localStorage.setItem("melitta_theme", "light");
    const { result } = renderHook(() => usePreferences(), { wrapper });
    expect(result.current.themeFamily).toBe("cappuccino");
    expect(result.current.theme).toBe("light");
    expect(localStorage.getItem("melitta_theme")).toBe("light");
  });

  it("setThemeFamily persists and writes both axes onto <html>", () => {
    mockPrefersDark(true);
    const { result } = renderHook(() => usePreferences(), { wrapper });
    act(() => result.current.setThemeFamily("caramel"));
    expect(result.current.themeFamily).toBe("caramel");
    expect(localStorage.getItem("melitta_theme_family")).toBe("caramel");
    // One without the other resolves to cappuccino, so both or neither.
    expect(document.documentElement.getAttribute("data-theme-family")).toBe("caramel");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("a dark-only family paints dark WITHOUT editing the stored mode", () => {
    localStorage.setItem("melitta_theme", "light");
    const { result } = renderHook(() => usePreferences(), { wrapper });
    expect(result.current.theme).toBe("light");

    act(() => result.current.setThemeFamily("obsidian"));
    expect(result.current.theme).toBe("dark");
    expect(result.current.themeModeLocked).toBe(true);
    expect(result.current.themeModes).toEqual(["dark"]);
    // The clamp is a place you visit, not a thing that rewrites your settings.
    expect(result.current.themePreference).toBe("light");
    expect(localStorage.getItem("melitta_theme")).toBe("light");
  });

  it("leaving the dark-only family gives the light theme straight back", () => {
    localStorage.setItem("melitta_theme", "light");
    const { result } = renderHook(() => usePreferences(), { wrapper });
    act(() => result.current.setThemeFamily("obsidian"));
    expect(result.current.theme).toBe("dark");

    act(() => result.current.setThemeFamily("cappuccino"));
    expect(result.current.theme).toBe("light");
    expect(result.current.themeModeLocked).toBe(false);
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("choosing a mode while it is clamped still records the choice", () => {
    localStorage.setItem("melitta_theme_family", "obsidian");
    const { result } = renderHook(() => usePreferences(), { wrapper });
    act(() => result.current.setTheme("light"));
    // Obsidian keeps painting dark; the preference is what the user asked for.
    expect(result.current.theme).toBe("dark");
    expect(result.current.themePreference).toBe("light");
    act(() => result.current.setThemeFamily("caramel"));
    expect(result.current.theme).toBe("light");
  });
});

// ---------------------------------------------------------------------------
// PreferencesModal — theme and language drawn as words
// ---------------------------------------------------------------------------

describe("PreferencesModal", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  function open() {
    return renderWithProviders(<PreferencesModal onClose={() => {}} />);
  }

  it("dims the page with the token scrim, not an off-token bg-black/70", () => {
    open();
    const scrim = document.querySelector<HTMLElement>('[data-fill="scrim"]')!;
    expect(scrim.style.backgroundColor).toBe("var(--overlay-bg)");
    expect(scrim.className).not.toMatch(/bg-black/);
    // §5.A: the scrim is the one place a blur is allowed.
    expect(scrim.className).toContain("backdrop-blur-sm");
  });

  it("draws exactly one flat --surface panel: radius 0, no ring, no border, no blur", () => {
    open();
    const panels = document.querySelectorAll<HTMLElement>('[data-fill="panel"]');
    expect(panels).toHaveLength(1);
    const panel = panels[0];
    // R3: the fill is a `backgroundColor` LONGHAND, not `className="surface"`
    // — that rule uses the `background` shorthand, which jsdom drops, so the
    // one carve-out fill on this overlay used to be invisible to this very
    // assertion. Reading the property is the whole point of the change.
    expect(panel.style.backgroundColor).toBe("var(--surface)");
    expect(panel.className).not.toContain("surface");
    expect(panel.style.borderRadius).toBe("0px");
    expect(panel.className).not.toMatch(/(^|\s)ring-|(^|\s)rounded|shadow-|backdrop-blur/);
    expect(panel.style.boxShadow).toBe("none");
  });

  it("shares the one modal shell: a dialog with one header and one close X", () => {
    open();
    const dialog = screen.getByRole("dialog");
    expect(dialog.dataset.ui).toBe("panel");
    // C8: three measures exist and a short list takes the smallest.
    expect(dialog.dataset.measure).toBe("sm");
    expect(dialog).toHaveAccessibleName("Preferences");
    expect(
      dialog.querySelectorAll('[data-ui="panel-header"]'),
    ).toHaveLength(1);
    // C9: one close control, at one size, in one colour — the hand-rolled
    // 24-viewBox X, the `X size={18}` and the `ChevronUp size={16}` are gone.
    const closes = dialog.querySelectorAll<HTMLElement>('[data-ui="panel-close"]');
    expect(closes).toHaveLength(1);
    expect(closes[0]).toHaveAccessibleName("Cancel");
    expect(closes[0].style.color).toBe("var(--text-secondary)");
  });

  it("closes from the scrim, the X and Escape", () => {
    const onClose = vi.fn();
    renderWithProviders(<PreferencesModal onClose={onClose} />);
    fireEvent.click(
      document.querySelector<HTMLElement>('[data-ui="panel-close"]')!,
    );
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(document.querySelector<HTMLElement>('[data-fill="scrim"]')!);
    expect(onClose).toHaveBeenCalledTimes(2);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("names its three groups with the one shared heading treatment", () => {
    open();
    const headings = document.querySelectorAll<HTMLElement>('[data-ui="heading"]');
    // Two theme rows, two questions: WHAT the surfaces are made of, and how
    // light the room is. The material row is first because the mode row is a
    // refinement of it — and because a family can hold the mode row, never the
    // other way round.
    expect(Array.from(headings).map((h) => h.textContent)).toEqual([
      "Theme",
      "Mode",
      "Language",
    ]);
    headings.forEach((h) => {
      // C31: one type, one colour, one margin — `t-label` tertiary at the
      // weight `.t-label` already carries, never a 600-weight primary variant.
      expect(h.className).toContain("t-label");
      expect(h.className).toContain("text-tertiary");
      expect(h.className).not.toMatch(/font-medium|font-semibold|text-primary/);
      expect(h.style.marginBottom).toBe("1rem");
      expect(h.style.fontWeight).toBe("");
    });
  });

  it("makes the three modes words with a reserved underline, not ringed tiles", () => {
    localStorage.setItem("melitta_theme", "dark");
    open();
    const themes = screen.getByRole("radiogroup", { name: "Mode" });
    const words = within(themes).getAllByRole("radio");
    expect(words.map((w) => w.textContent)).toEqual(["System", "Dark", "Light"]);

    const chosen = within(themes).getByRole("radio", { name: "Dark" });
    expect(chosen).toHaveAttribute("data-underline", "lit");
    expect(chosen.style.color).toBe("var(--text-primary)");
    // Selection is never a fill, a ring or a background swap.
    expect(chosen.style.backgroundColor).toBe("");
    // The contract is that the slot is ALWAYS declared and identical in both
    // states, so lighting it shifts nothing. It is deliberately NOT pinned to
    // the resolved "1px": the measure lives in `--underline-w`, and pinning
    // the literal here is what forced `Option` to keep a private
    // `underlineSlot(…, { literal: true })` escape (C24). Comparing the two
    // states to each other tests the invariant and frees the token.
    const slot = words[0].style.borderBottomWidth;
    expect(slot).not.toBe("");
    words.forEach((w) => {
      expect(w.style.borderBottomWidth).toBe(slot);
      expect(w.style.borderBottomStyle).toBe("solid");
      expect(w.className).toContain("tap");
      expect(w.className).toContain("press");
    });
    expect(chosen.style.borderBottomColor).toBe("var(--accent)");
    expect(
      words.find((w) => w !== chosen)!.style.borderBottomColor,
    ).toBe("transparent");
  });

  it("picks a mode through the same word row", () => {
    open();
    fireEvent.click(
      within(screen.getByRole("radiogroup", { name: "Mode" })).getByRole(
        "radio",
        { name: "Light" },
      ),
    );
    expect(localStorage.getItem("melitta_theme")).toBe("light");
  });

  // -------------------------------------------------------------------------
  // The material row, and the mode row it can hold
  // -------------------------------------------------------------------------

  /** The three families as words, in the order the row offers them. */
  function families() {
    return within(screen.getByRole("radiogroup", { name: "Theme" })).getAllByRole(
      "radio",
    );
  }

  /** The three modes as words, dimmed or not. */
  function modes() {
    return within(screen.getByRole("radiogroup", { name: "Mode" })).getAllByRole(
      "radio",
    );
  }

  it("offers the three materials as words, in THEME_FAMILIES order", () => {
    open();
    expect(families().map((w) => w.textContent)).toEqual([
      "Cappuccino",
      "Obsidian",
      "Caramel",
    ]);
    expect(families()).toHaveLength(THEME_FAMILIES.length);
    // Same control as every other choice in the app: a word over a reserved
    // underline slot, never a swatch, a tile or a filled chip.
    families().forEach((w) => {
      expect(w.dataset.ui).toBe("option");
      expect(w.style.backgroundColor).toBe("");
      expect(w.style.borderBottomStyle).toBe("solid");
    });
    expect(
      within(screen.getByRole("radiogroup", { name: "Theme" })).getByRole("radio", {
        name: "Cappuccino",
      }),
    ).toHaveAttribute("data-underline", "lit");
  });

  it("choosing a family sets it and lights its word", () => {
    open();
    fireEvent.click(
      within(screen.getByRole("radiogroup", { name: "Theme" })).getByRole("radio", {
        name: "Caramel",
      }),
    );
    expect(localStorage.getItem("melitta_theme_family")).toBe("caramel");
    expect(document.documentElement.getAttribute("data-theme-family")).toBe(
      "caramel",
    );
    const [cappuccino, , caramel] = families();
    expect(caramel).toHaveAttribute("data-underline", "lit");
    expect(cappuccino).toHaveAttribute("data-underline", "reserved");
  });

  it("obsidian dims the mode row without erasing the stored mode", () => {
    localStorage.setItem("melitta_theme", "light");
    open();
    fireEvent.click(
      within(screen.getByRole("radiogroup", { name: "Theme" })).getByRole("radio", {
        name: "Obsidian",
      }),
    );

    // DIM IS STATE, OMIT IS CAPABILITY: all three words are still on screen,
    // in their places, held at §10's disabled treatment.
    expect(modes().map((w) => w.textContent)).toEqual(["System", "Dark", "Light"]);
    modes().forEach((w) => {
      expect(w.style.opacity).toBe("0.35");
      expect(w.style.pointerEvents).toBe("none");
    });
    // The reason sits beside them, quiet and at full opacity — the note is not
    // disabled, the words are.
    const note = document.querySelector<HTMLElement>('[data-ui="mode-locked-note"]')!;
    expect(note).toBeTruthy();
    expect(note.textContent).toBe("This theme is painted dark only");
    expect(note.className).toContain("t-label");
    expect(note.className).toContain("text-tertiary");

    // The stored choice survives, and stays visibly the chosen one.
    expect(localStorage.getItem("melitta_theme")).toBe("light");
    expect(
      within(screen.getByRole("radiogroup", { name: "Mode" })).getByRole("radio", {
        name: "Light",
      }),
    ).toHaveAttribute("data-underline", "lit");
    // ...while the page itself paints dark.
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("a held mode word cannot be pressed", () => {
    localStorage.setItem("melitta_theme", "light");
    open();
    fireEvent.click(
      within(screen.getByRole("radiogroup", { name: "Theme" })).getByRole("radio", {
        name: "Obsidian",
      }),
    );
    fireEvent.click(
      within(screen.getByRole("radiogroup", { name: "Mode" })).getByRole("radio", {
        name: "Dark",
      }),
    );
    expect(localStorage.getItem("melitta_theme")).toBe("light");
  });

  it("switching back off obsidian restores the mode row and the light theme", () => {
    localStorage.setItem("melitta_theme", "light");
    open();
    const theme = screen.getByRole("radiogroup", { name: "Theme" });
    fireEvent.click(within(theme).getByRole("radio", { name: "Obsidian" }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");

    fireEvent.click(within(theme).getByRole("radio", { name: "Cappuccino" }));
    modes().forEach((w) => {
      expect(w.style.opacity).toBe("1");
      expect(w.style.pointerEvents).toBe("");
    });
    expect(
      document.querySelector('[data-ui="mode-locked-note"]'),
    ).toBeNull();
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    // And the row is live again.
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "Mode" })).getByRole("radio", { name: "Dark" }));
    expect(localStorage.getItem("melitta_theme")).toBe("dark");
  });

  it("says nothing about the mode row while every mode is available", () => {
    open();
    expect(document.querySelector('[data-ui="mode-locked-note"]')).toBeNull();
    modes().forEach((w) => expect(w.style.opacity).toBe("1"));
  });

  it("lists every locale as an endonym word and switches on tap", () => {
    open();
    const languages = screen.getByRole("radiogroup", { name: "Language" });
    const words = within(languages).getAllByRole("radio");
    expect(words).toHaveLength(SUPPORTED_LOCALES.length);
    expect(
      within(languages).getByRole("radio", { name: "English" }),
    ).toHaveAttribute("data-underline", "lit");

    fireEvent.click(within(languages).getByRole("radio", { name: "Русский" }));
    expect(localStorage.getItem("melitta_locale")).toBe("ru");
    // The active row is a word in white, never a `--surface-elevated` band.
    words.forEach((w) => expect(w.style.backgroundColor).toBe(""));
  });

  it("draws no rounded frame, ring, shadow or tracked-out caps anywhere", () => {
    open();
    const scrim = document.querySelector<HTMLElement>('[data-fill="scrim"]')!;
    scrim.querySelectorAll<HTMLElement>("*").forEach((el) => {
      const radius = el.style?.borderRadius ?? "";
      if (radius !== "") expect(radius).toBe("0px");
      const cls = String(el.className);
      expect(cls).not.toMatch(/(^|\s)rounded/);
      expect(cls).not.toMatch(/(^|\s)ring-/);
      expect(cls).not.toMatch(/shadow-/);
      expect(cls).not.toMatch(/tracking-|uppercase/);
    });
  });

  it("paints nothing but the scrim, that one panel and its hairlines", () => {
    open();
    const scrim = document.querySelector<HTMLElement>('[data-fill="scrim"]')!;
    // A 1px `--border` hairline is §S4.2 — a drawn boundary, not a container
    // fill — and it declares itself `data-fill="rule"` so the inventory query
    // still sees every painted pixel on the screen.
    // `underline` joins them for the same reason (the 2026-09-07 amendment):
    // a chosen word carries a 1px `--underline-fill` strip over the accent
    // border its slot reserves. It paints `none` in every family but obsidian,
    // and it is a LINE, never a fill behind the word.
    const allowed = new Set(["scrim", "panel", "rule", "underline"]);
    [scrim, ...Array.from(scrim.querySelectorAll<HTMLElement>("*"))].forEach(
      (el) => {
        const painted =
          (el.style?.backgroundColor ?? "") !== "" ||
          (el.style?.backgroundImage ?? "") !== "";
        const isPanel = el.getAttribute("data-fill") === "panel";
        if (!painted && !isPanel) return;
        expect(allowed.has(el.getAttribute("data-fill") ?? "")).toBe(true);
      },
    );
  });
});
