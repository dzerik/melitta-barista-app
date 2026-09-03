/**
 * Zone P-I — the app-level contract session (UI Contract §2.3 + §5.4 PWA rules).
 *
 * One instance lives in App and owns the `ui_contract/get` lifecycle over the
 * bridge attributes of `sensor.<prefix>_connection`:
 *
 *  - version gate (§5.4): a present-but-unsupported bridge `contract_version`
 *    (or a durable fetch failure) yields a `mismatch` direction the caller
 *    renders as one of the two full-screen prompts; a connection sensor with
 *    no contract attributes at all is the pre-contract signal
 *    ("update_integration"). No connection sensor at all (demo mode) gates
 *    nothing — every consumer then runs its legacy fallback.
 *  - fetch + session cache via `getUiContract` (keyed entry_id + fingerprint,
 *    §2.3.4): a bridge `contract_fingerprint` change re-runs the fetch effect
 *    and naturally misses the cache.
 *  - transient-retry (§2.3.5): bounded to one retry per `false→true`
 *    transition of the bridge `connected` attribute; fingerprint
 *    appearance/change retries via the effect dependency, never by polling.
 *  - last-good persistence (§5.4): the persisted per-entry document renders
 *    stale-marked until a live fetch replaces it.
 *
 * Once a supported bridge has been seen this session, a transiently
 * attribute-less connection sensor (e.g. briefly unavailable during an HA
 * restart) never flips the app back to the "update the integration" screen,
 * and the last documents are kept — only a real switch to a different
 * `entry_id` resets the session.
 */
import { useEffect, useRef, useState } from "react";
import type { Connection, HassEntities } from "home-assistant-js-websocket";
import {
  readBridgeAttributes,
  bridgeVersionMismatch,
  getUiContract,
  loadLastGoodContract,
  readStringsVersion,
  type BridgeAttributes,
  type MismatchDirection,
  type UiContract,
} from "../lib/contract";

/** What App renders from: the active document, staleness, and the §5.4 gate. */
export interface ContractSession {
  /** The active contract document — live, or the persisted last-good. */
  contract: UiContract | null;
  /** True when `contract` comes from persistence and no live fetch has landed. */
  stale: boolean;
  /** Non-null → render the §5.4 VersionMismatchScreen instead of the app. */
  mismatch: MismatchDirection | null;
  /** `strings_version` of the active document (§6.3.2 free revalidation). */
  stringsVersion: string | null;
  /** Parsed bridge attributes (null pre-contract / demo). */
  bridge: BridgeAttributes | null;
}

/**
 * Contract fetch lifecycle for the current HA session.
 *
 * `conn` may be null (disconnected/demo bootstrap); `prefix` null while the
 * integration is still being detected. Both simply keep the session inert.
 */
export function useUiContract(
  conn: Connection | null,
  entities: HassEntities,
  prefix: string | null,
): ContractSession {
  const bridge = prefix ? readBridgeAttributes(entities, prefix) : null;
  const entryId = bridge?.entryId ?? null;
  const fingerprint = bridge?.contractFingerprint ?? null;
  const connected = bridge?.connected ?? false;
  const versionOk = bridge !== null && bridgeVersionMismatch(bridge) === null;
  const sensorPresent =
    prefix !== null && entities[`sensor.${prefix}_connection`] !== undefined;

  const [live, setLive] = useState<UiContract | null>(null);
  const [staleDoc, setStaleDoc] = useState<UiContract | null>(null);
  const [durable, setDurable] = useState<MismatchDirection | null>(null);
  const [sawSupported, setSawSupported] = useState(false);
  const [sessionEntry, setSessionEntry] = useState<string | null>(null);
  const seqRef = useRef(0);
  const transientRef = useRef(false);
  const prevConnectedRef = useRef(false);
  const lastParamsRef = useRef<string | null>(null);
  const lastConnRef = useRef<Connection | null>(null);

  // Latch (render-phase adjustment): a supported bridge seen once suppresses
  // the pre-contract screen for the rest of the session — transient
  // attribute loss is not a downgrade.
  if (versionOk && !sawSupported) setSawSupported(true);

  // Entry scope change (render-phase adjustment): drop the previous entry's
  // documents and seed the new entry's persisted last-good (§5.4),
  // stale-marked until a live fetch lands. An `entryId → null` blip keeps
  // the last documents.
  if (entryId !== null && entryId !== sessionEntry) {
    setSessionEntry(entryId);
    setLive(null);
    setDurable(null);
    setStaleDoc(loadLastGoodContract(entryId)?.contract ?? null);
  }

  // Fetch effect (§2.3.4/§2.3.5). Fires a classified `getUiContract` when
  // the fetch parameters change (conn/entry/fingerprint/version gate — a
  // fingerprint change misses the session cache and refetches), plus one
  // bounded retry per `false→true` transition of the bridge `connected`
  // attribute when the last attempt failed transiently. Never polls.
  useEffect(() => {
    const prevConnected = prevConnectedRef.current;
    prevConnectedRef.current = connected;
    if (!conn || !entryId || !versionOk) return;
    const paramsKey = `${entryId}|${fingerprint ?? ""}`;
    const paramsChanged =
      lastParamsRef.current !== paramsKey || lastConnRef.current !== conn;
    const retry = !prevConnected && connected && transientRef.current;
    if (!paramsChanged && !retry) return;
    lastParamsRef.current = paramsKey;
    lastConnRef.current = conn;
    if (retry) transientRef.current = false;
    const seq = ++seqRef.current;
    getUiContract(conn, entryId, fingerprint).then((res) => {
      if (seq !== seqRef.current) return;
      if (res.ok) {
        transientRef.current = false;
        setLive(res.contract);
      } else if (res.kind === "durable") {
        setDurable(res.mismatch);
      } else {
        transientRef.current = true;
      }
    });
  }, [conn, entryId, fingerprint, versionOk, connected]);

  // §5.4 gate: durable failures first, then the live bridge's own version,
  // then the pre-contract case (sensor present, no contract attributes) —
  // suppressed once a supported bridge was seen this session.
  let mismatch: MismatchDirection | null = null;
  if (durable !== null) {
    mismatch = durable;
  } else if (bridge !== null) {
    mismatch = bridgeVersionMismatch(bridge);
  } else if (sensorPresent && !sawSupported) {
    mismatch = "update_integration";
  }

  const contract = live ?? staleDoc;
  return {
    contract,
    stale: live === null && staleDoc !== null,
    mismatch,
    stringsVersion: readStringsVersion(contract),
    bridge,
  };
}
