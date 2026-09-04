/**
 * Sommelier vocabulary consumption (UI Contract §9.2, Zone P-F).
 *
 * Pure resolution logic over the vocab registry in `server-strings.ts`:
 * per §9.2.6.1 each picker family resolves three-tier — served
 * `vocab.<family>.tokens` → the client's hardcoded option list → hide the
 * picker (never invent tokens). Served lists are adopted **verbatim**: there
 * is no client-side cup-size migration (§9.2.6.4 — the server normalizes the
 * legacy `espresso` token on ingest and in a one-time DB migration; the
 * legacy token therefore survives only in the fallback tier, exactly where a
 * pre-contract server still expects it).
 *
 * Labels follow §6.3.5.1 through the §9.2.5 keyspace:
 * `sommelier.<family>.<token>` server string → legacy bundle key (the
 * pre-contract `sommelier.<prefix><token>` en/ru/de entries) → humanized
 * token. Free-form families (milk, flavor notes, extras items — §9.2.4) are
 * never vocab: their lists are client-local *suggestions* over free-form
 * input, labelled server-first over the §6.3.7 `sommelier.<family>.<token>`
 * keys with the user's own text rendered verbatim.
 */
import { serverString, vocabFamily } from "./server-strings";
import { tServer, bundleString, type Locale } from "./i18n";

// ---------------------------------------------------------------------------
// Tier-2 fallbacks — the PWA's pre-contract hardcoded option lists, verbatim
// ---------------------------------------------------------------------------

/**
 * The pre-contract hardcoded token list per family (tier 2 of §9.2.6.1).
 * `cup_size` deliberately keeps the legacy `espresso` token: against a
 * pre-contract server that is the stored/accepted value, and against a 0.93+
 * server the served list replaces this tier entirely.
 */
export const FALLBACK_TOKENS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  roast: ["light", "medium", "medium_dark", "dark"],
  bean_type: ["arabica", "arabica_robusta", "robusta"],
  origin: ["single_origin", "blend"],
  mood: ["energizing", "relaxing", "dessert", "classic"],
  occasion: ["morning", "after_lunch", "guests", "romantic", "work"],
  cup_size: ["espresso", "cup", "mug", "tall_glass", "travel"],
  temperature: ["auto", "hot", "iced"],
  caffeine: ["regular", "low", "decaf_evening"],
  dietary: ["no_sugar", "lactose_free", "low_calorie", "vegan"],
});

// ---------------------------------------------------------------------------
// Token resolution
// ---------------------------------------------------------------------------

/**
 * Resolve the picker token list for a vocab family (§9.2.6.1 three tiers).
 *
 * Served tokens are adopted verbatim in served order; entries that are not
 * non-empty strings are dropped, and a family whose served list degenerates
 * to nothing falls through to the hardcoded fallback. A family with neither
 * a served list nor a fallback resolves to `[]` — the caller hides the
 * picker rather than inventing tokens.
 */
export function sommelierTokens(family: string): string[] {
  const served = vocabFamily(family);
  if (served) {
    const tokens = served.tokens.filter((t) => typeof t === "string" && t.length > 0);
    if (tokens.length > 0) return tokens;
  }
  return [...(FALLBACK_TOKENS[family] ?? [])];
}

/** True when the served family is flagged multi-select (`multi: true`); false unserved. */
export function isMultiFamily(family: string): boolean {
  return vocabFamily(family)?.multi === true;
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

/** Legacy bundle-key prefix per family (the pre-contract `sommelier.*` keys). */
const BUNDLE_PREFIX: Readonly<Record<string, string>> = Object.freeze({
  roast: "roast_",
  bean_type: "type_",
  origin: "origin_",
  mood: "mood_",
  occasion: "occasion_",
  cup_size: "cup_",
  temperature: "temp_",
  caffeine: "caffeine_",
  dietary: "diet_",
});

/**
 * Server tokens whose legacy bundle entry lives under a different suffix:
 * the bundles predate the vocab keyspace (`cup_espresso` labels the served
 * `espresso_cup`; `origin_single` labels `single_origin`).
 */
const BUNDLE_TOKEN_ALIAS: Readonly<Record<string, Readonly<Record<string, string>>>> =
  Object.freeze({
    cup_size: Object.freeze({ espresso_cup: "espresso" }),
    origin: Object.freeze({ single_origin: "single" }),
  });

/**
 * Display label for one vocab token: §6.3.5.1 chain through the §9.2.5
 * keyspace — server `sommelier.<family>.<token>` (byte-equal key, never
 * case-folded) → legacy bundle entry → humanized token.
 */
export function sommelierLabel(locale: Locale, family: string, token: string): string {
  const prefix = BUNDLE_PREFIX[family] ?? `${family}_`;
  const bundleToken = BUNDLE_TOKEN_ALIAS[family]?.[token] ?? token;
  return tServer(locale, `sommelier.${family}.${token}`, `sommelier.${prefix}${bundleToken}`);
}

/**
 * Legacy bundle prefix → the §6.3.7 served family for the five
 * suggestion-value keyspaces (`sommelier.milk.<token>` & co).
 */
const SUGGESTION_FAMILY: Readonly<Record<string, string>> = Object.freeze({
  milk_: "milk",
  syrup_: "syrup",
  topping_: "topping",
  liqueur_: "liqueur",
  note_: "note",
});

/**
 * Label for a client-local suggestion value over a free-form field (§9.2.4:
 * milk, flavor notes, extras items — never vocab).
 *
 * Known suggestion tokens resolve server-first (§6.3.7 `sommelier.<family>.<token>`,
 * byte-equal key, never case-folded) and then through their bundle entry.
 * Anything else is the user's own text: no served key, no bundle key, so it
 * renders verbatim (never humanized — "Ультрапастеризованное 3%" stays as
 * typed). A served label is display sugar over an open field and never
 * narrows what the field accepts.
 */
export function suggestionLabel(locale: Locale, bundlePrefix: string, value: string): string {
  const family = SUGGESTION_FAMILY[bundlePrefix];
  if (family !== undefined) {
    const served = serverString(`sommelier.${family}.${value}`);
    if (served !== undefined) return served;
  }
  return bundleString(locale, `sommelier.${bundlePrefix}${value}`) ?? value;
}

// ---------------------------------------------------------------------------
// Cup-size volume hints (§9.2.6.3 — advisory display data only)
// ---------------------------------------------------------------------------

/**
 * Advisory volume hint for a cup-size token, e.g. "150–200 ml", from the
 * served `cup_size.volumes_ml` metadata. `null` when unserved or malformed —
 * the server re-validates `cup_type` regardless, so this is display-only.
 */
export function cupVolumesHint(token: string): string | null {
  const volumes = vocabFamily("cup_size")?.volumes_ml;
  if (volumes === null || typeof volumes !== "object") return null;
  const range = (volumes as Record<string, unknown>)[token];
  if (!Array.isArray(range) || range.length < 2) return null;
  const [lo, hi] = range;
  if (typeof lo !== "number" || typeof hi !== "number") return null;
  return `${lo}–${hi} ml`;
}

// ---------------------------------------------------------------------------
// Suggestion merging (free-form fields)
// ---------------------------------------------------------------------------

/**
 * Chip list for a free-form field: the local suggestions first (their order
 * preserved), then any selected values outside them (user-entered free text),
 * deduplicated — so a stored custom value always has a visible, toggleable
 * chip.
 */
export function mergeSuggestions(
  suggestions: readonly string[],
  selected: readonly string[],
): string[] {
  const out = [...suggestions];
  for (const value of selected) {
    if (!out.includes(value)) out.push(value);
  }
  return out;
}
