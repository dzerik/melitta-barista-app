import { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { ReactNode } from "react";
import { t, SUPPORTED_LOCALES, type Locale, type TranslationKey } from "./i18n";

/** The painted theme. */
export type Theme = "dark" | "light";
/** What the user chose: a fixed theme, or "follow this device". */
export type ThemePreference = Theme | "system";
export type ViewMode = "grid" | "list" | "carousel";

/**
 * The MATERIAL half of the theme. The mode says how light the room is; the
 * family says what the surfaces are made of — porcelain and paper, glass and
 * chrome, or matte sugar. The two are independent axes and compose in CSS
 * (see the cascade note at the top of `index.css`).
 */
export type ThemeFamily = "cappuccino" | "obsidian" | "caramel";

/** Every family, in the order the preferences row offers them. */
export const THEME_FAMILIES: readonly ThemeFamily[] = [
  "cappuccino",
  "obsidian",
  "caramel",
];

/**
 * Which modes each family can actually paint.
 *
 * Obsidian is dark only — a glossy black light theme is a contradiction, and
 * the honest way to say so is to declare one mode rather than to ship a second
 * one that lies. The preferences row dims the mode options for such a family
 * and says why beside them: DIM is state, OMIT is capability, and the mode
 * axis has not gone away, it is just held.
 */
export const FAMILY_MODES: Record<ThemeFamily, readonly Theme[]> = {
  cappuccino: ["dark", "light"],
  obsidian: ["dark"],
  caramel: ["dark", "light"],
};

/**
 * The flat ground each family/mode pair paints, for the `theme-color` meta —
 * the browser's own chrome sits against the TOP of the page, so a family with
 * a gradient wash contributes the wash's top stop rather than its midpoint.
 */
export const FAMILY_GROUND: Record<ThemeFamily, Record<Theme, string>> = {
  cappuccino: { dark: "#100e0c", light: "#f4f0e9" },
  // The first stop of `--ground-wash`, not the flat `--bg` beneath it.
  obsidian: { dark: "#07070a", light: "#07070a" },
  caramel: { dark: "#170f07", light: "#f7ece0" },
};

/** True when this family can paint this mode. */
export function familySupportsMode(family: ThemeFamily, mode: Theme): boolean {
  return FAMILY_MODES[family].includes(mode);
}

/** True when a family paints ONE mode — the signal to dim the mode row. */
export function isSingleModeFamily(family: ThemeFamily): boolean {
  return FAMILY_MODES[family].length === 1;
}

/**
 * The mode actually painted: what the user asked for, clamped to what the
 * family can do.
 *
 * The clamp NEVER writes back. A user on light who tries obsidian gets dark
 * while they are there and their light comes back the moment they return to
 * cappuccino — a family is a place you visit, not a thing that edits your
 * settings behind you.
 */
export function resolveMode(family: ThemeFamily, mode: Theme): Theme {
  return familySupportsMode(family, mode) ? mode : FAMILY_MODES[family][0];
}

/** The ground the browser chrome should match for a resolved family/mode. */
export function groundColor(family: ThemeFamily, mode: Theme): string {
  return FAMILY_GROUND[family][resolveMode(family, mode)];
}

interface PreferencesContextValue {
  /**
   * The theme currently painted. "system" is already resolved here AND the
   * family's clamp is already applied, so this is exactly what is on
   * `<html data-theme>`.
   */
  theme: Theme;
  /**
   * What the user chose; "system" until they pick a side. Untouched by a
   * family that cannot honour it.
   */
  themePreference: ThemePreference;
  /** The chosen material. Always one of THEME_FAMILIES. */
  themeFamily: ThemeFamily;
  /** The modes the chosen family can paint — one entry means the row is held. */
  themeModes: readonly Theme[];
  /**
   * True when the chosen family paints a single mode, so the mode row should
   * go to `opacity .35 / pointer-events: none` with the reason beside it.
   */
  themeModeLocked: boolean;
  locale: Locale;
  viewMode: ViewMode;
  setTheme: (theme: ThemePreference) => void;
  setThemeFamily: (family: ThemeFamily) => void;
  setLocale: (locale: Locale) => void;
  setViewMode: (mode: ViewMode) => void;
  t: (key: TranslationKey) => string;
}

const THEME_KEY = "melitta_theme";
const THEME_FAMILY_KEY = "melitta_theme_family";
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

/**
 * The stored family. Anything absent, misspelt or written by a future version
 * of this app falls back to cappuccino — the base family, which is the two
 * mode blocks in `index.css` and therefore always resolves.
 */
function getInitialThemeFamily(): ThemeFamily {
  const saved = localStorage.getItem(THEME_FAMILY_KEY);
  return (THEME_FAMILIES as readonly string[]).includes(saved ?? "")
    ? (saved as ThemeFamily)
    : "cappuccino";
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
  const [themeFamily, setThemeFamilyState] =
    useState<ThemeFamily>(getInitialThemeFamily);
  /** What the user asked for, before the family gets a say. */
  const requestedTheme: Theme =
    themePreference === "system" ? deviceTheme : themePreference;
  /** What is painted: the request, clamped to what this material supports. */
  const theme: Theme = resolveMode(themeFamily, requestedTheme);
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale);
  const [viewMode, setViewModeState] = useState<ViewMode>(getInitialViewMode);

  const setTheme = useCallback((v: ThemePreference) => {
    setThemePreferenceState(v);
    localStorage.setItem(THEME_KEY, v);
  }, []);

  const setThemeFamily = useCallback((v: ThemeFamily) => {
    setThemeFamilyState(v);
    localStorage.setItem(THEME_FAMILY_KEY, v);
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

  // The two axes are written together, always, because `index.css` resolves a
  // family block at `[data-theme-family="F"][data-theme="M"]` — one attribute
  // without the other resolves to the base family, which would be a visible
  // flash of porcelain.
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme-family", themeFamily);
    root.setAttribute("data-theme", theme);
    // Keep the PWA's own browser chrome (status bar, address bar) on the same
    // ground as the page; the static value in index.html stayed black in the
    // light theme.
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", groundColor(themeFamily, theme));
  }, [theme, themeFamily]);

  return (
    <PreferencesContext.Provider
      value={{
        theme,
        themePreference,
        themeFamily,
        themeModes: FAMILY_MODES[themeFamily],
        themeModeLocked: isSingleModeFamily(themeFamily),
        locale,
        viewMode,
        setTheme,
        setThemeFamily,
        setLocale,
        setViewMode,
        t: translate,
      }}
    >
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  return useContext(PreferencesContext);
}
