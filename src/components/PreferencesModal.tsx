import { createPortal } from "react-dom";
import { usePreferences, type ThemePreference } from "../lib/preferences";
import { SUPPORTED_LOCALES, LOCALE_ENDONYM } from "../lib/i18n";
import { Check, Monitor, Moon, Sun, X } from "lucide-react";

interface Props {
  onClose: () => void;
}

type ThemeLabelKey = "prefs.theme_system" | "prefs.theme_dark" | "prefs.theme_light";

const THEMES: { value: ThemePreference; labelKey: ThemeLabelKey; icon: typeof Moon }[] = [
  { value: "system", labelKey: "prefs.theme_system", icon: Monitor },
  { value: "dark", labelKey: "prefs.theme_dark", icon: Moon },
  { value: "light", labelKey: "prefs.theme_light", icon: Sun },
];

const stopTouch = (e: React.TouchEvent) => e.stopPropagation();

export function PreferencesModal({ onClose }: Props) {
  const { themePreference, locale, setTheme, setLocale, t } = usePreferences();

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 dark:bg-black/70 light:bg-black/40 backdrop-blur-sm"
      onClick={onClose}
      onTouchStart={stopTouch}
      onTouchMove={stopTouch}
      onTouchEnd={stopTouch}
    >
      <div
        className="relative w-full max-w-sm mx-4 rounded-2xl surface ring-1 ring-border overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <span className="text-sm font-semibold text-primary tracking-wide">
            {t("prefs.title")}
          </span>
          <button
            onClick={onClose}
            className="tap press rounded-xl text-secondary hover:text-primary"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-6">
          {/* Theme */}
          <div className="space-y-2">
            <span className="t-label font-medium text-tertiary">
              {t("prefs.theme")}
            </span>
            <div className="grid grid-cols-3 gap-2">
              {THEMES.map(({ value, labelKey, icon: Icon }) => {
                const active = themePreference === value;
                return (
                  <button
                    key={value}
                    onClick={() => setTheme(value)}
                    className={`flex flex-col items-center gap-2.5 rounded-xl py-4 px-3 transition-all duration-200 ${
                      active
                        ? "surface-elevated ring-2 ring-accent"
                        : "surface-card ring-1 ring-border hover:ring-border-hover"
                    }`}
                  >
                    <Icon
                      size={24}
                      className={active ? "text-accent" : "text-tertiary"}
                    />
                    <span
                      className={`text-xs font-medium ${active ? "text-primary" : "text-secondary"}`}
                    >
                      {t(labelKey)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Locale */}
          <div className="space-y-2">
            <span className="t-label font-medium text-tertiary">
              {t("prefs.language")}
            </span>
            <div className="max-h-64 overflow-y-auto custom-scroll rounded-xl ring-1 ring-border">
              {SUPPORTED_LOCALES.map((value) => {
                const active = locale === value;
                return (
                  <button
                    key={value}
                    onClick={() => setLocale(value)}
                    aria-current={active ? "true" : undefined}
                    className="tap press w-full flex items-center justify-between gap-3 px-4 t-body"
                    style={{
                      background: active ? "var(--surface-elevated)" : "transparent",
                      color: active ? "var(--text-primary)" : "var(--text-secondary)",
                      fontWeight: active ? 600 : 400,
                    }}
                  >
                    <span>{LOCALE_ENDONYM[value]}</span>
                    {active && <Check size={18} style={{ color: "var(--accent)" }} />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
