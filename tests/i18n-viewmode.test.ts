import { describe, it, expect } from "vitest";
import en from "../src/locales/en.json";
import ru from "../src/locales/ru.json";
import de from "../src/locales/de.json";

const VIEW_MODE_KEYS = ["brew.view_grid", "brew.view_list", "brew.view_carousel"];

// Every shipped bundle, not just the three we hand-edit most. The narrower
// en/ru/de check used to pass while 26 locales silently lacked a key, so the
// gap only surfaced in the UI of a language nobody was testing in.
const BUNDLES = import.meta.glob<Record<string, string>>("../src/locales/*.json", {
  eager: true,
  import: "default",
});

function localeName(path: string): string {
  return path.split("/").pop()!.replace(".json", "");
}

describe("i18n view mode keys", () => {
  it("en.json has all view mode keys", () => {
    for (const key of VIEW_MODE_KEYS) {
      expect(en).toHaveProperty(key);
      expect((en as Record<string, string>)[key]).toBeTruthy();
    }
  });

  it("ru.json has all view mode keys", () => {
    for (const key of VIEW_MODE_KEYS) {
      expect(ru).toHaveProperty(key);
      expect((ru as Record<string, string>)[key]).toBeTruthy();
    }
  });

  it("de.json has all view mode keys", () => {
    for (const key of VIEW_MODE_KEYS) {
      expect(de).toHaveProperty(key);
      expect((de as Record<string, string>)[key]).toBeTruthy();
    }
  });
});

// Keys a bundle must carry itself: the sommelier detail surface reads them
// while the panel is offline, so an en fallback there would show English to
// someone who has never seen the app in English.
const REQUIRED_EVERYWHERE = [
  "sommelier.details",
  "sommelier.reasoning",
  "sommelier.steps",
];

// Everything a person can read before the integration can talk to them: the
// sign-in form, the "screen too small" gate, the version-mismatch screens.
// There is no server to serve these strings from at that point, so a gap here
// is English on the very first screen someone sees.
const PRE_CONNECTION_KEYS = [
  "app.disconnect",
  "app.looking",
  "app.integration_hint",
  "app.resolution_title",
  "app.resolution_desc",
  "app.resolution_min",
  "app.resolution_current",
  "connect.subtitle",
  "connect.url_label",
  "connect.token_label",
  "connect.button",
  "connect.connecting",
  "connect.hint",
  "connect.error",
  "connect.security",
  "contract.update_integration_title",
  "contract.update_integration_desc",
  "contract.update_app_title",
  "contract.update_app_desc",
];

describe("i18n bundle parity", () => {
  it("ships all 29 locales", () => {
    expect(Object.keys(BUNDLES)).toHaveLength(29);
  });

  // Bundles are deliberately sparse outside en: `t()` overlays en for any key
  // a locale lacks, so a translation gap degrades to English rather than to a
  // raw key. What must never happen is the reverse — a key that exists ONLY
  // in a translation, which means it was renamed or dropped in en and that
  // locale now carries dead weight nobody can reach.
  it("no locale carries a key en does not have", () => {
    const enKeys = new Set(Object.keys(en));
    for (const [path, bundle] of Object.entries(BUNDLES)) {
      const orphans = Object.keys(bundle).filter((k) => !enKeys.has(k));
      expect(orphans, localeName(path)).toEqual([]);
    }
  });

  it("every locale carries the whole pre-connection surface", () => {
    for (const [path, bundle] of Object.entries(BUNDLES)) {
      for (const key of PRE_CONNECTION_KEYS) {
        expect(bundle[key], `${localeName(path)}.${key}`).toBeTruthy();
      }
    }
  });

  it("every locale carries the offline-critical keys", () => {
    for (const [path, bundle] of Object.entries(BUNDLES)) {
      for (const key of REQUIRED_EVERYWHERE) {
        expect(bundle[key], `${localeName(path)}.${key}`).toBeTruthy();
      }
    }
  });

  it("no locale has empty or whitespace-only values", () => {
    for (const [path, bundle] of Object.entries(BUNDLES)) {
      for (const [key, value] of Object.entries(bundle)) {
        expect(String(value).trim(), `${localeName(path)}.${key}`).not.toBe("");
      }
    }
  });
});

/* ══════════════════════════════════════════════════════════════════════
   §7.5 — SENTENCE CASE (C33)
   ══════════════════════════════════════════════════════════════════════
   The sweep that fixed `settings.*` left the rows drawn beside them in Title
   Case, so one 80px list read "Energy saving" over "Easy Clean". These two
   tests are what stops the next key from arriving Title-Cased: the rule is not
   a preference an author has to remember, it is a bundle-wide invariant.
*/

/**
 * Words that keep their capital wherever they land: product and platform
 * names, and the acronyms the app cannot spell out.
 */
const PROPER_NOUNS = new Set([
  "Melitta",
  "Barista",
  "Home",
  "Assistant",
  "Sommelier", // the product name "AI Sommelier"
  "Settings", // names a tab of the HA panel, as the user reads it there
  "Bluetooth",
  "AI",
  "HA",
  "URL",
  "LLM",
  "OK",
]);

/**
 * The DirectKey labels are exempt as a group. They are not sentence-case
 * failures: the machine itself reports these drinks as "Milk Froth" and
 * "Hot Water" (src/lib/entities.ts maps exactly those strings, CoffeeIcon
 * keys its artwork on them), so a sentence-cased category label would put two
 * spellings of one drink on one screen — the list view showing the machine's
 * name beside the category's.
 */
const DRINK_NAME_KEYS = /^brew\.dk_/;

/** Splits on sentence ends, so a capital that legitimately OPENS a sentence
 *  is never read as Title Case. `:` and `→` end a clause the same way here —
 *  the connect hint's "HA → Profile → …" is a menu path, not a sentence — and
 *  so does `+`, which joins two whole labels ("Arabica + Robusta"): the second
 *  is a label in its own right and opens with its own capital. */
function interiorWords(value: string): string[] {
  return value
    .split(/(?<=[.!?:→+])\s+/)
    .flatMap((sentence) => sentence.split(/\s+/).slice(1))
    .map((word) => word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""))
    .filter(Boolean);
}

describe("§7.5 sentence case", () => {
  it("en.json Title-Cases nothing but a proper noun", () => {
    const offenders: string[] = [];
    for (const [key, value] of Object.entries(en as Record<string, string>)) {
      if (DRINK_NAME_KEYS.test(key)) continue;
      for (const word of interiorWords(value)) {
        // A capital mid-sentence is Title Case unless the word is a name.
        if (/^\p{Lu}\p{Ll}+$/u.test(word) && !PROPER_NOUNS.has(word)) {
          offenders.push(`${key}: "${value}" (${word})`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  // §7.5 permits exactly one all-caps string in the app — a 3-letter language
  // code, which no bundle carries. `brew.two_cups_on` was "2x ON" (R4); this
  // is what keeps it from coming back in any of the 29 bundles.
  it("no bundle shouts", () => {
    // Acronyms are not shouting. `KI` is German for AI; `ОК` is the Cyrillic
    // spelling of the same two letters.
    const ACRONYMS = new Set([...PROPER_NOUNS, "KI", "ОК"]);
    const offenders: string[] = [];
    for (const [path, bundle] of Object.entries(BUNDLES)) {
      for (const [key, value] of Object.entries(bundle)) {
        for (const word of String(value).split(/[\s/–—-]+/)) {
          const core = word.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "");
          if (core.length > 1 && /^\p{Lu}+$/u.test(core) && !ACRONYMS.has(core)) {
            offenders.push(`${localeName(path)}.${key}: "${value}"`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
