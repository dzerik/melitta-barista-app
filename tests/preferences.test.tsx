import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { fireEvent, renderHook, act, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { PreferencesProvider, usePreferences } from "../src/lib/preferences";
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

  it("names its two groups with the one shared heading treatment", () => {
    open();
    const headings = document.querySelectorAll<HTMLElement>('[data-ui="heading"]');
    expect(Array.from(headings).map((h) => h.textContent)).toEqual([
      "Theme",
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

  it("makes the three themes words with a reserved underline, not ringed tiles", () => {
    localStorage.setItem("melitta_theme", "dark");
    open();
    const themes = screen.getByRole("radiogroup", { name: "Theme" });
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

  it("picks a theme through the same word row", () => {
    open();
    fireEvent.click(
      within(screen.getByRole("radiogroup", { name: "Theme" })).getByRole(
        "radio",
        { name: "Light" },
      ),
    );
    expect(localStorage.getItem("melitta_theme")).toBe("light");
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
    const allowed = new Set(["scrim", "panel", "rule"]);
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
