import en from "../locales/en.json";
import ru from "../locales/ru.json";
import de from "../locales/de.json";

export type TranslationKey = keyof typeof en;
export type Locale = "en" | "ru" | "de";

const translations: Record<Locale, Record<string, string>> = { en, ru, de };

export function t(locale: Locale, key: TranslationKey): string {
  return translations[locale]?.[key] || translations.en[key] || key;
}
