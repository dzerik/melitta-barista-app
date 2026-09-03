import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Connection, HassEntities } from "home-assistant-js-websocket";
import {
  SUPPORTED_CONTRACT_VERSIONS,
  classifyVersionMismatch,
  validateContract,
  readBridgeAttributes,
  bridgeVersionMismatch,
  readStatusTokens,
  fetchUiContract,
  getUiContract,
  resetContractSession,
  persistLastGoodContract,
  loadLastGoodContract,
  dropPersistedContract,
  readParameters,
  readForbiddenCombinations,
  readActions,
  readSettings,
  readDirectKey,
  readBrandTheme,
  readStringsVersion,
  type UiContract,
  type BridgeAttributes,
} from "../src/lib/contract";
import {
  MELITTA_CONTRACT,
  NIVONA_CONTRACT,
  MELITTA_CONTRACT_FULL,
  NIVONA_CONTRACT_FULL,
  MELITTA_PARAMETERS,
  NIVONA_PARAMETERS,
  MELITTA_SETTINGS,
  NIVONA_SETTINGS,
  MELITTA_DIRECTKEY,
  clone,
} from "./fixtures/contracts";

function mockConn(impl: (msg: Record<string, unknown>) => Promise<unknown>) {
  const sendMessagePromise = vi.fn(impl);
  return { conn: { sendMessagePromise } as unknown as Connection, sendMessagePromise };
}

function entitiesWith(
  overrides: Record<string, { state: string; attributes: Record<string, unknown> }>,
): HassEntities {
  return overrides as unknown as HassEntities;
}

const BRIDGE_V1: BridgeAttributes = {
  entryId: "a1b2c3d4e5f6",
  contractVersion: 1,
  contractFingerprint: "9f3ac1d24b07",
  connected: true,
};

beforeEach(() => {
  resetContractSession();
  localStorage.clear();
});

describe("SUPPORTED_CONTRACT_VERSIONS", () => {
  it("is exactly [1]", () => {
    expect(SUPPORTED_CONTRACT_VERSIONS).toEqual([1]);
  });
});

describe("classifyVersionMismatch (§5.4 mismatch directions)", () => {
  it("returns null for a supported version", () => {
    expect(classifyVersionMismatch(1)).toBeNull();
  });
  it("server below our minimum → update the integration", () => {
    expect(classifyVersionMismatch(0)).toBe("update_integration");
  });
  it("server above our maximum → update the app", () => {
    expect(classifyVersionMismatch(2)).toBe("update_app");
    expect(classifyVersionMismatch(99)).toBe("update_app");
  });
  it("absent / non-numeric version → update the integration", () => {
    expect(classifyVersionMismatch(undefined)).toBe("update_integration");
    expect(classifyVersionMismatch(null)).toBe("update_integration");
    expect(classifyVersionMismatch("1")).toBe("update_integration");
  });
});

describe("validateContract", () => {
  it("accepts the §3.7 Melitta example verbatim", () => {
    expect(validateContract(clone(MELITTA_CONTRACT))).toBe(true);
  });

  it("accepts the §3.8 Nivona example verbatim", () => {
    expect(validateContract(clone(NIVONA_CONTRACT))).toBe(true);
  });

  it("accepts a v1-only document — no v2/v3 field is required (§6.0.1)", () => {
    const doc = clone(MELITTA_CONTRACT) as Record<string, unknown>;
    delete doc.parameters;
    delete doc.forbidden_combinations;
    delete doc.actions;
    delete doc.strings_version;
    delete doc.settings;
    delete doc.directkey;
    expect(validateContract(doc)).toBe(true);
  });

  it("accepts a document without brand_theme (additive amendment)", () => {
    const doc = clone(MELITTA_CONTRACT) as Record<string, unknown>;
    delete doc.brand_theme;
    expect(validateContract(doc)).toBe(true);
  });

  it("accepts the fully extended documents (§6.1.4 + §9.1.5 + §9.3.3)", () => {
    expect(validateContract(clone(MELITTA_CONTRACT_FULL))).toBe(true);
    expect(validateContract(clone(NIVONA_CONTRACT_FULL))).toBe(true);
  });

  it("ignores unknown fields (§5.3.1)", () => {
    const doc = clone(MELITTA_CONTRACT) as Record<string, unknown>;
    doc.future_block = { anything: true };
    expect(validateContract(doc)).toBe(true);
  });

  it("rejects non-objects and empty objects", () => {
    expect(validateContract(null)).toBe(false);
    expect(validateContract("contract")).toBe(false);
    expect(validateContract([])).toBe(false);
    expect(validateContract({})).toBe(false);
  });

  it("rejects a document missing a v1 core field", () => {
    for (const field of [
      "contract_version",
      "contract_fingerprint",
      "entry_id",
      "machine",
      "capabilities",
      "vocabularies",
      "limits",
      "recipes",
      "status_attribute_entity",
      "bridge_attribute_entity",
    ]) {
      const doc = clone(MELITTA_CONTRACT) as Record<string, unknown>;
      delete doc[field];
      expect(validateContract(doc), `missing ${field}`).toBe(false);
    }
  });

  it("rejects malformed vocabularies and recipes", () => {
    const doc1 = clone(MELITTA_CONTRACT);
    (doc1.vocabularies.freestyle as Record<string, unknown>).intensity = "strong";
    expect(validateContract(doc1)).toBe(false);

    const doc2 = clone(MELITTA_CONTRACT) as Record<string, unknown>;
    doc2.recipes = [{ name: "Espresso" }];
    expect(validateContract(doc2)).toBe(false);
  });
});

describe("readBridgeAttributes (§3.4 block A)", () => {
  const connectionEntity = {
    state: "Connected",
    attributes: {
      friendly_name: "Melitta Connection",
      entry_id: "a1b2c3d4e5f6",
      contract_version: 1,
      contract_fingerprint: "9f3ac1d24b07",
      connected: true,
    },
  };

  it("reads the full bridge block", () => {
    const entities = entitiesWith({ "sensor.melitta_connection": connectionEntity });
    expect(readBridgeAttributes(entities, "melitta")).toEqual(BRIDGE_V1);
  });

  it("returns null when the connection sensor is absent", () => {
    expect(readBridgeAttributes(entitiesWith({}), "melitta")).toBeNull();
  });

  it("returns null on a pre-contract integration (no entry_id attribute)", () => {
    const entities = entitiesWith({
      "sensor.melitta_connection": {
        state: "Connected",
        attributes: { friendly_name: "Melitta Connection" },
      },
    });
    expect(readBridgeAttributes(entities, "melitta")).toBeNull();
  });

  it("tolerates a pre-handshake entry without a fingerprint (§3.4)", () => {
    const entities = entitiesWith({
      "sensor.melitta_connection": {
        state: "Disconnected",
        attributes: { entry_id: "e1", contract_version: 1, connected: false },
      },
    });
    expect(readBridgeAttributes(entities, "melitta")).toEqual({
      entryId: "e1",
      contractVersion: 1,
      contractFingerprint: null,
      connected: false,
    });
  });

  it("bridgeVersionMismatch: null bridge → update_integration; v2 bridge → update_app", () => {
    expect(bridgeVersionMismatch(null)).toBe("update_integration");
    expect(bridgeVersionMismatch({ ...BRIDGE_V1, contractVersion: 2 })).toBe("update_app");
    expect(bridgeVersionMismatch(BRIDGE_V1)).toBeNull();
  });
});

describe("readStatusTokens (§3.4 block B)", () => {
  const stateEntity = {
    state: "Brewing",
    attributes: {
      process_id: 4,
      info_messages: ["FILL_BEANS_1"],
      process_token: "PRODUCT",
      sub_process_token: "GRINDING",
      manipulation_token: "NONE",
      is_brewing: true,
      awaiting_confirmation: false,
    },
  };

  it("reads the token block when the bridge version is supported", () => {
    const entities = entitiesWith({ "sensor.melitta_state": stateEntity });
    expect(readStatusTokens(entities, "melitta", BRIDGE_V1)).toEqual({
      processToken: "PRODUCT",
      subProcessToken: "GRINDING",
      manipulationToken: "NONE",
      isBrewing: true,
      awaitingConfirmation: false,
      processId: 4,
      infoMessages: ["FILL_BEANS_1"],
    });
  });

  it("returns null when the bridge is absent or unsupported (§5.3.3 gate)", () => {
    const entities = entitiesWith({ "sensor.melitta_state": stateEntity });
    expect(readStatusTokens(entities, "melitta", null)).toBeNull();
    expect(
      readStatusTokens(entities, "melitta", { ...BRIDGE_V1, contractVersion: 2 }),
    ).toBeNull();
  });

  it("returns null when the state sensor is unavailable — the offline signal", () => {
    const entities = entitiesWith({
      "sensor.melitta_state": { state: "unavailable", attributes: {} },
    });
    expect(readStatusTokens(entities, "melitta", BRIDGE_V1)).toBeNull();
  });

  it("returns null when the state sensor is absent or has no token attributes", () => {
    expect(readStatusTokens(entitiesWith({}), "melitta", BRIDGE_V1)).toBeNull();
    const legacy = entitiesWith({
      "sensor.melitta_state": {
        state: "Ready",
        attributes: { process_id: 3, info_messages: [] },
      },
    });
    expect(readStatusTokens(legacy, "melitta", BRIDGE_V1)).toBeNull();
  });

  it("maps null tokens (idle sub-process, unmapped process) faithfully", () => {
    const entities = entitiesWith({
      "sensor.melitta_state": {
        state: "Ready",
        attributes: {
          process_token: "READY",
          sub_process_token: null,
          manipulation_token: "NONE",
          is_brewing: false,
          awaiting_confirmation: false,
        },
      },
    });
    const tokens = readStatusTokens(entities, "melitta", BRIDGE_V1);
    expect(tokens?.processToken).toBe("READY");
    expect(tokens?.subProcessToken).toBeNull();
    expect(tokens?.isBrewing).toBe(false);
    expect(tokens?.infoMessages).toEqual([]);
  });
});

describe("fetchUiContract failure classification (§2.3.5)", () => {
  it("sends the correct WS message and returns the validated document", async () => {
    const { conn, sendMessagePromise } = mockConn(async () => clone(MELITTA_CONTRACT));
    const result = await fetchUiContract(conn, "a1b2c3d4e5f6");
    expect(sendMessagePromise).toHaveBeenCalledWith({
      type: "melitta_barista/ui_contract/get",
      entry_id: "a1b2c3d4e5f6",
    });
    expect(result).toEqual({ ok: true, contract: MELITTA_CONTRACT, stale: false });
  });

  it("unknown_command → durable, update_integration", async () => {
    const { conn } = mockConn(async () => {
      throw { code: "unknown_command", message: "Unknown command." };
    });
    expect(await fetchUiContract(conn, "e1")).toEqual({
      ok: false,
      kind: "durable",
      reason: "unknown_command",
      mismatch: "update_integration",
    });
  });

  it.each(["entry_not_found", "client_not_ready", "contract_not_ready"])(
    "%s → transient",
    async (code) => {
      const { conn } = mockConn(async () => {
        throw { code, message: code };
      });
      expect(await fetchUiContract(conn, "e1")).toEqual({
        ok: false,
        kind: "transient",
        reason: code,
        mismatch: null,
      });
    },
  );

  it("network/auth errors → transient", async () => {
    const { conn } = mockConn(async () => {
      throw new Error("connection lost");
    });
    const result = await fetchUiContract(conn, "e1");
    expect(result).toMatchObject({ ok: false, kind: "transient", reason: "network_error" });
  });

  it("response with unsupported contract_version → durable, update_app", async () => {
    const doc = clone(MELITTA_CONTRACT);
    doc.contract_version = 2;
    const { conn } = mockConn(async () => doc);
    expect(await fetchUiContract(conn, "e1")).toEqual({
      ok: false,
      kind: "durable",
      reason: "unsupported_contract_version",
      mismatch: "update_app",
    });
  });

  it("response without contract_version → durable, update_integration", async () => {
    const { conn } = mockConn(async () => ({ hello: "world" }));
    expect(await fetchUiContract(conn, "e1")).toEqual({
      ok: false,
      kind: "durable",
      reason: "unsupported_contract_version",
      mismatch: "update_integration",
    });
  });

  it("malformed payload with a SUPPORTED contract_version → transient (§2.3.5)", async () => {
    const doc = clone(MELITTA_CONTRACT) as Record<string, unknown>;
    delete doc.capabilities; // partially built document
    const { conn } = mockConn(async () => doc);
    expect(await fetchUiContract(conn, "e1")).toEqual({
      ok: false,
      kind: "transient",
      reason: "malformed_contract",
      mismatch: null,
    });
  });
});

describe("getUiContract session cache (§2.3.4) and durable latch", () => {
  it("caches per entry_id + fingerprint: second call does not refetch", async () => {
    const { conn, sendMessagePromise } = mockConn(async () => clone(MELITTA_CONTRACT));
    const r1 = await getUiContract(conn, "a1b2c3d4e5f6", "9f3ac1d24b07");
    const r2 = await getUiContract(conn, "a1b2c3d4e5f6", "9f3ac1d24b07");
    expect(r1.ok && r2.ok).toBe(true);
    expect(sendMessagePromise).toHaveBeenCalledTimes(1);
  });

  it("a changed fingerprint misses the cache and refetches", async () => {
    const { conn, sendMessagePromise } = mockConn(async () => clone(MELITTA_CONTRACT));
    await getUiContract(conn, "a1b2c3d4e5f6", "9f3ac1d24b07");
    await getUiContract(conn, "a1b2c3d4e5f6", "new-fingerprint");
    expect(sendMessagePromise).toHaveBeenCalledTimes(2);
  });

  it("a null fingerprint (pre-handshake bridge) always fetches", async () => {
    const { conn, sendMessagePromise } = mockConn(async () => clone(MELITTA_CONTRACT));
    await getUiContract(conn, "a1b2c3d4e5f6", null);
    await getUiContract(conn, "a1b2c3d4e5f6", null);
    expect(sendMessagePromise).toHaveBeenCalledTimes(2);
  });

  it("durable failure latches for the session — no re-probing (§2.3.5)", async () => {
    const { conn, sendMessagePromise } = mockConn(async () => {
      throw { code: "unknown_command", message: "Unknown command." };
    });
    const r1 = await getUiContract(conn, "e1", "fp");
    const r2 = await getUiContract(conn, "e1", "fp");
    expect(r1).toMatchObject({ ok: false, kind: "durable" });
    expect(r2).toBe(r1);
    expect(sendMessagePromise).toHaveBeenCalledTimes(1);
  });

  it("transient failure does NOT latch — the next call retries", async () => {
    let calls = 0;
    const { conn, sendMessagePromise } = mockConn(async () => {
      calls += 1;
      if (calls === 1) throw { code: "contract_not_ready", message: "no handshake" };
      return clone(MELITTA_CONTRACT);
    });
    const r1 = await getUiContract(conn, "a1b2c3d4e5f6", "9f3ac1d24b07");
    const r2 = await getUiContract(conn, "a1b2c3d4e5f6", "9f3ac1d24b07");
    expect(r1).toMatchObject({ ok: false, kind: "transient" });
    expect(r2.ok).toBe(true);
    expect(sendMessagePromise).toHaveBeenCalledTimes(2);
  });

  it("a successful fetch persists the last-good contract for its entry", async () => {
    const { conn } = mockConn(async () => clone(MELITTA_CONTRACT));
    await getUiContract(conn, "a1b2c3d4e5f6", "9f3ac1d24b07");
    const loaded = loadLastGoodContract("a1b2c3d4e5f6");
    expect(loaded?.contract).toEqual(MELITTA_CONTRACT);
    expect(loaded?.stale).toBe(true);
  });
});

describe("last-good persistence with revalidation (§5.4 PWA rule)", () => {
  it("round-trips a contract, marking the loaded copy stale", () => {
    persistLastGoodContract(clone(NIVONA_CONTRACT));
    const loaded = loadLastGoodContract("f6e5d4c3b2a1");
    expect(loaded).not.toBeNull();
    expect(loaded?.stale).toBe(true);
    expect(loaded?.contract).toEqual(NIVONA_CONTRACT);
    expect(typeof loaded?.savedAt).toBe("string");
  });

  it("returns null when nothing was persisted", () => {
    expect(loadLastGoodContract("nope")).toBeNull();
  });

  it("discards corrupt stored JSON", () => {
    localStorage.setItem("melitta_contract_e1", "{not json");
    expect(loadLastGoodContract("e1")).toBeNull();
    expect(localStorage.getItem("melitta_contract_e1")).toBeNull();
  });

  it("revalidates on load: a structurally invalid stored contract is discarded", () => {
    const bad = clone(MELITTA_CONTRACT) as Record<string, unknown>;
    delete bad.vocabularies;
    localStorage.setItem(
      "melitta_contract_a1b2c3d4e5f6",
      JSON.stringify({ v: 1, saved_at: "2026-09-02T10:15:00Z", contract: bad }),
    );
    expect(loadLastGoodContract("a1b2c3d4e5f6")).toBeNull();
    expect(localStorage.getItem("melitta_contract_a1b2c3d4e5f6")).toBeNull();
  });

  it("revalidates on load: a stored contract with an unsupported version is discarded", () => {
    const v2 = clone(MELITTA_CONTRACT);
    v2.contract_version = 2;
    localStorage.setItem(
      "melitta_contract_a1b2c3d4e5f6",
      JSON.stringify({ v: 1, saved_at: "2026-09-02T10:15:00Z", contract: v2 }),
    );
    expect(loadLastGoodContract("a1b2c3d4e5f6")).toBeNull();
  });

  it("discards a stored contract whose entry_id does not match the key", () => {
    persistLastGoodContract(clone(MELITTA_CONTRACT));
    const raw = localStorage.getItem("melitta_contract_a1b2c3d4e5f6")!;
    localStorage.setItem("melitta_contract_other", raw);
    expect(loadLastGoodContract("other")).toBeNull();
  });

  it("dropPersistedContract removes the entry", () => {
    persistLastGoodContract(clone(MELITTA_CONTRACT));
    dropPersistedContract("a1b2c3d4e5f6");
    expect(loadLastGoodContract("a1b2c3d4e5f6")).toBeNull();
  });
});

describe("per-feature presence-gating readers (§6.0.1)", () => {
  it("a v1-only document gates every v2/v3 feature to its fallback", () => {
    const doc = clone(MELITTA_CONTRACT);
    expect(readParameters(doc)).toBeNull();
    expect(readActions(doc)).toBeNull();
    expect(readSettings(doc)).toBeNull();
    expect(readDirectKey(doc)).toBeNull();
    expect(readForbiddenCombinations(doc)).toEqual([]);
    expect(readStringsVersion(doc)).toBeNull();
  });

  it("a null contract gates everything", () => {
    expect(readParameters(null)).toBeNull();
    expect(readActions(null)).toBeNull();
    expect(readSettings(null)).toBeNull();
    expect(readDirectKey(null)).toBeNull();
    expect(readBrandTheme(null)).toBeNull();
    expect(readForbiddenCombinations(null)).toEqual([]);
  });

  it("returns the §6.1.4 Melitta parameters block verbatim", () => {
    expect(readParameters(clone(MELITTA_CONTRACT_FULL))).toEqual(MELITTA_PARAMETERS);
  });

  it("returns the §6.1.4 Nivona parameters block verbatim", () => {
    expect(readParameters(clone(NIVONA_CONTRACT_FULL))).toEqual(NIVONA_PARAMETERS);
  });

  it("drops malformed parameter descriptors, keeping the rest", () => {
    const doc = clone(MELITTA_CONTRACT_FULL);
    (doc.parameters as Record<string, unknown>).broken = "not a descriptor";
    const params = readParameters(doc);
    expect(params).not.toBeNull();
    expect(params!.broken).toBeUndefined();
    expect(params!.process).toEqual(MELITTA_PARAMETERS.process);
  });

  it("returns the §9.1.5 settings blocks verbatim", () => {
    expect(readSettings(clone(MELITTA_CONTRACT_FULL))).toEqual(MELITTA_SETTINGS);
    expect(readSettings(clone(NIVONA_CONTRACT_FULL))).toEqual(NIVONA_SETTINGS);
  });

  it("drops settings entries without a bound entity", () => {
    const doc = clone(MELITTA_CONTRACT_FULL);
    (doc.settings as unknown[]).push({ setting: "ghost", control: "switch" });
    expect(readSettings(doc)).toEqual(MELITTA_SETTINGS);
  });

  it("returns the §9.3.3 directkey block verbatim", () => {
    const dk = readDirectKey(clone(MELITTA_CONTRACT_FULL));
    expect(dk).toEqual(MELITTA_DIRECTKEY);
    expect(dk!.categories).toHaveLength(7);
    expect(dk!.profiles).toHaveLength(9);
    expect(dk!.categories[5]).toEqual({
      category: "milk",
      id: 5,
      machine_button: false,
      icon: "mdi:cup-outline",
    });
  });

  it("directkey without categories/profiles arrays falls back", () => {
    const doc = clone(MELITTA_CONTRACT_FULL) as UiContract;
    (doc as Record<string, unknown>).directkey = { categories: {}, profiles: [] };
    expect(readDirectKey(doc)).toBeNull();
  });

  it("action entries use the binding 'action' key; keyless entries are dropped", () => {
    const doc = clone(MELITTA_CONTRACT);
    (doc as Record<string, unknown>).actions = [
      { action: "brew", group: "brew" },
      { name: "wrong_key_precedent" },
      "garbage",
    ];
    expect(readActions(doc)).toEqual([{ action: "brew", group: "brew" }]);
  });

  it("reads brand_theme and strings_version when present", () => {
    expect(readBrandTheme(clone(NIVONA_CONTRACT))).toEqual(NIVONA_CONTRACT.brand_theme);
    expect(readStringsVersion(clone(MELITTA_CONTRACT_FULL))).toBe("0.93.0");
  });
});
