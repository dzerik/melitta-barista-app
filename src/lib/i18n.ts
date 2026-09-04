import bg from "../locales/bg.json";
import bs from "../locales/bs.json";
import cs from "../locales/cs.json";
import da from "../locales/da.json";
import de from "../locales/de.json";
import el from "../locales/el.json";
import en from "../locales/en.json";
import es from "../locales/es.json";
import et from "../locales/et.json";
import fi from "../locales/fi.json";
import fr from "../locales/fr.json";
import hr from "../locales/hr.json";
import hu from "../locales/hu.json";
import it from "../locales/it.json";
import lt from "../locales/lt.json";
import lv from "../locales/lv.json";
import mk from "../locales/mk.json";
import nb from "../locales/nb.json";
import nl from "../locales/nl.json";
import pl from "../locales/pl.json";
import pt from "../locales/pt.json";
import ro from "../locales/ro.json";
import ru from "../locales/ru.json";
import sk from "../locales/sk.json";
import sl from "../locales/sl.json";
import sr from "../locales/sr.json";
import sv from "../locales/sv.json";
import tr from "../locales/tr.json";
import uk from "../locales/uk.json";
import { serverString } from "./server-strings";

export type TranslationKey = keyof typeof en;
export type Locale =
  | "bg"
  | "bs"
  | "cs"
  | "da"
  | "de"
  | "el"
  | "en"
  | "es"
  | "et"
  | "fi"
  | "fr"
  | "hr"
  | "hu"
  | "it"
  | "lt"
  | "lv"
  | "mk"
  | "nb"
  | "nl"
  | "pl"
  | "pt"
  | "ro"
  | "ru"
  | "sk"
  | "sl"
  | "sr"
  | "sv"
  | "tr"
  | "uk";

const translations: Record<Locale, Record<string, string>> = {
  bg, bs, cs, da, de, el, en, es, et, fi, fr, hr, hu, it, lt, lv, mk, nb, nl, pl, pt, ro, ru, sk, sl, sr, sv, tr, uk,
};

/** Every locale the app ships, in the integration's own order. */
export const SUPPORTED_LOCALES: readonly Locale[] = Object.freeze([
  "bg", "bs", "cs", "da", "de", "el", "en", "es", "et", "fi", "fr", "hr", "hu", "it", "lt", "lv", "mk", "nb", "nl", "pl", "pt", "ro", "ru", "sk", "sl", "sr", "sv", "tr", "uk",
]);


/**
 * Language names in their own language. Endonyms need no translation and
 * carry no nationality baggage — a flag can never stand for a language.
 */
export const LOCALE_ENDONYM: Readonly<Record<Locale, string>> = Object.freeze({
  bg: "Български",
  bs: "Bosanski",
  cs: "Čeština",
  da: "Dansk",
  de: "Deutsch",
  el: "Ελληνικά",
  en: "English",
  es: "Español",
  et: "Eesti",
  fi: "Suomi",
  fr: "Français",
  hr: "Hrvatski",
  hu: "Magyar",
  it: "Italiano",
  lt: "Lietuvių",
  lv: "Latviešu",
  mk: "Македонски",
  nb: "Norsk bokmål",
  nl: "Nederlands",
  pl: "Polski",
  pt: "Português",
  ro: "Română",
  ru: "Русский",
  sk: "Slovenčina",
  sl: "Slovenščina",
  sr: "Српски",
  sv: "Svenska",
  tr: "Türkçe",
  uk: "Українська",
});

/** Bundle-only lookup (legacy path, unchanged): locale bundle → en bundle → the key itself. */
export function t(locale: Locale, key: TranslationKey): string {
  return translations[locale]?.[key] || translations.en[key] || key;
}

/** Bundle lookup by arbitrary string key; `undefined` when no bundle has it. */
export function bundleString(locale: Locale, key: string): string | undefined {
  return translations[locale]?.[key] || translations.en[key] || undefined;
}

/**
 * Last-resort token humanization (UI Contract §5.3.2): underscores to spaces,
 * sentence case. Works for both casings — `FILL_WATER` → "Fill water",
 * `very_mild` → "Very mild".
 */
export function humanizeToken(token: string): string {
  const words = token.replace(/[_\s]+/g, " ").trim().toLowerCase();
  if (!words) return token;
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * The §6.3.5.1 per-key preference order: server string → client bundle string
 * → humanized raw token.
 *
 * `serverKey` is the flat §6.3.1 key (byte-equal to contract tokens — never
 * case-folded). `bundleKey` names the legacy en/ru/de bundle entry to try
 * next; when omitted, the bundle is probed under `serverKey` itself. The
 * humanized last resort uses the key's final dot segment (the raw token).
 */
export function tServer(locale: Locale, serverKey: string, bundleKey?: string): string {
  const served = serverString(serverKey);
  if (served !== undefined) return served;
  const bundled = bundleString(locale, bundleKey ?? serverKey);
  if (bundled !== undefined) return bundled;
  const token = serverKey.split(".").pop() ?? serverKey;
  return humanizeToken(token);
}

/**
 * Family-scoped value label (§6.3.5.7): server `values.<family>.<token>` →
 * bundle `process.<token>` (the app's legacy bare-token value keys) →
 * humanized token. Family-scoped server keys exist because bare tokens
 * collide across families (`none`, `standard`).
 */
export function displayNameFor(locale: Locale, family: string, token: string): string {
  return tServer(locale, `values.${family}.${token}`, `process.${token}`);
}
