import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { PreferencesProvider, usePreferences } from "../src/lib/preferences";

function wrapper({ children }: { children: ReactNode }) {
  return <PreferencesProvider>{children}</PreferencesProvider>;
}

describe("usePreferences", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns default viewMode as grid", () => {
    const { result } = renderHook(() => usePreferences(), { wrapper });
    expect(result.current.viewMode).toBe("grid");
  });

  it("returns default theme as dark", () => {
    const { result } = renderHook(() => usePreferences(), { wrapper });
    expect(result.current.theme).toBe("dark");
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
