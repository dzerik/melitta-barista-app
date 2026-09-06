import { describe, it, expect, beforeEach, afterEach } from "vitest";
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
    expect(panel.className).toContain("surface");
    expect(panel.style.borderRadius).toBe("0px");
    expect(panel.className).not.toMatch(/(^|\s)ring-|(^|\s)rounded|shadow-|backdrop-blur/);
    expect(panel.style.boxShadow).toBe("");
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
    words.forEach((w) => {
      expect(w.style.borderBottomWidth).toBe("1px");
      expect(w.className).toContain("tap");
      expect(w.className).toContain("press");
    });
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

  it("paints nothing but the scrim and that one panel", () => {
    open();
    const scrim = document.querySelector<HTMLElement>('[data-fill="scrim"]')!;
    const allowed = new Set(["scrim", "panel"]);
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
