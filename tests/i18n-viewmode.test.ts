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
