/**
 * Zone P-F — sommelier vocabulary consumption (UI Contract §9.2).
 *
 * Pure-logic coverage of `src/lib/sommelier-vocab.ts` over the P-B vocab
 * registry: three-tier token resolution (§9.2.6.1), verbatim adoption of the
 * served cup-size list with no client-side migration (§9.2.6.4), the
 * §6.3.5.1 label chain through the §9.2.5 `sommelier.<family>.<token>`
 * keyspace, advisory `volumes_ml` hints (§9.2.6.3), and the free-form
 * suggestion model (§9.2.4/§9.2.6.5).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { setVocab, resetVocab, setServerStrings, resetServerStrings, type ServerVocab } from "../src/lib/server-strings";
import {
  FALLBACK_TOKENS,
  sommelierTokens,
  isMultiFamily,
  sommelierLabel,
  suggestionLabel,
  cupVolumesHint,
  mergeSuggestions,
} from "../src/lib/sommelier-vocab";
import { MELITTA_VOCAB, clone } from "./fixtures/contracts";

beforeEach(() => {
  resetVocab();
  resetServerStrings();
});

function loadVocab(overrides: Record<string, unknown> = {}): ServerVocab {
  const vocab = { ...clone(MELITTA_VOCAB), ...overrides } as unknown as ServerVocab;
  setVocab(vocab);
  return vocab;
}

// ---------------------------------------------------------------------------
// sommelierTokens — §9.2.6.1 three tiers
// ---------------------------------------------------------------------------

describe("sommelierTokens", () => {
  it("returns the hardcoded fallback list per family when no vocab is loaded", () => {
    expect(sommelierTokens("roast")).toEqual(["light", "medium", "medium_dark", "dark"]);
    expect(sommelierTokens("bean_type")).toEqual(["arabica", "arabica_robusta", "robusta"]);
    expect(sommelierTokens("origin")).toEqual(["single_origin", "blend"]);
    expect(sommelierTokens("mood")).toEqual(["energizing", "relaxing", "dessert", "classic"]);
    expect(sommelierTokens("occasion")).toEqual(["morning", "after_lunch", "guests", "romantic", "work"]);
    expect(sommelierTokens("temperature")).toEqual(["auto", "hot", "iced"]);
    expect(sommelierTokens("caffeine")).toEqual(["regular", "low", "decaf_evening"]);
    expect(sommelierTokens("dietary")).toEqual(["no_sugar", "lactose_free", "low_calorie", "vegan"]);
  });

  it("keeps the legacy espresso token in the cup_size fallback tier (pre-contract servers)", () => {
    expect(sommelierTokens("cup_size")).toEqual(["espresso", "cup", "mug", "tall_glass", "travel"]);
  });

  it("adopts served tokens verbatim, in served order", () => {
    loadVocab({ roast: { tokens: ["dark", "light", "espresso_roast"] } });
    expect(sommelierTokens("roast")).toEqual(["dark", "light", "espresso_roast"]);
  });

  it("adopts the served cup_size list with no client-side migration (§9.2.6.4)", () => {
    loadVocab();
    const tokens = sommelierTokens("cup_size");
    expect(tokens).toEqual(["espresso_cup", "cup", "mug", "tall_glass", "travel"]);
    // The server-normalized token stands; the legacy token is not re-invented.
    expect(tokens).not.toContain("espresso");
  });

  it("returns [] for an unknown family with no fallback (hide the picker, never invent)", () => {
    expect(sommelierTokens("grind")).toEqual([]);
    loadVocab();
    expect(sommelierTokens("grind")).toEqual([]);
  });

  it("serves an unknown-to-the-fallback family when the server provides one", () => {
    loadVocab({ grind: { tokens: ["fine", "coarse"] } });
    expect(sommelierTokens("grind")).toEqual(["fine", "coarse"]);
  });

  it("falls back when a served family degenerates to an empty token list", () => {
    loadVocab({ roast: { tokens: [] } });
    expect(sommelierTokens("roast")).toEqual(FALLBACK_TOKENS.roast);
  });

  it("drops non-string and empty served tokens, keeping valid ones", () => {
    loadVocab({ roast: { tokens: ["light", "", 42, null, "dark"] } });
    expect(sommelierTokens("roast")).toEqual(["light", "dark"]);
  });

  it("falls back when every served token is invalid", () => {
    loadVocab({ roast: { tokens: ["", 1, null] } });
    expect(sommelierTokens("roast")).toEqual(FALLBACK_TOKENS.roast);
  });

  it("returns a fresh array for fallback lists (callers may not mutate the source)", () => {
    const a = sommelierTokens("roast");
    a.push("burnt");
    expect(sommelierTokens("roast")).toEqual(["light", "medium", "medium_dark", "dark"]);
  });
});

// ---------------------------------------------------------------------------
// isMultiFamily
// ---------------------------------------------------------------------------

describe("isMultiFamily", () => {
  it("reflects the served multi flag", () => {
    loadVocab();
    expect(isMultiFamily("mood")).toBe(true);
    expect(isMultiFamily("dietary")).toBe(true);
    expect(isMultiFamily("occasion")).toBe(false);
  });

  it("is false when no vocab is loaded or the family is unknown", () => {
    expect(isMultiFamily("mood")).toBe(false);
    loadVocab();
    expect(isMultiFamily("grind")).toBe(false);
  });

  it("requires multi to be exactly true", () => {
    loadVocab({ mood: { tokens: ["classic"], multi: "yes" } });
    expect(isMultiFamily("mood")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// sommelierLabel — §6.3.5.1 chain through the §9.2.5 keyspace
// ---------------------------------------------------------------------------

describe("sommelierLabel", () => {
  it("prefers the served sommelier.<family>.<token> string", () => {
    setServerStrings({ "sommelier.roast.medium_dark": "Mitteldunkel" });
    expect(sommelierLabel("de", "roast", "medium_dark")).toBe("Mitteldunkel");
  });

  it("falls back to the legacy bundle entry per family prefix", () => {
    expect(sommelierLabel("en", "roast", "medium_dark")).toBe("Medium-dark");
    expect(sommelierLabel("en", "bean_type", "arabica")).toBe("Arabica");
    expect(sommelierLabel("ru", "roast", "medium_dark")).toBe("Средне-тёмная");
    expect(sommelierLabel("en", "dietary", "no_sugar")).toBe("No sugar");
    expect(sommelierLabel("en", "caffeine", "low")).toBe("Low");
    expect(sommelierLabel("en", "temperature", "iced")).toBe("Iced");
    expect(sommelierLabel("en", "mood", "dessert")).toBe("Dessert");
  });

  it("maps the served espresso_cup token onto the legacy cup_espresso bundle entry", () => {
    expect(sommelierLabel("en", "cup_size", "espresso_cup")).toBe("Espresso cup");
    expect(sommelierLabel("ru", "cup_size", "espresso_cup")).toBe("Чашка эспрессо");
  });

  it("maps single_origin onto the legacy origin_single bundle entry", () => {
    expect(sommelierLabel("en", "origin", "single_origin")).toBe("Single origin");
  });

  it("humanizes tokens with neither server string nor bundle entry", () => {
    expect(sommelierLabel("en", "roast", "espresso_roast")).toBe("Espresso roast");
    expect(sommelierLabel("en", "grind", "very_fine")).toBe("Very fine");
  });

  it("looks up server keys byte-equal — never case-folded", () => {
    setServerStrings({ "sommelier.roast.medium": "Serviert" });
    expect(sommelierLabel("en", "roast", "MEDIUM")).not.toBe("Serviert");
  });
});

// ---------------------------------------------------------------------------
// cupVolumesHint — §9.2.6.3 advisory display data
// ---------------------------------------------------------------------------

describe("cupVolumesHint", () => {
  it("formats the served range for a known token", () => {
    loadVocab();
    expect(cupVolumesHint("cup")).toBe("150–200 ml");
    expect(cupVolumesHint("espresso_cup")).toBe("60–90 ml");
  });

  it("returns null when no vocab or no volumes_ml metadata is served", () => {
    expect(cupVolumesHint("cup")).toBeNull();
    loadVocab({ cup_size: { tokens: ["cup"] } });
    expect(cupVolumesHint("cup")).toBeNull();
  });

  it("returns null for tokens without a range", () => {
    loadVocab();
    expect(cupVolumesHint("espresso")).toBeNull();
  });

  it("tolerates malformed volume entries", () => {
    loadVocab({
      cup_size: {
        tokens: ["cup", "mug", "travel"],
        volumes_ml: { cup: [150], mug: "big", travel: ["a", "b"] },
      },
    });
    expect(cupVolumesHint("cup")).toBeNull();
    expect(cupVolumesHint("mug")).toBeNull();
    expect(cupVolumesHint("travel")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// suggestionLabel — §9.2.4 free-form families
// ---------------------------------------------------------------------------

describe("suggestionLabel", () => {
  it("labels known suggestion tokens from the bundle", () => {
    expect(suggestionLabel("en", "milk_", "oat")).toBe("Oat");
    expect(suggestionLabel("ru", "milk_", "oat")).toBe("Овсяное");
    expect(suggestionLabel("en", "note_", "citrus")).toBe("Citrus");
  });

  it("renders user free text verbatim — never humanized", () => {
    expect(suggestionLabel("en", "milk_", "Ультрапастеризованное 3%")).toBe("Ультрапастеризованное 3%");
    expect(suggestionLabel("en", "note_", "burnt_toast")).toBe("burnt_toast");
  });

  it("prefers the served label for the five §6.3.7 suggestion families", () => {
    setServerStrings({
      "sommelier.milk.oat": "Hafermilch",
      "sommelier.syrup.vanilla": "Vanille",
      "sommelier.topping.whipped_cream": "Schlagsahne",
      "sommelier.liqueur.amaretto": "Amaretto-Likör",
      "sommelier.note.citrus": "Zitrus",
    });
    expect(suggestionLabel("en", "milk_", "oat")).toBe("Hafermilch");
    expect(suggestionLabel("en", "syrup_", "vanilla")).toBe("Vanille");
    expect(suggestionLabel("en", "topping_", "whipped_cream")).toBe("Schlagsahne");
    expect(suggestionLabel("en", "liqueur_", "amaretto")).toBe("Amaretto-Likör");
    expect(suggestionLabel("en", "note_", "citrus")).toBe("Zitrus");
  });

  it("falls back to the bundle per key — an unserved token is unaffected", () => {
    setServerStrings({ "sommelier.milk.oat": "Hafermilch" });
    expect(suggestionLabel("en", "milk_", "oat")).toBe("Hafermilch");
    expect(suggestionLabel("en", "milk_", "soy")).toBe("Soy");
    expect(suggestionLabel("ru", "milk_", "soy")).toBe("Соевое");
  });

  it("keeps user text verbatim while served labels are loaded (§9.2.4 stays open)", () => {
    setServerStrings({
      "sommelier.milk.oat": "Hafermilch",
      "sommelier.note.citrus": "Zitrus",
    });
    expect(suggestionLabel("en", "milk_", "Ультрапастеризованное 3%")).toBe("Ультрапастеризованное 3%");
    expect(suggestionLabel("en", "note_", "burnt toast")).toBe("burnt toast");
    // Keys are byte-significant — a case-folded token is not a served token.
    expect(suggestionLabel("en", "milk_", "Oat")).toBe("Oat");
  });

  it("ignores served keys for prefixes outside the five families", () => {
    setServerStrings({ "sommelier.extra.foam": "Schaum" });
    expect(suggestionLabel("en", "extra_", "foam")).toBe("foam");
  });
});

// ---------------------------------------------------------------------------
// mergeSuggestions
// ---------------------------------------------------------------------------

describe("mergeSuggestions", () => {
  it("keeps suggestion order and appends custom selected values", () => {
    expect(mergeSuggestions(["whole", "oat"], ["oat", "camel milk"]))
      .toEqual(["whole", "oat", "camel milk"]);
  });

  it("deduplicates and handles empty inputs", () => {
    expect(mergeSuggestions([], ["a", "a"])).toEqual(["a"]);
    expect(mergeSuggestions(["a"], [])).toEqual(["a"]);
  });
});
