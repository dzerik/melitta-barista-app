/**
 * Sommelier WS error-code mapping (UI Contract §10.2 Zone P-H, §9.2.6.6).
 *
 * The backend pre-flights LLM generation and rejects with actionable codes
 * (`no_llm_agent`, `no_llm_agent_selected`, `llm_agent_missing`), the HA
 * websocket layer adds `timeout` and `unauthorized` (the §9.2.6.6 admin
 * asymmetry: `vocab/get` is admin-free but generate/brew stay admin-gated).
 * home-assistant-js-websocket rejects those as plain `{code, message}`
 * objects — which the legacy hook collapsed into a generic "Generation
 * failed". This module maps exactly the five contract-listed codes to
 * localized guidance; every other rejection passes through untouched, so
 * behavior against pre-contract integrations stays byte-identical.
 */
import type { Connection } from "home-assistant-js-websocket";
import { t, type Locale, type TranslationKey } from "./i18n";

/** The five mapped codes (§10.2 P-H) → their client-bundle hint keys. */
export const SOMMELIER_ERROR_KEYS: Readonly<Record<string, TranslationKey>> = {
  no_llm_agent: "sommelier.error.no_llm_agent",
  no_llm_agent_selected: "sommelier.error.no_llm_agent_selected",
  llm_agent_missing: "sommelier.error.llm_agent_missing",
  timeout: "sommelier.error.timeout",
  unauthorized: "sommelier.error.unauthorized",
};

/** Extract a WS error code from a rejection value (plain object or Error). */
export function wsErrorCode(e: unknown): string | null {
  if (typeof e === "object" && e !== null && "code" in e) {
    const code = (e as { code?: unknown }).code;
    if (typeof code === "string" && code) return code;
  }
  return null;
}

/** Best human-readable message of a rejection value. */
export function wsErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "object" && e !== null) {
    const message = (e as { message?: unknown }).message;
    if (typeof message === "string" && message) return message;
  }
  return String(e);
}

/**
 * Localized actionable hint for a mapped sommelier error, or null when the
 * code is not one of the five mapped ones (callers then keep their current
 * behavior). `no_llm_agent` appends the `sommelier.configure_llm` guidance.
 */
export function sommelierErrorHint(locale: Locale, e: unknown): string | null {
  const code = wsErrorCode(e);
  if (code === null) return null;
  const key = SOMMELIER_ERROR_KEYS[code];
  if (key === undefined) return null;
  const hint = t(locale, key);
  if (code === "no_llm_agent") {
    return `${hint} ${t(locale, "sommelier.configure_llm")}`;
  }
  return hint;
}

/** An Error carrying the original WS code alongside the localized hint. */
export class SommelierWsError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "SommelierWsError";
    this.code = code;
  }
}

/**
 * Wrap a Connection so `melitta_barista/*` command rejections with a mapped
 * sommelier code re-reject as an `Error` whose message is the localized
 * hint (and whose `.code` survives for discrimination). Everything else —
 * other message types, other codes, successes — passes through verbatim, so
 * the legacy error surface is unchanged for unmapped failures.
 *
 * This is how the hints reach `useSommelier`'s existing error banner
 * without touching that hook: its catch keeps `e.message` for Error
 * instances and only genericizes non-Errors.
 */
export function withSommelierErrorMapping(
  conn: Connection,
  getLocale: () => Locale,
): Connection {
  const sendMessagePromise = async <Result>(
    message: { type: string } & Record<string, unknown>,
  ): Promise<Result> => {
    try {
      return await conn.sendMessagePromise<Result>(message);
    } catch (e) {
      const mapped = message.type?.startsWith("melitta_barista/")
        ? sommelierErrorHint(getLocale(), e)
        : null;
      if (mapped !== null) {
        throw new SommelierWsError(mapped, wsErrorCode(e) as string);
      }
      throw e;
    }
  };
  return new Proxy(conn, {
    get(target, prop) {
      if (prop === "sendMessagePromise") return sendMessagePromise;
      const value = Reflect.get(target, prop, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as Connection;
}
