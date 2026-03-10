import { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { ReactNode } from "react";
import { t, type Locale, type TranslationKey } from "./i18n";

export type Theme = "dark" | "light";
export type ViewMode = "grid" | "list" | "carousel";

interface PreferencesContextValue {
  theme: Theme;
  locale: Locale;
  viewMode: ViewMode;
  setTheme: (theme: Theme) => void;
  setLocale: (locale: Locale) => void;
  setViewMode: (mode: ViewMode) => void;
  t: (key: TranslationKey) => string;
}

const THEME_KEY = "melitta_theme";
const LOCALE_KEY = "melitta_locale";
const VIEW_MODE_KEY = "melitta_view_mode";

function getInitialTheme(): Theme {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "light" || saved === "dark") return saved;
  return "dark";
}

function getInitialViewMode(): ViewMode {
  const saved = localStorage.getItem(VIEW_MODE_KEY);
  if (saved === "grid" || saved === "list" || saved === "carousel") return saved;
  return "grid";
}

function getInitialLocale(): Locale {
  const saved = localStorage.getItem(LOCALE_KEY);
  if (saved === "en" || saved === "ru" || saved === "de") return saved;
  const lang = navigator.language.slice(0, 2);
  if (lang === "ru") return "ru";
  if (lang === "de") return "de";
  return "en";
}

const PreferencesContext = createContext<PreferencesContextValue>(null!);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale);
  const [viewMode, setViewModeState] = useState<ViewMode>(getInitialViewMode);

  const setTheme = useCallback((v: Theme) => {
    setThemeState(v);
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

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  return (
    <PreferencesContext.Provider
      value={{ theme, locale, viewMode, setTheme, setLocale, setViewMode, t: translate }}
    >
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  return useContext(PreferencesContext);
}
