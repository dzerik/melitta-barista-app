import { createPortal } from "react-dom";
import { usePreferences, type ThemePreference } from "../lib/preferences";
import { SUPPORTED_LOCALES, LOCALE_ENDONYM } from "../lib/i18n";
import { Monitor, Moon, Sun, X } from "lucide-react";
import { Option } from "./ui/Option";
import { OptionRow } from "./ui/OptionRow";

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

/**
 * Theme and language, drawn as words.
 *
 * The three theme tiles — the app's most literal rounded-frame-plus-fill, and
 * its only `ring-2` — are gone: a choice here is a glyph-and-word Option whose
 * selection is white ink over a lit 1px `--accent` underline (§C1, owner
 * decision 1). The locale list loses its ringed box and its
 * `--surface-elevated` active row for the same reason; the endonyms wrap as a
 * field of words inside the one scrolling region.
 *
 * Two fills survive, and only these: the scrim (§5.A — the removal of the
 * page, not a container tint) and the single flat `--surface` panel (§5.B),
 * which carries no radius, no border, no ring, no shadow and no blur of its
 * own.
 */
export function PreferencesModal({ onClose }: Props) {
  const { themePreference, locale, setTheme, setLocale, t } = usePreferences();

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm"
      data-fill="scrim"
      style={{ backgroundColor: "var(--overlay-bg)" }}
      onClick={onClose}
      onTouchStart={stopTouch}
      onTouchMove={stopTouch}
      onTouchEnd={stopTouch}
    >
      <div
        className="relative w-full max-w-sm mx-4 surface flex flex-col"
        data-fill="panel"
        style={{ borderRadius: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pl-5 pr-2 py-2 border-b border-border">
          <span className="t-title text-primary">{t("prefs.title")}</span>
          <button
            onClick={onClose}
            /* The app's one universal abort word, already served in 29 locales. */
            aria-label={t("brew.cancel")}
            className="tap press text-secondary hover:text-primary"
            style={{ borderRadius: 0 }}
          >
            <X size={20} strokeWidth={1.75} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-6">
          {/* Theme */}
          <div className="space-y-2">
            <span className="t-label font-medium text-tertiary">
              {t("prefs.theme")}
            </span>
            <OptionRow role="radiogroup" ariaLabel={t("prefs.theme")}>
              {THEMES.map(({ value, labelKey, icon: Icon }) => (
                <Option
                  key={value}
                  label={t(labelKey)}
                  selected={themePreference === value}
                  role="radio"
                  onSelect={() => setTheme(value)}
                  icon={<Icon size={20} strokeWidth={1.75} />}
                />
              ))}
            </OptionRow>
          </div>

          {/* Locale */}
          <div className="space-y-2">
            <span className="t-label font-medium text-tertiary">
              {t("prefs.language")}
            </span>
            <div className="max-h-64 overflow-y-auto custom-scroll">
              <OptionRow role="radiogroup" ariaLabel={t("prefs.language")}>
                {SUPPORTED_LOCALES.map((value) => (
                  <Option
                    key={value}
                    label={LOCALE_ENDONYM[value]}
                    selected={locale === value}
                    role="radio"
                    onSelect={() => setLocale(value)}
                  />
                ))}
              </OptionRow>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
