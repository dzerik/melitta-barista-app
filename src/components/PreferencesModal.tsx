import { createPortal } from "react-dom";
import { usePreferences, type Theme } from "../lib/preferences";
import type { Locale } from "../lib/i18n";
import { Moon, Sun, X } from "lucide-react";
import flagEn from "../assets/flags/en.png";
import flagRu from "../assets/flags/ru.png";
import flagDe from "../assets/flags/de.png";

interface Props {
  onClose: () => void;
}

const THEMES: { value: Theme; labelKey: "prefs.theme_dark" | "prefs.theme_light"; icon: typeof Moon }[] = [
  { value: "dark", labelKey: "prefs.theme_dark", icon: Moon },
  { value: "light", labelKey: "prefs.theme_light", icon: Sun },
];

const LOCALES: { value: Locale; labelKey: "prefs.lang_en" | "prefs.lang_ru" | "prefs.lang_de"; flag: string }[] = [
  { value: "en", labelKey: "prefs.lang_en", flag: flagEn },
  { value: "ru", labelKey: "prefs.lang_ru", flag: flagRu },
  { value: "de", labelKey: "prefs.lang_de", flag: flagDe },
];

const stopTouch = (e: React.TouchEvent) => e.stopPropagation();

export function PreferencesModal({ onClose }: Props) {
  const { theme, locale, setTheme, setLocale, t } = usePreferences();

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
            className="text-tertiary hover:text-primary transition p-1"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-6">
          {/* Theme */}
          <div className="space-y-2">
            <span className="text-[10px] font-medium text-tertiary uppercase tracking-[0.2em]">
              {t("prefs.theme")}
            </span>
            <div className="grid grid-cols-2 gap-2">
              {THEMES.map(({ value, labelKey, icon: Icon }) => {
                const active = theme === value;
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
            <span className="text-[10px] font-medium text-tertiary uppercase tracking-[0.2em]">
              {t("prefs.language")}
            </span>
            <div className="grid grid-cols-3 gap-2">
              {LOCALES.map(({ value, labelKey, flag }) => {
                const active = locale === value;
                return (
                  <button
                    key={value}
                    onClick={() => setLocale(value)}
                    className={`flex flex-col items-center gap-2 rounded-xl py-3.5 px-2 transition-all duration-200 ${
                      active
                        ? "surface-elevated ring-2 ring-accent"
                        : "surface-card ring-1 ring-border hover:ring-border-hover"
                    }`}
                  >
                    <img
                      src={flag}
                      alt={value}
                      className="h-5 w-auto rounded-sm object-contain"
                      draggable={false}
                    />
                    <span
                      className={`text-[11px] font-medium ${active ? "text-primary" : "text-secondary"}`}
                    >
                      {t(labelKey)}
                    </span>
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
