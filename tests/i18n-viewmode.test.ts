import { describe, it, expect } from "vitest";
import en from "../src/locales/en.json";
import ru from "../src/locales/ru.json";
import de from "../src/locales/de.json";

const VIEW_MODE_KEYS = ["brew.view_grid", "brew.view_list", "brew.view_carousel"];

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

  it("all locales have the same keys", () => {
    const enKeys = Object.keys(en).sort();
    const ruKeys = Object.keys(ru).sort();
    const deKeys = Object.keys(de).sort();
    expect(ruKeys).toEqual(enKeys);
    expect(deKeys).toEqual(enKeys);
  });

  it("no locale has empty string values", () => {
    for (const [key, value] of Object.entries(en)) {
      expect(value, `en.${key}`).not.toBe("");
    }
    for (const [key, value] of Object.entries(ru)) {
      expect(value, `ru.${key}`).not.toBe("");
    }
    for (const [key, value] of Object.entries(de)) {
      expect(value, `de.${key}`).not.toBe("");
    }
  });
});
