import { describe, it, expect, beforeEach } from "vitest";
import type { HassEntities } from "home-assistant-js-websocket";
import {
  deriveMachineStatus,
  isNavigationLocked,
  sectionGates,
} from "../src/lib/status";
import { setServerStrings, resetServerStrings } from "../src/lib/server-strings";
import { MELITTA_CONTRACT, clone } from "./fixtures/contracts";

const CTX = { id: "", user_id: null, parent_id: null };

function ent(state: string, attributes: Record<string, unknown> = {}) {
  return { entity_id: "", state, attributes, last_changed: "", last_updated: "", context: CTX };
}

interface Setup {
  /** Legacy native_value of sensor.melitta_state; null = sensor absent. */
  state?: string | null;
  stateAttrs?: Record<string, unknown>;
  connection?: string;
  bridgeAttrs?: Record<string, unknown> | null;
  actionRequired?: string;
  activity?: string;
}

function makeEntities({
  state = "Ready",
  stateAttrs = {},
  connection = "Connected",
  bridgeAttrs = null,
  actionRequired,
  activity,
}: Setup): HassEntities {
  const entities: Record<string, ReturnType<typeof ent>> = {
    "sensor.melitta_connection": ent(connection, bridgeAttrs ?? {}),
  };
  if (state !== null) entities["sensor.melitta_state"] = ent(state, stateAttrs);
  if (actionRequired !== undefined) {
    entities["sensor.melitta_action_required"] = ent(actionRequired);
  }
  if (activity !== undefined) entities["sensor.melitta_activity"] = ent(activity);
  return entities as HassEntities;
}

const BRIDGE_V1 = {
  entry_id: "e1",
  contract_version: 1,
  contract_fingerprint: "abc123",
  connected: true,
};

function tokenAttrs(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    process_id: 4,
    process_token: "READY",
    sub_process_token: null,
    manipulation_token: "NONE",
    is_brewing: false,
    awaiting_confirmation: false,
    info_messages: [],
    ...overrides,
  };
}

function tokenEntities(
  tokens: Record<string, unknown> = {},
  setup: Setup = {},
): HassEntities {
  return makeEntities({
    state: "Ready",
    stateAttrs: tokenAttrs(tokens),
    bridgeAttrs: BRIDGE_V1,
    ...setup,
  });
}

beforeEach(() => {
  resetServerStrings();
});

// ---------------------------------------------------------------------------
// Legacy mode (no bridge attributes — pre-contract integration)
// ---------------------------------------------------------------------------

describe("deriveMachineStatus — legacy fallback", () => {
  it("uses the frozen English strings when the bridge block is absent", () => {
    const view = deriveMachineStatus(makeEntities({ state: "Ready" }), "melitta", "en");
    expect(view.source).toBe("legacy");
    expect(view.ready).toBe(true);
    expect(view.statusLabel).toBe("Ready");
    expect(view.brewing).toBe(false);
    expect(view.hasAction).toBe(false);
  });

  it("maps Brewing / Off / service strings like the pre-contract app", () => {
    expect(deriveMachineStatus(makeEntities({ state: "Brewing" }), "melitta", "en").brewing).toBe(true);
    const off = deriveMachineStatus(makeEntities({ state: "Off" }), "melitta", "en");
    expect(off.off).toBe(true);
    expect(off.offline).toBe(false);
    expect(deriveMachineStatus(makeEntities({ state: "Cleaning" }), "melitta", "en").service).toBe("cleaning");
    expect(deriveMachineStatus(makeEntities({ state: "Easy Clean" }), "melitta", "en").service).toBe("easy_clean");
    expect(deriveMachineStatus(makeEntities({ state: "Busy" }), "melitta", "en").service).toBe("busy");
  });

  it("treats a missing/unavailable state sensor as offline", () => {
    const view = deriveMachineStatus(makeEntities({ state: null }), "melitta", "en");
    expect(view.offline).toBe(true);
    expect(view.statusLabel).toBe("offline");
    const unavailable = deriveMachineStatus(
      makeEntities({ state: "unavailable" }),
      "melitta",
      "en",
    );
    expect(unavailable.offline).toBe(true);
  });

  it("reads action_required with the translated hint", () => {
    const view = deriveMachineStatus(
      makeEntities({ state: "Ready", actionRequired: "Fill Water" }),
      "melitta",
      "en",
    );
    expect(view.hasAction).toBe(true);
    expect(view.actionLabel).toBe("Fill Water");
    expect(view.actionHint).toBe("Refill the water tank");
  });

  it('ignores action_required "None"', () => {
    const view = deriveMachineStatus(
      makeEntities({ state: "Ready", actionRequired: "None" }),
      "melitta",
      "en",
    );
    expect(view.hasAction).toBe(false);
    expect(view.actionLabel).toBeNull();
  });

  it("derives connected from the connection sensor string", () => {
    expect(
      deriveMachineStatus(makeEntities({ connection: "Connected" }), "melitta", "en").connected,
    ).toBe(true);
    expect(
      deriveMachineStatus(makeEntities({ connection: "Disconnected" }), "melitta", "en").connected,
    ).toBe(false);
  });

  it("passes the activity sensor string through", () => {
    const view = deriveMachineStatus(
      makeEntities({ state: "Brewing", activity: "Grinding" }),
      "melitta",
      "en",
    );
    expect(view.activityLabel).toBe("Grinding");
  });

  it("falls back to legacy when the bridge contract_version is unsupported (§5.3.3)", () => {
    const view = deriveMachineStatus(
      makeEntities({
        state: "Ready",
        stateAttrs: tokenAttrs({ process_token: "PRODUCT", is_brewing: true }),
        bridgeAttrs: { ...BRIDGE_V1, contract_version: 99 },
      }),
      "melitta",
      "en",
    );
    expect(view.source).toBe("legacy");
    expect(view.ready).toBe(true); // native_value "Ready" wins; tokens ignored entirely
  });

  it("falls back to legacy when the state sensor is available but has no token attrs", () => {
    const view = deriveMachineStatus(
      makeEntities({
        state: "Brewing",
        stateAttrs: { process_id: 4 },
        bridgeAttrs: BRIDGE_V1,
      }),
      "melitta",
      "en",
    );
    expect(view.source).toBe("legacy");
    expect(view.brewing).toBe(true);
  });

  it("never serves token-keyed descriptions in legacy mode", () => {
    setServerStrings({
      "status.process.READY.description": "The machine is on and ready to brew.",
      "status.sub_process.GRINDING.description": "Grinding beans from the selected hopper.",
    });
    const view = deriveMachineStatus(
      makeEntities({ state: "Ready", activity: "Grinding" }),
      "melitta",
      "en",
    );
    expect(view.source).toBe("legacy");
    expect(view.processDescription).toBeNull();
    expect(view.activityDescription).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Token mode (§3.4 B)
// ---------------------------------------------------------------------------

describe("deriveMachineStatus — token mode", () => {
  it("READY → ready with a humanized fallback label", () => {
    const view = deriveMachineStatus(tokenEntities(), "melitta", "en");
    expect(view.source).toBe("tokens");
    expect(view.ready).toBe(true);
    expect(view.processToken).toBe("READY");
    expect(view.statusLabel).toBe("Ready");
  });

  it("PRODUCT/is_brewing → brewing with the bundle label", () => {
    const view = deriveMachineStatus(
      tokenEntities({ process_token: "PRODUCT", is_brewing: true }),
      "melitta",
      "en",
    );
    expect(view.brewing).toBe(true);
    expect(view.ready).toBe(false);
    expect(view.statusLabel).toBe("Brewing");
  });

  it("prefers the served string for the status label (§6.3.5.1)", () => {
    setServerStrings({ "status.process.PRODUCT": "Zubereitung" });
    const view = deriveMachineStatus(
      tokenEntities({ process_token: "PRODUCT", is_brewing: true }),
      "melitta",
      "en",
    );
    expect(view.statusLabel).toBe("Zubereitung");
  });

  it("uses the ru bundle tier when no server string is set", () => {
    const view = deriveMachineStatus(
      tokenEntities({ process_token: "SWITCH_OFF" }),
      "melitta",
      "ru",
    );
    expect(view.off).toBe(true);
    // ru bundle "status.off"
    expect(view.statusLabel).not.toBe("Off");
    expect(view.statusLabel.length).toBeGreaterThan(0);
  });

  it("maps maintenance tokens onto service kinds", () => {
    const cases: Array<[string, string]> = [
      ["CLEANING", "cleaning"],
      ["EASY_CLEAN", "easy_clean"],
      ["INTENSIVE_CLEAN", "intensive_clean"],
      ["DESCALING", "descaling"],
      ["EVAPORATING", "evaporating"],
      ["BUSY", "busy"],
    ];
    for (const [token, kind] of cases) {
      const view = deriveMachineStatus(
        tokenEntities({ process_token: token }),
        "melitta",
        "en",
      );
      expect(view.service, token).toBe(kind);
      expect(view.unknownActive, token).toBe(false);
    }
  });

  it("keeps FILTER_* known but without a dedicated view (legacy parity)", () => {
    const view = deriveMachineStatus(
      tokenEntities({ process_token: "FILTER_INSERT" }),
      "melitta",
      "en",
    );
    expect(view.unknownActive).toBe(false);
    expect(view.ready).toBe(false);
    expect(view.service).toBeNull();
    expect(view.statusLabel).toBe("Filter insert"); // humanized (§5.3.2)
  });

  it("treats an unknown token as neutral active (§5.3.2 rule 2), never throws", () => {
    const view = deriveMachineStatus(
      tokenEntities({ process_token: "PRE_HEATING" }),
      "melitta",
      "en",
    );
    expect(view.unknownActive).toBe(true);
    expect(view.statusLabel).toBe("Pre heating");
  });

  it("treats a null process_token (unmapped raw code) as neutral busy", () => {
    const view = deriveMachineStatus(
      tokenEntities({ process_token: null }),
      "melitta",
      "en",
    );
    expect(view.unknownActive).toBe(true);
    expect(view.statusLabel).toBe("Busy");
  });

  it("manipulation token drives hasAction with the bundle-tier label", () => {
    const view = deriveMachineStatus(
      tokenEntities({ manipulation_token: "FILL_WATER" }),
      "melitta",
      "en",
    );
    expect(view.hasAction).toBe(true);
    expect(view.actionLabel).toBe("Refill the water tank");
    expect(view.actionHint).toBeNull();
  });

  it("prefers the served manipulation string; humanizes tokens without a bundle key", () => {
    setServerStrings({ "status.manipulation.FILL_WATER": "Wassertank füllen" });
    expect(
      deriveMachineStatus(tokenEntities({ manipulation_token: "FILL_WATER" }), "melitta", "en")
        .actionLabel,
    ).toBe("Wassertank füllen");
    resetServerStrings();
    expect(
      deriveMachineStatus(
        tokenEntities({ manipulation_token: "MOVE_CUP_TO_FROTHER" }),
        "melitta",
        "en",
      ).actionLabel,
    ).toBe("Move cup to frother");
  });

  it('manipulation "NONE" means no action', () => {
    const view = deriveMachineStatus(tokenEntities(), "melitta", "en");
    expect(view.hasAction).toBe(false);
    expect(view.actionLabel).toBeNull();
  });

  it("passes awaiting_confirmation through", () => {
    expect(
      deriveMachineStatus(
        tokenEntities({ manipulation_token: "EMPTY_TRAYS", awaiting_confirmation: true }),
        "melitta",
        "en",
      ).awaitingConfirmation,
    ).toBe(true);
  });

  it("localizes sub-process tokens with the frozen English tier-2 fallback", () => {
    expect(
      deriveMachineStatus(tokenEntities({ sub_process_token: "GRINDING" }), "melitta", "en")
        .activityLabel,
    ).toBe("Grinding");
    expect(
      deriveMachineStatus(tokenEntities({ sub_process_token: "COFFEE" }), "melitta", "en")
        .activityLabel,
    ).toBe("Extracting");
    setServerStrings({ "status.sub_process.COFFEE": "Extraktion" });
    expect(
      deriveMachineStatus(tokenEntities({ sub_process_token: "COFFEE" }), "melitta", "en")
        .activityLabel,
    ).toBe("Extraktion");
  });

  it("carries the served state descriptions (§6.3.7), null when unserved", () => {
    // Unserved: the view says nothing and the call site keeps its own copy.
    const plain = deriveMachineStatus(
      tokenEntities({ process_token: "PRODUCT", is_brewing: true, sub_process_token: "GRINDING" }),
      "melitta",
      "en",
    );
    expect(plain.processDescription).toBeNull();
    expect(plain.activityDescription).toBeNull();

    setServerStrings({
      "status.process.PRODUCT.description": "The machine is preparing a drink.",
      "status.sub_process.GRINDING.description": "Grinding beans from the selected hopper.",
    });
    const served = deriveMachineStatus(
      tokenEntities({ process_token: "PRODUCT", is_brewing: true, sub_process_token: "GRINDING" }),
      "melitta",
      "en",
    );
    expect(served.processDescription).toBe("The machine is preparing a drink.");
    expect(served.activityDescription).toBe("Grinding beans from the selected hopper.");
    // The label keyspace is untouched by the .description keys.
    expect(served.statusLabel).toBe("Brewing");
    expect(served.activityLabel).toBe("Grinding");
  });

  it("descriptions are looked up by exact key — a missing one is not an error", () => {
    setServerStrings({ "status.process.READY.description": "The machine is on and ready to brew." });
    const ready = deriveMachineStatus(tokenEntities(), "melitta", "en");
    expect(ready.processDescription).toBe("The machine is on and ready to brew.");
    expect(ready.activityDescription).toBeNull();
    const cleaning = deriveMachineStatus(
      tokenEntities({ process_token: "CLEANING" }),
      "melitta",
      "en",
    );
    expect(cleaning.processDescription).toBeNull();
  });

  it("an unmapped raw code borrows BUSY's description, mirroring its label", () => {
    setServerStrings({ "status.process.BUSY.description": "The machine is working. Wait for it to finish." });
    const view = deriveMachineStatus(tokenEntities({ process_token: null }), "melitta", "en");
    expect(view.statusLabel).toBe("Busy");
    expect(view.processDescription).toBe("The machine is working. Wait for it to finish.");
  });

  it("null sub-process token means idle (null activity)", () => {
    expect(deriveMachineStatus(tokenEntities(), "melitta", "en").activityLabel).toBeNull();
  });

  it("unavailable state sensor with a live bridge IS the offline signal (§3.4)", () => {
    const view = deriveMachineStatus(
      makeEntities({
        state: "unavailable",
        bridgeAttrs: { ...BRIDGE_V1, connected: false },
      }),
      "melitta",
      "en",
    );
    expect(view.source).toBe("tokens");
    expect(view.offline).toBe(true);
    expect(view.connected).toBe(false);
    expect(view.hasAction).toBe(false);
  });

  it("derives connected from the bridge boolean, not the sensor string", () => {
    const view = deriveMachineStatus(
      tokenEntities({}, { connection: "Disconnected" }),
      "melitta",
      "en",
    );
    // bridge says connected: true even though the (stale) string differs
    expect(view.connected).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Navigation lock (App tab gate)
// ---------------------------------------------------------------------------

describe("isNavigationLocked", () => {
  it("unlocks for ready and offline, locks otherwise (legacy parity)", () => {
    const ready = deriveMachineStatus(tokenEntities(), "melitta", "en");
    expect(isNavigationLocked(ready)).toBe(false);

    const offline = deriveMachineStatus(makeEntities({ state: null }), "melitta", "en");
    expect(isNavigationLocked(offline)).toBe(false);

    const brewing = deriveMachineStatus(
      tokenEntities({ process_token: "PRODUCT", is_brewing: true }),
      "melitta",
      "en",
    );
    expect(isNavigationLocked(brewing)).toBe(true);

    const off = deriveMachineStatus(tokenEntities({ process_token: "SWITCH_OFF" }), "melitta", "en");
    expect(isNavigationLocked(off)).toBe(true);

    const action = deriveMachineStatus(
      tokenEntities({ manipulation_token: "FILL_WATER" }),
      "melitta",
      "en",
    );
    expect(isNavigationLocked(action)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Capability-gated sections (§3.5)
// ---------------------------------------------------------------------------

describe("sectionGates", () => {
  it("shows every section without a contract (legacy behavior)", () => {
    expect(sectionGates(null)).toEqual({ freestyle: true, stats: true });
  });

  it("gates freestyle and stats on the contract capabilities", () => {
    expect(sectionGates(MELITTA_CONTRACT)).toEqual({ freestyle: true, stats: true });
    const nivonaLike = clone(MELITTA_CONTRACT);
    nivonaLike.capabilities.supports_freestyle = false;
    nivonaLike.capabilities.supports_stats = false;
    expect(sectionGates(nivonaLike)).toEqual({ freestyle: false, stats: false });
  });
});
