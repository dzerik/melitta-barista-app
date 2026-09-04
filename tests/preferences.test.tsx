import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { PreferencesProvider, usePreferences } from "../src/lib/preferences";

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
