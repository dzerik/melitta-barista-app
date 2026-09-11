import { describe, it, expect } from "vitest";
import en from "../src/locales/en.json";

/* ══════════════════════════════════════════════════════════════════════
   BUNDLE PARITY — what this file exists to stop
   ══════════════════════════════════════════════════════════════════════
   26 of the 28 translated bundles were ~150 keys short of en, and nothing
   failed. Only de and ru were complete. The gap was invisible because `t()`
   overlays en for any key a locale lacks, so a missing key renders as English
   rather than as a broken key — the one failure mode no test and no reviewer
   can see, and the one a user reports as "it shows English".

   The old parity test here checked three keys in three bundles and blessed
   sparseness in a comment. Sparseness is not safe: ~47 of the missing keys
   were app chrome for which the bundle is the ONLY source (tab.*, freestyle.*,
   stats.*, prefs.*, the maintenance and status chrome — read through
   usePreferences().t, which never consults the server). The rest were
   server-served families mirrored as tier 2, and that tier is live too: the
   version gate (useUiContract.ts) admits 0.91.x–0.93.x integrations that serve
   none of these families, and an offline locale switch drops server strings
   entirely (server-strings.ts). Either way the bundle is what the user reads.

   So: every bundle carries every en key, and a bundle that repeats the English
   string must say why. Both rules take explicit, justified exemptions — never
   a loosened assertion.
*/

const BUNDLES = import.meta.glob<Record<string, string>>("../src/locales/*.json", {
  eager: true,
  import: "default",
});

function localeName(path: string): string {
  return path.split("/").pop()!.replace(".json", "");
}

const EN = en as Record<string, string>;
const EN_KEYS = Object.keys(EN);

/** Every bundle except en, as [locale, strings] — en is the source, never a subject. */
const TRANSLATIONS: [string, Record<string, string>][] = Object.entries(BUNDLES)
  .map(([path, bundle]) => [localeName(path), bundle] as [string, Record<string, string>])
  .filter(([locale]) => locale !== "en");

/* ──────────────────────────────────────────────────────────────────────
   EXEMPTION 1 — keys en still carries but nothing can render
   ──────────────────────────────────────────────────────────────────────
   Dead en keys are not a translation debt: shipping 28 translations of a
   string no code path reaches is pure bundle weight. They are exempt from
   BOTH rules below — a locale may omit them, and a locale that already
   carries them verbatim is not thereby untranslated.

   Each entry was verified against the source, not assumed. They stay in en
   (removing them is a separate cleanup, and en is not this wave's to edit);
   the `is still in en` test below deletes the exemption's excuse the moment
   en drops one.
*/
const DEAD_EN_KEYS: Record<string, string> = {
  // STATUS_MAP (StatusOverlay.tsx) has no `brewing` entry — the brewing branch
  // went with the brew takeover, so no config ever names this key.
  "status.brewing_desc": "no STATUS_MAP entry; brewing branch was removed",
  // Named as the hasAction descKey, but the description reads
  // `view.actionLabel || t(descKey)` and actionLabel is non-empty whenever
  // hasAction: token mode gets it from tServer (which falls through to
  // humanizeToken, never ""), legacy mode from the sensor state that made
  // hasAction true in the first place. The `||` never falls through.
  "status.check_machine": "unreachable — actionLabel is always non-empty when hasAction",
  // No occurrence in src, and no `steamed` token in any values.* family.
  "process.steamed": "no reference; not a token any values.* family emits",
  // Only ever a data field NAME on the sommelier bean record, never a label.
  "sommelier.origin_country": "data field name (useSommelier.ts), not rendered copy",
  // Stale vocabulary: the live temperature tokens are auto/hot/iced
  // (sommelier-vocab.ts), which every bundle carries as sommelier.temp_*.
  "sommelier.temp_hot_only": "stale token — live set is auto/hot/iced",
  "sommelier.temp_cold_ok": "stale token — live set is auto/hot/iced",
  "sommelier.temp_prefer_cold": "stale token — live set is auto/hot/iced",
  // Referenced only by tests/preferences.test.tsx, and the value is the
  // product name, which stays Latin in every language regardless.
  "app.title": "test-only reference; value is the product name",
};

/* ──────────────────────────────────────────────────────────────────────
   EXEMPTION 2 — keys whose value is the same in every language
   ──────────────────────────────────────────────────────────────────────
   House convention: coffee proper names, brands, product and feature names
   and bare numerals stay in Latin script in the UI. A locale MAY translate or
   transliterate these (many Cyrillic and Greek bundles do), so this is a
   permission, not a claim — it is deliberately not rot-checked against
   whether any locale currently exercises it.
*/
const UNTRANSLATED_BY_CONVENTION = new Set([
  // Bare numerals and symbols.
  "brew.two_cups", // "2x"
  "process.one",
  "process.two",
  "process.three",
  // Drink proper names.
  "brew.dk_espresso",
  "brew.dk_cappuccino",
  "brew.dk_cafe_creme",
  "brew.dk_latte_macchiato",
  "prefs.family_cappuccino",
  // Liqueur brands.
  "sommelier.liqueur_amaretto",
  "sommelier.liqueur_baileys",
  "sommelier.liqueur_frangelico",
  "sommelier.liqueur_kahlua",
  // Botanical names of the coffee species.
  "sommelier.type_arabica",
  "sommelier.type_robusta",
  "sommelier.type_arabica_robusta",
  // Feature and product names, as this app names them everywhere.
  "tab.freestyle",
  "tab.sommelier",
  "prefs.family_obsidian",
]);

/* ──────────────────────────────────────────────────────────────────────
   EXEMPTION 3 — this language really does spell it the English way
   ──────────────────────────────────────────────────────────────────────
   Per key, the exact locales in which the English spelling IS the native
   word. Unlike exemption 2 these are specific claims about specific
   languages, so they ARE rot-checked: when a translator replaces one, the
   stale entry must go, or the list slowly becomes a list of lies.

   Adding a locale here is a translation decision, not a way to silence the
   test — the bar is that a native speaker would write exactly this.
*/
const COGNATES: Record<string, readonly string[]> = {
  // International loanwords that entered these languages unchanged.
  "freestyle.aroma": ["bs", "cs", "da", "de", "es", "hr", "hu", "it", "nb", "nl", "pt", "sl", "tr"],
  "sommelier.topping_marshmallow": ["bs", "cs", "de", "hr", "it", "nb", "nl", "pt", "ro", "sk", "sl", "sv", "tr"],
  "sommelier.mood_dessert": ["da", "de", "fr", "it", "nb", "nl", "sv"],
  "sommelier.diet_vegan": ["de", "et", "tr"],
  "sommelier.cup_mug": ["fr", "it"],
  // Coffee terms of art these languages use in English.
  "freestyle.shots": ["da", "de", "nb", "nl", "sv"],
  "sommelier.origin_single": ["nl", "pl", "sv"],
  // Latinate vocabulary shared with English.
  "level.normal": ["da", "de", "es", "nb", "pt", "sv", "tr"],
  "process.normal": ["da", "de", "es", "nb", "pt", "sv", "tr"],
  "process.standard": ["da", "de", "fr", "it", "nb", "ro", "sv"],
  "process.mild": ["da", "de", "nb", "nl", "sv"],
  "process.intense": ["fr"],
  "freestyle.portion": ["da", "de", "fr", "sv"],
  "app.resolution_min": ["bs", "cs", "da", "de", "fr", "hu", "nb", "nl", "pl", "sk"],
  "settings.group_system": ["da", "de", "nb", "pl", "sv"],
  "prefs.theme_system": ["da", "de", "nb", "sv"],
  "prefs.theme_mode": ["fr"],
  "sommelier.details": ["de", "nl"],
  "sommelier.error": ["es"],
  "sommelier.count": ["fr"], // "Suggestions" is the French plural, spelled the same
  "sommelier.instruction": ["fr"],
  "sommelier.occasion": ["fr"],
  "sommelier.occasion_romantic": ["ro"],
  "app.page": ["fr"], // "Page {n}"
  "maint.start": ["da", "nb"],
  "brew.offline_title": ["nl"], // "Machine offline" is ordinary Dutch
  "freestyle.component1": ["nl"],
  "freestyle.component2": ["nl"],
  "process.water": ["nl"],
  "settings.group_water": ["nl"],
  // Matches the water-hardness ladder the integration already ships in nl
  // (ui_strings/nl.json settings.water_hardness.levels.hard = "Hard").
  "level.hard": ["nl"],
  // Flavour notes that are the same word in these languages.
  "sommelier.note_citrus": ["da", "nl", "sv"],
  "sommelier.note_floral": ["es", "fr", "pt", "ro"],
  "sommelier.note_caramel": ["fr", "ro"],
  "sommelier.syrup_caramel": ["fr", "ro"],
  "prefs.family_caramel": ["fr", "ro"],
  "sommelier.note_chocolate": ["es", "pt"],
  "sommelier.syrup_chocolate": ["es", "pt"],
  // Abbreviations and acronyms.
  "sommelier.calories": ["es", "fr", "it", "pt", "ro"], // "cal", the unit
  "sommelier.temp_auto": ["da", "de", "es", "fr", "it", "nb", "pl", "ro", "sk", "sv"],
  "connect.url_label": ["de"], // "HA URL" — product acronym plus acronym
};

function identicalAllowed(locale: string, key: string): boolean {
  if (key in DEAD_EN_KEYS) return true;
  if (UNTRANSLATED_BY_CONVENTION.has(key)) return true;
  return (COGNATES[key] ?? []).includes(locale);
}

describe("i18n bundle parity (every locale, every key)", () => {
  it("ships en plus 28 translations", () => {
    expect(Object.keys(BUNDLES)).toHaveLength(29);
    expect(TRANSLATIONS).toHaveLength(28);
  });

  // THE PIN. A bundle short of en is English on screen, silently.
  it("every locale carries every key en has", () => {
    const gaps: string[] = [];
    for (const [locale, bundle] of TRANSLATIONS) {
      const missing = EN_KEYS.filter((k) => !(k in DEAD_EN_KEYS) && !(k in bundle));
      if (missing.length) gaps.push(`${locale}: ${missing.length} missing — ${missing.join(", ")}`);
    }
    expect(gaps).toEqual([]);
  });

  // THE OTHER HALF. A key can be present and still be untranslated: the
  // fill that produced this wave started from bundles full of English values
  // that every key-count check called complete.
  it("no locale ships the English string where a translation is owed", () => {
    const untranslated: string[] = [];
    for (const [locale, bundle] of TRANSLATIONS) {
      for (const key of EN_KEYS) {
        if (!(key in bundle) || bundle[key] !== EN[key]) continue;
        if (identicalAllowed(locale, key)) continue;
        untranslated.push(`${locale}.${key}: ${JSON.stringify(EN[key])}`);
      }
    }
    expect(untranslated).toEqual([]);
  });
});

describe("i18n exemptions stay honest", () => {
  // If en drops a dead key, the exemption outlives its reason and would start
  // excusing a live key that happens to reuse the name.
  it("every exempted key is still in en", () => {
    const stale = [
      ...Object.keys(DEAD_EN_KEYS),
      ...UNTRANSLATED_BY_CONVENTION,
      ...Object.keys(COGNATES),
    ].filter((k) => !(k in EN));
    expect(stale).toEqual([]);
  });

  // A cognate entry claims "this locale's word is spelled the English way".
  // Once a translator writes something else the claim is false: delete the
  // locale from the list rather than leave the allowlist describing a bundle
  // that no longer exists.
  it("no cognate claim outlives the string it describes", () => {
    const bundles = new Map(TRANSLATIONS);
    const stale: string[] = [];
    for (const [key, locales] of Object.entries(COGNATES)) {
      for (const locale of locales) {
        const bundle = bundles.get(locale);
        if (!bundle) {
          stale.push(`COGNATES[${key}] lists ${locale}, which ships no bundle`);
        } else if (bundle[key] !== EN[key]) {
          stale.push(`COGNATES[${key}] lists ${locale}, but ${locale} now says ${JSON.stringify(bundle[key])} — drop the entry`);
        }
      }
    }
    expect(stale).toEqual([]);
  });

  // Exemption 2 is a blanket permission; exemption 3 is per-locale. A key in
  // both makes the narrower list dead code and hides which rule is in force.
  it("no key claims both conventions", () => {
    const both = Object.keys(COGNATES).filter((k) => UNTRANSLATED_BY_CONVENTION.has(k));
    expect(both).toEqual([]);
  });
});
