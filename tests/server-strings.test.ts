import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Connection } from "home-assistant-js-websocket";
import {
  setServerStrings,
  serverString,
  resetServerStrings,
  setVocab,
  getVocab,
  vocabFamily,
  resetVocab,
  syncServerStrings,
  syncVocab,
  type ServerVocab,
} from "../src/lib/server-strings";
import { tServer, displayNameFor, humanizeToken } from "../src/lib/i18n";

const STRINGS_STORE_KEY = "melitta_server_strings";
const VOCAB_STORE_KEY = "melitta_server_vocab";

function mockConn(responses: Array<unknown | Error>): {
  conn: Connection;
  send: ReturnType<typeof vi.fn>;
} {
  const queue = [...responses];
  const send = vi.fn(() => {
    const next = queue.shift();
    if (next instanceof Error) return Promise.reject(next);
    return Promise.resolve(next);
  });
  return { conn: { sendMessagePromise: send } as unknown as Connection, send };
}

const SERVED = {
  "status.process.READY": "Bereit",
  "status.manipulation.FILL_WATER": "Wassertank füllen",
  "values.intensity.very_mild": "Sehr mild",
  "recipes.name.espresso": "Espresso",
  "sommelier.roast.medium_dark": "Mitteldunkel",
};

function i18nResponse(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    schema_version: 1,
    locale: "de",
    resolved_locale: "de",
    strings_version: "0.93.0",
    strings: SERVED,
    ...overrides,
  };
}

const SERVED_VOCAB: ServerVocab = {
  roast: { tokens: ["light", "medium", "medium_dark", "dark"] },
  mood: { tokens: ["energizing", "relaxing", "dessert", "classic"], multi: true },
  cup_size: {
    tokens: ["espresso_cup", "cup", "mug", "tall_glass", "travel"],
    volumes_ml: { espresso_cup: [60, 90], cup: [150, 200], mug: [250, 350], tall_glass: [300, 400], travel: [350, 500] },
  },
};

function vocabResponse(overrides: Partial<Record<string, unknown>> = {}) {
  return { schema_version: 1, strings_version: "0.93.0", vocab: SERVED_VOCAB, ...overrides };
}

beforeEach(() => {
  localStorage.clear();
  resetServerStrings();
  resetVocab();
});

describe("pure registry", () => {
  it("returns undefined when nothing is loaded", () => {
    expect(serverString("status.process.READY")).toBeUndefined();
  });

  it("returns served strings after setServerStrings and undefined after reset", () => {
    setServerStrings(SERVED);
    expect(serverString("status.process.READY")).toBe("Bereit");
    resetServerStrings();
    expect(serverString("status.process.READY")).toBeUndefined();
  });

  it("keys are byte-significant — no case folding", () => {
    setServerStrings(SERVED);
    expect(serverString("status.process.ready")).toBeUndefined();
    expect(serverString("STATUS.PROCESS.READY")).toBeUndefined();
  });

  it("ignores non-string values in the map", () => {
    setServerStrings({ bad: 42 } as unknown as Record<string, string>);
    expect(serverString("bad")).toBeUndefined();
  });

  it("setServerStrings(null) clears the registry", () => {
    setServerStrings(SERVED);
    setServerStrings(null);
    expect(serverString("status.process.READY")).toBeUndefined();
  });

  it("vocab registry: set / getVocab / vocabFamily / reset", () => {
    expect(getVocab()).toBeNull();
    expect(vocabFamily("roast")).toBeNull();
    setVocab(SERVED_VOCAB);
    expect(getVocab()).toBe(SERVED_VOCAB);
    expect(vocabFamily("roast")?.tokens).toEqual(["light", "medium", "medium_dark", "dark"]);
    expect(vocabFamily("mood")?.multi).toBe(true);
    expect(vocabFamily("unknown_family")).toBeNull();
    resetVocab();
    expect(getVocab()).toBeNull();
  });
});

describe("preference order: server string → client bundle → humanized token", () => {
  it("server string wins when present", () => {
    setServerStrings(SERVED);
    expect(tServer("en", "values.intensity.very_mild", "process.very_mild")).toBe("Sehr mild");
    expect(displayNameFor("en", "intensity", "very_mild")).toBe("Sehr mild");
  });

  it("falls back to the client bundle when the server key is missing", () => {
    setServerStrings(SERVED);
    // 'strong' was not served — the en bundle has process.strong = "Strong".
    expect(displayNameFor("en", "intensity", "strong")).toBe("Strong");
  });

  it("uses the locale bundle before the en bundle", () => {
    // No server strings at all.
    expect(displayNameFor("ru", "intensity", "very_mild")).not.toBe("Very Mild");
    expect(displayNameFor("en", "intensity", "very_mild")).toBe("Very Mild");
  });

  it("humanizes the raw token when neither server nor bundle has it", () => {
    expect(tServer("en", "status.manipulation.FILL_WATER")).toBe("Fill water");
    expect(displayNameFor("en", "blend", "hopper_2_only")).toBe("Hopper 2 only");
  });

  it("falls through per key, not per fetch", () => {
    setServerStrings({ "values.intensity.very_mild": "Sehr mild" });
    expect(displayNameFor("en", "intensity", "very_mild")).toBe("Sehr mild"); // served
    expect(displayNameFor("en", "intensity", "strong")).toBe("Strong"); // bundle
    expect(displayNameFor("en", "blend", "hopper_2_only")).toBe("Hopper 2 only"); // humanized
  });

  it("humanizeToken handles both token casings", () => {
    expect(humanizeToken("FILL_WATER")).toBe("Fill water");
    expect(humanizeToken("very_mild")).toBe("Very mild");
    expect(humanizeToken("ready")).toBe("Ready");
  });
});

describe("syncServerStrings (i18n/get fetch + §6.3.2 caching)", () => {
  it("sends melitta_barista/i18n/get with the locale (key 'locale', no domains filter = all domains)", async () => {
    const { conn, send } = mockConn([i18nResponse()]);
    await syncServerStrings(conn, "de");
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({ type: "melitta_barista/i18n/get", locale: "de" });
  });

  it("stores the served map verbatim — the en overlay is server-side, no client merge", async () => {
    const { conn } = mockConn([i18nResponse()]);
    const result = await syncServerStrings(conn, "de");
    expect(result).toEqual(SERVED);
    // A key absent from the served map stays absent (no client-side en overlay)…
    expect(serverString("values.intensity.strong")).toBeUndefined();
    // …and resolution falls through to the bundle tier instead.
    expect(displayNameFor("en", "intensity", "strong")).toBe("Strong");
  });

  it("applies the fetched strings to the registry and persists locale + strings_version", async () => {
    const { conn } = mockConn([i18nResponse()]);
    await syncServerStrings(conn, "de");
    expect(serverString("status.process.READY")).toBe("Bereit");
    const persisted = JSON.parse(localStorage.getItem(STRINGS_STORE_KEY)!);
    expect(persisted.locale).toBe("de");
    expect(persisted.strings_version).toBe("0.93.0");
    expect(persisted.strings).toEqual(SERVED);
  });

  it("revalidation short-circuit: contract strings_version matches persisted entry → no WS fetch", async () => {
    localStorage.setItem(
      STRINGS_STORE_KEY,
      JSON.stringify({ locale: "de", strings_version: "0.93.0", strings: SERVED }),
    );
    const { conn, send } = mockConn([]);
    const result = await syncServerStrings(conn, "de", "0.93.0");
    expect(send).not.toHaveBeenCalled();
    expect(result).toEqual(SERVED);
    expect(serverString("status.process.READY")).toBe("Bereit");
  });

  it("contract strings_version differs from persisted → refetch and replace", async () => {
    localStorage.setItem(
      STRINGS_STORE_KEY,
      JSON.stringify({ locale: "de", strings_version: "0.92.0", strings: { old: "Old" } }),
    );
    const { conn, send } = mockConn([i18nResponse()]);
    await syncServerStrings(conn, "de", "0.93.0");
    expect(send).toHaveBeenCalledTimes(1);
    expect(serverString("status.process.READY")).toBe("Bereit");
    const persisted = JSON.parse(localStorage.getItem(STRINGS_STORE_KEY)!);
    expect(persisted.strings_version).toBe("0.93.0");
  });

  it("no contract available → persisted entry is revalidated by one i18n/get", async () => {
    localStorage.setItem(
      STRINGS_STORE_KEY,
      JSON.stringify({ locale: "de", strings_version: "0.93.0", strings: SERVED }),
    );
    const { conn, send } = mockConn([i18nResponse()]);
    await syncServerStrings(conn, "de");
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("refetch returning the cached strings_version → the cached strings stand", async () => {
    const cachedStrings = { "status.process.READY": "Cached ready" };
    localStorage.setItem(
      STRINGS_STORE_KEY,
      JSON.stringify({ locale: "de", strings_version: "0.93.0", strings: cachedStrings }),
    );
    const { conn } = mockConn([i18nResponse()]);
    const result = await syncServerStrings(conn, "de");
    expect(result).toEqual(cachedStrings);
    expect(serverString("status.process.READY")).toBe("Cached ready");
  });

  it("persisted entry for a different locale is not short-circuited", async () => {
    localStorage.setItem(
      STRINGS_STORE_KEY,
      JSON.stringify({ locale: "de", strings_version: "0.93.0", strings: SERVED }),
    );
    const { conn, send } = mockConn([i18nResponse({ locale: "ru", resolved_locale: "ru", strings: { "status.process.READY": "Готова" } })]);
    await syncServerStrings(conn, "ru", "0.93.0");
    expect(send).toHaveBeenCalledTimes(1);
    expect(serverString("status.process.READY")).toBe("Готова");
  });

  it("fetch failure with a persisted cache degrades to the cached strings", async () => {
    localStorage.setItem(
      STRINGS_STORE_KEY,
      JSON.stringify({ locale: "de", strings_version: "0.93.0", strings: SERVED }),
    );
    const { conn } = mockConn([new Error("unknown_command")]);
    const result = await syncServerStrings(conn, "de");
    expect(result).toEqual(SERVED);
    expect(serverString("status.process.READY")).toBe("Bereit");
  });

  it("fetch failure with no cache resolves null and leaves the registry empty (never throws)", async () => {
    const { conn } = mockConn([new Error("unknown_command")]);
    const result = await syncServerStrings(conn, "de");
    expect(result).toBeNull();
    expect(serverString("status.process.READY")).toBeUndefined();
  });

  it("null connection degrades to the persisted cache when present", async () => {
    localStorage.setItem(
      STRINGS_STORE_KEY,
      JSON.stringify({ locale: "de", strings_version: "0.93.0", strings: SERVED }),
    );
    const result = await syncServerStrings(null, "de");
    expect(result).toEqual(SERVED);
  });

  it("drops non-string values from a served map", async () => {
    const { conn } = mockConn([
      i18nResponse({ strings: { good: "Good", bad: 7, worse: null } }),
    ]);
    const result = await syncServerStrings(conn, "de");
    expect(result).toEqual({ good: "Good" });
  });
});

describe("syncVocab (vocab/get fetch + §9.2.2 caching)", () => {
  it("sends melitta_barista/vocab/get with no arguments", async () => {
    const { conn, send } = mockConn([vocabResponse()]);
    await syncVocab(conn);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({ type: "melitta_barista/vocab/get" });
  });

  it("applies the vocab to the registry and persists it under strings_version", async () => {
    const { conn } = mockConn([vocabResponse()]);
    const result = await syncVocab(conn);
    expect(result).toEqual(SERVED_VOCAB);
    expect(vocabFamily("cup_size")?.volumes_ml?.espresso_cup).toEqual([60, 90]);
    const persisted = JSON.parse(localStorage.getItem(VOCAB_STORE_KEY)!);
    expect(persisted.strings_version).toBe("0.93.0");
    expect(persisted.vocab).toEqual(SERVED_VOCAB);
  });

  it("revalidation short-circuit: contract strings_version matches persisted vocab → no WS fetch", async () => {
    localStorage.setItem(
      VOCAB_STORE_KEY,
      JSON.stringify({ strings_version: "0.93.0", vocab: SERVED_VOCAB }),
    );
    const { conn, send } = mockConn([]);
    const result = await syncVocab(conn, "0.93.0");
    expect(send).not.toHaveBeenCalled();
    expect(result).toEqual(SERVED_VOCAB);
    expect(vocabFamily("roast")?.tokens).toContain("medium_dark");
  });

  it("refetch returning the cached strings_version → the cached vocab stands", async () => {
    const cachedVocab: ServerVocab = { roast: { tokens: ["light"] } };
    localStorage.setItem(
      VOCAB_STORE_KEY,
      JSON.stringify({ strings_version: "0.93.0", vocab: cachedVocab }),
    );
    const { conn } = mockConn([vocabResponse()]);
    const result = await syncVocab(conn);
    expect(result).toEqual(cachedVocab);
  });

  it("contract strings_version differs → refetch and replace", async () => {
    localStorage.setItem(
      VOCAB_STORE_KEY,
      JSON.stringify({ strings_version: "0.92.0", vocab: { roast: { tokens: ["light"] } } }),
    );
    const { conn, send } = mockConn([vocabResponse()]);
    const result = await syncVocab(conn, "0.93.0");
    expect(send).toHaveBeenCalledTimes(1);
    expect(result).toEqual(SERVED_VOCAB);
  });

  it("drops malformed families, keeps unknown families and metadata (additive tolerance)", async () => {
    const { conn } = mockConn([
      vocabResponse({
        vocab: {
          roast: { tokens: ["light", "dark"] },
          broken: { no_tokens: true },
          also_broken: { tokens: [1, 2] },
          future_family: { tokens: ["x"], some_new_meta: "y" },
        },
      }),
    ]);
    const result = await syncVocab(conn);
    expect(Object.keys(result!).sort()).toEqual(["future_family", "roast"]);
    expect(vocabFamily("future_family")?.some_new_meta).toBe("y");
    expect(vocabFamily("broken")).toBeNull();
  });

  it("fetch failure degrades to the persisted vocab, else null (never throws)", async () => {
    const first = mockConn([new Error("unknown_command")]);
    expect(await syncVocab(first.conn)).toBeNull();
    expect(getVocab()).toBeNull();

    localStorage.setItem(
      VOCAB_STORE_KEY,
      JSON.stringify({ strings_version: "0.93.0", vocab: SERVED_VOCAB }),
    );
    const second = mockConn([new Error("boom")]);
    expect(await syncVocab(second.conn)).toEqual(SERVED_VOCAB);
  });
});
