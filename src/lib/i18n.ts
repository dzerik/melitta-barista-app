import en from "../locales/en.json";
import ru from "../locales/ru.json";
import de from "../locales/de.json";
import { serverString } from "./server-strings";

export type TranslationKey = keyof typeof en;
export type Locale = "en" | "ru" | "de";

const translations: Record<Locale, Record<string, string>> = { en, ru, de };

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
