import { usePreferences, type ThemePreference } from "../lib/preferences";
import { SUPPORTED_LOCALES, LOCALE_ENDONYM } from "../lib/i18n";
import { Monitor, Moon, Sun } from "lucide-react";
import { Heading, Option, OptionRow, Panel } from "./ui";
import { SwipeGuard } from "./SwipeGuard";

interface Props {
  onClose: () => void;
}

type ThemeLabelKey = "prefs.theme_system" | "prefs.theme_dark" | "prefs.theme_light";

const THEMES: { value: ThemePreference; labelKey: ThemeLabelKey; icon: typeof Moon }[] = [
  { value: "system", labelKey: "prefs.theme_system", icon: Monitor },
  { value: "dark", labelKey: "prefs.theme_dark", icon: Moon },
  { value: "light", labelKey: "prefs.theme_light", icon: Sun },
];

/**
 * Theme and language, drawn as words.
 *
 * The three theme tiles — the app's most literal rounded-frame-plus-fill, and
 * its only `ring-2` — are gone: a choice here is a glyph-and-word Option whose
 * selection is white ink over a lit 1px `--accent` underline (§C1, owner
 * decision 1). The locale list loses its ringed box and its
 * `--surface-elevated` active row for the same reason; the endonyms wrap as a
 * field of words.
 *
 * THE SHELL IS `Panel`, NOT A HAND-ROLLED OVERLAY (C7, C8, C9, R3). This modal
 * used to draw its own scrim, its own `max-w-sm` measure, its own
 * `pl-5 pr-2 py-2 border-b` header and its own `X size={20}` — one of five
 * disagreeing copies of each. It also set its `--surface` fill through
 * `className="surface"`, whose rule uses the `background` SHORTHAND, which
 * jsdom drops: the one carve-out fill on this screen was invisible to every
 * test in the repo. `Panel` sets it as a `backgroundColor` longhand, so the
 * assertion in `tests/preferences.test.tsx` now actually sees the paint.
 *
 * The inner `max-h-64 overflow-y-auto` on the locale list is gone with it:
 * `Panel` caps its own height and scrolls its body, so the overlay has one
 * scroller instead of a scroller nested inside a scroller.
 *
 * The three `e.stopPropagation()` touch handlers this file used to declare are
 * now the shared `SwipeGuard`, the same one the freestyle picker and the
 * recipe editor use — one guard written once, outside the scrim `Panel` owns.
 */
export function PreferencesModal({ onClose }: Props) {
  const { themePreference, locale, setTheme, setLocale, t } = usePreferences();

  return (
    <SwipeGuard>
      <Panel
        title={t("prefs.title")}
        /* The app's one universal abort word, already served in 29 locales. */
        closeLabel={t("brew.cancel")}
        measure="sm"
        onClose={onClose}
        bodyClassName="p-5"
      >
        <div className="mb-6">
          <Heading>{t("prefs.theme")}</Heading>
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

        <div>
          <Heading>{t("prefs.language")}</Heading>
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
      </Panel>
    </SwipeGuard>
  );
}
