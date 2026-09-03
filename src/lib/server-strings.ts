/**
 * Server-provided UI strings (UI Contract §6.3) and sommelier vocabulary (§9.2).
 *
 * Split per §6.3.5.6 into:
 *  (a) a pure synchronous registry — `setServerStrings` / `serverString` /
 *      `resetServerStrings` (and the vocab twins) — with zero runtime HA
 *      imports; this is all that label/format modules may import, keeping
 *      label functions synchronous and test isolation intact;
 *  (b) a hass-coupled fetch/cache half — `syncServerStrings` / `syncVocab` —
 *      called only from top-level wiring, which feeds (a).
 *
 * Caching (§6.3.2 / §9.2.2): `strings_version` is the storage key, never the
 * trigger. A persisted `locale + strings_version` entry is revalidated against
 * the `strings_version` carried in the current session's contract document
 * (free — it rides the contract fetch) or, when none is available, by one
 * `i18n/get` / `vocab/get` per session. If a refetch returns the cached
 * `strings_version`, the cached data stands.
 *
 * The en-overlay is server-side (§6.3.3 merge-en-first): the client stores the
 * served map verbatim and never merges locales itself. Missing keys fall
 * through the §6.3.5.1 preference order per key (server string → client
 * bundle → humanized token), implemented in `i18n.ts` on top of this registry.
 *
 * Every failure degrades only display strings / picker vocabularies — never
 * token semantics (§6.3.2) — so nothing here ever throws to the caller.
 */
import type { Connection } from "home-assistant-js-websocket";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** One served vocabulary family (§9.2.2) — an open object; unknown metadata keys are preserved. */
export interface VocabFamily {
  tokens: string[];
  multi?: boolean;
  volumes_ml?: Record<string, number[]>;
  [extra: string]: unknown;
}

/** The served vocabulary: family name → family object (§9.2.2). */
export type ServerVocab = Record<string, VocabFamily>;

interface StringsCacheEntry {
  locale: string;
  resolved_locale?: string;
  strings_version: string;
  strings: Record<string, string>;
}

interface VocabCacheEntry {
  strings_version: string;
  vocab: ServerVocab;
}

interface I18nGetResponse {
  schema_version?: number;
  locale?: string;
  resolved_locale?: string;
  strings_version?: string;
  strings?: Record<string, unknown>;
}

interface VocabGetResponse {
  schema_version?: number;
  strings_version?: string;
  vocab?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// (a) Pure synchronous registry — zero HA imports at runtime
// ---------------------------------------------------------------------------

let currentStrings: Record<string, string> | null = null;
let currentVocab: ServerVocab | null = null;

/** Replace the active server-string map (`null` clears it). */
export function setServerStrings(map: Record<string, string> | null): void {
  currentStrings = map;
}

/**
 * Look up one served string by its flat dot-joined key (§6.3.1).
 *
 * Keys are byte-equal to contract tokens — never case-fold. Returns
 * `undefined` when no server strings are loaded or the key is absent, so
 * callers fall through the §6.3.5.1 preference order per key.
 */
export function serverString(key: string): string | undefined {
  const value = currentStrings?.[key];
  return typeof value === "string" ? value : undefined;
}

/** Clear the in-memory server-string registry (test/reset hook). */
export function resetServerStrings(): void {
  currentStrings = null;
}

/** Replace the active sommelier vocabulary (`null` clears it). */
export function setVocab(vocab: ServerVocab | null): void {
  currentVocab = vocab;
}

/** The full active vocabulary, or `null` when none is loaded. */
export function getVocab(): ServerVocab | null {
  return currentVocab;
}

/**
 * One vocabulary family, or `null` when unserved (§9.2.6.1: the client then
 * falls back to its hardcoded option list, and hides the picker if it has
 * none — it never invents tokens).
 */
export function vocabFamily(family: string): VocabFamily | null {
  return currentVocab?.[family] ?? null;
}

/** Clear the in-memory vocabulary registry (test/reset hook). */
export function resetVocab(): void {
  currentVocab = null;
}

// ---------------------------------------------------------------------------
// (b) Fetch/cache half — called only from top-level wiring
// ---------------------------------------------------------------------------

const STRINGS_STORE_KEY = "melitta_server_strings";
const VOCAB_STORE_KEY = "melitta_server_vocab";

function readStore<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeStore(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable/full — session-only operation is fine.
  }
}

function sanitizeStrings(raw: Record<string, unknown> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (raw && typeof raw === "object") {
    for (const [key, value] of Object.entries(raw)) {
      if (typeof value === "string") out[key] = value;
    }
  }
  return out;
}

/** Keep only well-formed families (a `tokens` string array), preserving additive metadata (§9.2.2). */
function sanitizeVocab(raw: Record<string, unknown> | undefined): ServerVocab {
  const out: ServerVocab = {};
  if (raw && typeof raw === "object") {
    for (const [family, value] of Object.entries(raw)) {
      if (
        value !== null &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        Array.isArray((value as VocabFamily).tokens) &&
        (value as VocabFamily).tokens.every((t) => typeof t === "string")
      ) {
        out[family] = value as VocabFamily;
      }
    }
  }
  return out;
}

/**
 * Load server strings for `locale` into the registry, per §6.3.2.
 *
 * `contractStringsVersion` is the `strings_version` from the current
 * session's contract document, when one is available: a persisted entry for
 * the same locale matching it is revalidated for free — no WS round-trip.
 * Otherwise one `melitta_barista/i18n/get` runs (omitting `domains` = all
 * domains, the six 0.93 keyspaces included); a durable `unknown_command`
 * (pre-0.92 server) or transient failure degrades to the persisted cache if
 * any, else to `null` — display strings only, never token semantics.
 *
 * Returns the map now active in the registry (`null` when none).
 */
export async function syncServerStrings(
  conn: Connection | null,
  locale: string,
  contractStringsVersion?: string | null,
): Promise<Record<string, string> | null> {
  const cached = readStore<StringsCacheEntry>(STRINGS_STORE_KEY);
  const cacheUsable =
    cached !== null &&
    cached.locale === locale &&
    typeof cached.strings_version === "string" &&
    cached.strings !== null &&
    typeof cached.strings === "object";

  // Revalidation short-circuit: the contract fetch already told us the
  // server's strings_version; a matching persisted entry stands (§6.3.2).
  if (cacheUsable && contractStringsVersion != null && cached.strings_version === contractStringsVersion) {
    setServerStrings(cached.strings);
    return cached.strings;
  }

  if (conn === null) {
    // No session to revalidate against — degrade to last-known (display only).
    setServerStrings(cacheUsable ? cached.strings : null);
    return cacheUsable ? cached.strings : null;
  }

  try {
    const res = await conn.sendMessagePromise<I18nGetResponse>({
      type: "melitta_barista/i18n/get",
      locale,
    });
    // Refetch returned the cached strings_version → the cached strings stand.
    if (cacheUsable && typeof res.strings_version === "string" && res.strings_version === cached.strings_version) {
      setServerStrings(cached.strings);
      return cached.strings;
    }
    // Server merges en-first per key (§6.3.3) — store the served map verbatim.
    const strings = sanitizeStrings(res.strings);
    if (typeof res.strings_version === "string") {
      const entry: StringsCacheEntry = {
        locale,
        resolved_locale: typeof res.resolved_locale === "string" ? res.resolved_locale : undefined,
        strings_version: res.strings_version,
        strings,
      };
      writeStore(STRINGS_STORE_KEY, entry);
    }
    setServerStrings(strings);
    return strings;
  } catch (e) {
    console.warn("[melitta] i18n/get failed; using fallback strings:", e);
    setServerStrings(cacheUsable ? cached.strings : null);
    return cacheUsable ? cached.strings : null;
  }
}

/**
 * Load the sommelier vocabulary into the registry, per §9.2.2 caching rules.
 *
 * Cache axis is `strings_version` (same as server strings): a persisted entry
 * matching `contractStringsVersion` stands without a fetch; a refetch that
 * returns the cached `strings_version` leaves the cached vocab standing.
 * `melitta_barista/vocab/get` takes no arguments — machine-independent, not
 * entry-scoped, no locale (labels come from `i18n/get` domain `sommelier`).
 * Failure degrades to the persisted cache if any, else `null` (clients then
 * fall back to their hardcoded option lists per §9.2.6.1).
 *
 * Returns the vocabulary now active in the registry (`null` when none).
 */
export async function syncVocab(
  conn: Connection | null,
  contractStringsVersion?: string | null,
): Promise<ServerVocab | null> {
  const cached = readStore<VocabCacheEntry>(VOCAB_STORE_KEY);
  const cacheUsable =
    cached !== null &&
    typeof cached.strings_version === "string" &&
    cached.vocab !== null &&
    typeof cached.vocab === "object";

  if (cacheUsable && contractStringsVersion != null && cached.strings_version === contractStringsVersion) {
    setVocab(cached.vocab);
    return cached.vocab;
  }

  if (conn === null) {
    setVocab(cacheUsable ? cached.vocab : null);
    return cacheUsable ? cached.vocab : null;
  }

  try {
    const res = await conn.sendMessagePromise<VocabGetResponse>({
      type: "melitta_barista/vocab/get",
    });
    if (cacheUsable && typeof res.strings_version === "string" && res.strings_version === cached.strings_version) {
      setVocab(cached.vocab);
      return cached.vocab;
    }
    const vocab = sanitizeVocab(res.vocab);
    if (typeof res.strings_version === "string") {
      const entry: VocabCacheEntry = { strings_version: res.strings_version, vocab };
      writeStore(VOCAB_STORE_KEY, entry);
    }
    setVocab(vocab);
    return vocab;
  } catch (e) {
    console.warn("[melitta] vocab/get failed; using fallback vocab:", e);
    setVocab(cacheUsable ? cached.vocab : null);
    return cacheUsable ? cached.vocab : null;
  }
}
