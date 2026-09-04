import { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { ReactNode } from "react";
import { t, SUPPORTED_LOCALES, type Locale, type TranslationKey } from "./i18n";

/** The painted theme. */
export type Theme = "dark" | "light";
/** What the user chose: a fixed theme, or "follow this device". */
export type ThemePreference = Theme | "system";
export type ViewMode = "grid" | "list" | "carousel";

interface PreferencesContextValue {
  /** The theme currently painted — "system" is already resolved here. */
  theme: Theme;
  /** What the user chose; "system" until they pick a side. */
  themePreference: ThemePreference;
  locale: Locale;
  viewMode: ViewMode;
  setTheme: (theme: ThemePreference) => void;
  setLocale: (locale: Locale) => void;
  setViewMode: (mode: ViewMode) => void;
  t: (key: TranslationKey) => string;
}

const THEME_KEY = "melitta_theme";
const LOCALE_KEY = "melitta_locale";
const VIEW_MODE_KEY = "melitta_view_mode";

const DARK_QUERY = "(prefers-color-scheme: dark)";

/** The device's current preference; dark when the browser has no opinion. */
function systemTheme(): Theme {
  return window.matchMedia?.(DARK_QUERY).matches === false ? "light" : "dark";
}

/**
 * The stored choice. A value written before this app had a "system" option
 * is an explicit choice and stays one; only the absence of a value means
 * "follow the device".
 */
function getInitialThemePreference(): ThemePreference {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "light" || saved === "dark" || saved === "system") return saved;
  return "system";
}

function getInitialViewMode(): ViewMode {
  const saved = localStorage.getItem(VIEW_MODE_KEY);
  if (saved === "grid" || saved === "list" || saved === "carousel") return saved;
  return "grid";
}

function isSupported(value: string | null): value is Locale {
  return value !== null && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

function getInitialLocale(): Locale {
  const saved = localStorage.getItem(LOCALE_KEY);
  if (isSupported(saved)) return saved;
  // "de-CH" and "de" both resolve to the German bundle.
  const lang = navigator.language.slice(0, 2).toLowerCase();
  return isSupported(lang) ? lang : "en";
}

const PreferencesContext = createContext<PreferencesContextValue>(null!);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [themePreference, setThemePreferenceState] =
    useState<ThemePreference>(getInitialThemePreference);
  const [deviceTheme, setDeviceTheme] = useState<Theme>(systemTheme);
  const theme: Theme = themePreference === "system" ? deviceTheme : themePreference;
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale);
  const [viewMode, setViewModeState] = useState<ViewMode>(getInitialViewMode);

  const setTheme = useCallback((v: ThemePreference) => {
    setThemePreferenceState(v);
    localStorage.setItem(THEME_KEY, v);
  }, []);

  const setLocale = useCallback((v: Locale) => {
    setLocaleState(v);
    localStorage.setItem(LOCALE_KEY, v);
  }, []);

  const setViewMode = useCallback((v: ViewMode) => {
    setViewModeState(v);
    localStorage.setItem(VIEW_MODE_KEY, v);
  }, []);

  const translate = useCallback(
    (key: TranslationKey) => t(locale, key),
    [locale],
  );

  // Follow the device while the user has not taken a side. The listener runs
  // regardless of the current preference so that switching back to "system"
  // is already up to date.
  useEffect(() => {
    const mq = window.matchMedia?.(DARK_QUERY);
    if (!mq) return;
    const onChange = (e: MediaQueryListEvent) => setDeviceTheme(e.matches ? "dark" : "light");
    mq.addEventListener("change", onChange);
    setDeviceTheme(mq.matches ? "dark" : "light");
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    // Keep the PWA's own browser chrome (status bar, address bar) on the same
    // ground as the page; the static value in index.html stayed black in the
    // light theme.
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "light" ? "#f4f0e9" : "#100e0c");
  }, [theme]);

  return (
    <PreferencesContext.Provider
      value={{ theme, themePreference, locale, viewMode, setTheme, setLocale, setViewMode, t: translate }}
    >
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  return useContext(PreferencesContext);
}
