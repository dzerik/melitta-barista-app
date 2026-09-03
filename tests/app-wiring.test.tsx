/**
 * Zone P-I — app-level wiring (UI Contract §2.3, §5.4, §6.3.2, §10.2 P-I).
 *
 * useUiContract lifecycle: bridge detection, version gate + mismatch latch,
 * fetch/cache/refetch, bounded transient retry, last-good persistence.
 * App wiring: mismatch screens, capability-gated tabs, contract props
 * threading into the sections, the i18n/get trigger, the stale banner.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { screen, waitFor, renderHook, act } from "@testing-library/react";
import type { Connection, HassEntities, HassEntity } from "home-assistant-js-websocket";
import { renderWithProviders } from "./test-utils";
import App from "../src/App";
import { useUiContract } from "../src/hooks/useUiContract";
import {
  resetContractSession,
  persistLastGoodContract,
  type UiContract,
} from "../src/lib/contract";
import { resetServerStrings, resetVocab } from "../src/lib/server-strings";
import {
  MELITTA_CONTRACT_FULL,
  NIVONA_CONTRACT_FULL,
} from "./fixtures/contracts";

// ---------------------------------------------------------------------------
// Section stubs — App wiring is what's under test, not the sections
// ---------------------------------------------------------------------------

vi.mock("../src/components/BrewSection", () => ({
  BrewSection: ({ contract }: { contract?: UiContract | null }) => (
    <div data-testid="section-brew" data-contract={contract?.contract_fingerprint ?? "null"} />
  ),
}));
vi.mock("../src/components/FreestyleSection", () => ({
  FreestyleSection: ({ contract }: { contract?: UiContract | null }) => (
    <div data-testid="section-freestyle" data-contract={contract?.contract_fingerprint ?? "null"} />
  ),
}));
vi.mock("../src/components/SommelierSection", () => ({
  SommelierSection: ({ contract }: { contract?: UiContract | null }) => (
    <div data-testid="section-sommelier" data-contract={contract?.contract_fingerprint ?? "null"} />
  ),
}));
vi.mock("../src/components/StatsSection", () => ({
  StatsSection: () => <div data-testid="section-stats" />,
}));
vi.mock("../src/components/MaintenanceSection", () => ({
  MaintenanceSection: ({ contract }: { contract?: UiContract | null }) => (
    <div data-testid="section-maintenance" data-contract={contract?.contract_fingerprint ?? "null"} />
  ),
}));
vi.mock("../src/components/SettingsSection", () => ({
  SettingsSection: ({ contract }: { contract?: UiContract | null }) => (
    <div data-testid="section-settings" data-contract={contract?.contract_fingerprint ?? "null"} />
  ),
}));
vi.mock("../src/components/StatusBar", () => ({
  StatusBar: () => <div data-testid="status-bar" />,
}));
vi.mock("../src/components/StatusOverlay", () => ({
  StatusOverlay: () => null,
}));

// useHA is replaced with a mutable holder each App test fills in.
const ha = vi.hoisted(() => ({
  current: null as unknown as Record<string, unknown>,
}));
vi.mock("../src/hooks/useHA", () => ({ useHA: () => ha.current }));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function ent(state: string, attributes: Record<string, unknown> = {}): HassEntity {
  return {
    entity_id: "",
    state,
    attributes,
    last_changed: "",
    last_updated: "",
    context: { id: "", user_id: null, parent_id: null },
  } as unknown as HassEntity;
}

/** Entities carrying a §3.4 bridge block on the connection sensor. */
function bridgeEntities(attrs: Record<string, unknown> = {}): HassEntities {
  return {
    "sensor.melitta_connection": ent("Connected", {
      entry_id: MELITTA_CONTRACT_FULL.entry_id,
      contract_version: 1,
      contract_fingerprint: MELITTA_CONTRACT_FULL.contract_fingerprint,
      connected: true,
      ...attrs,
    }),
  };
}

type WsMsg = { type: string; [key: string]: unknown };

/** Connection stub: routes ui_contract/get through `contractHandler`, answers i18n/get. */
function makeConn(contractHandler: (msg: WsMsg) => Promise<unknown>): Connection {
  const sendMessagePromise = vi.fn((msg: WsMsg) => {
    if (msg.type === "melitta_barista/ui_contract/get") return contractHandler(msg);
    if (msg.type === "melitta_barista/i18n/get") {
      return Promise.resolve({ strings_version: "0.93.0", strings: {} });
    }
    return Promise.resolve({});
  });
  return { sendMessagePromise } as unknown as Connection;
}

function contractCalls(conn: Connection): WsMsg[] {
  return (conn.sendMessagePromise as ReturnType<typeof vi.fn>).mock.calls
    .map((c) => c[0] as WsMsg)
    .filter((m) => m.type === "melitta_barista/ui_contract/get");
}

function connectedHA(conn: Connection, entities: HassEntities) {
  return {
    status: "connected",
    connection: conn,
    entities,
    prefix: "melitta",
    error: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
}

beforeEach(() => {
  localStorage.clear();
  resetContractSession();
  resetServerStrings();
  resetVocab();
});

// ---------------------------------------------------------------------------
// useUiContract — fetch lifecycle (§2.3) + §5.4 gate
// ---------------------------------------------------------------------------

describe("useUiContract", () => {
  it("fetches the contract for a supported bridge and exposes it live", async () => {
    const conn = makeConn(() => Promise.resolve(MELITTA_CONTRACT_FULL));
    const { result } = renderHook(() =>
      useUiContract(conn, bridgeEntities(), "melitta"),
    );
    await waitFor(() => expect(result.current.contract).not.toBeNull());
    expect(result.current.contract).toEqual(MELITTA_CONTRACT_FULL);
    expect(result.current.stale).toBe(false);
    expect(result.current.mismatch).toBeNull();
    expect(result.current.stringsVersion).toBe("0.93.0");
    expect(contractCalls(conn)).toEqual([
      {
        type: "melitta_barista/ui_contract/get",
        entry_id: MELITTA_CONTRACT_FULL.entry_id,
      },
    ]);
  });

  it("no connection sensor at all (demo) → inert legacy session, no gate, no fetch", async () => {
    const conn = makeConn(() => Promise.resolve(MELITTA_CONTRACT_FULL));
    const { result } = renderHook(() => useUiContract(conn, {}, "melitta"));
    await act(async () => {});
    expect(result.current.mismatch).toBeNull();
    expect(result.current.contract).toBeNull();
    expect(contractCalls(conn)).toHaveLength(0);
  });

  it("pre-contract connection sensor (no contract attributes) → update_integration, no fetch", async () => {
    const conn = makeConn(() => Promise.resolve(MELITTA_CONTRACT_FULL));
    const entities: HassEntities = {
      "sensor.melitta_connection": ent("Connected", { friendly_name: "connection" }),
    };
    const { result } = renderHook(() => useUiContract(conn, entities, "melitta"));
    await act(async () => {});
    expect(result.current.mismatch).toBe("update_integration");
    expect(contractCalls(conn)).toHaveLength(0);
  });

  it("bridge contract_version above the supported set → update_app, no fetch", async () => {
    const conn = makeConn(() => Promise.resolve(MELITTA_CONTRACT_FULL));
    const { result } = renderHook(() =>
      useUiContract(conn, bridgeEntities({ contract_version: 2 }), "melitta"),
    );
    await act(async () => {});
    expect(result.current.mismatch).toBe("update_app");
    expect(contractCalls(conn)).toHaveLength(0);
  });

  it("durable unknown_command → update_integration latch", async () => {
    const conn = makeConn(() => Promise.reject({ code: "unknown_command" }));
    const { result } = renderHook(() =>
      useUiContract(conn, bridgeEntities(), "melitta"),
    );
    await waitFor(() => expect(result.current.mismatch).toBe("update_integration"));
  });

  it("transient failure retries once per connected false→true transition (§2.3.5)", async () => {
    let fail = true;
    const conn = makeConn(() =>
      fail
        ? Promise.reject({ code: "contract_not_ready" })
        : Promise.resolve(MELITTA_CONTRACT_FULL),
    );
    const { result, rerender } = renderHook(
      ({ entities }: { entities: HassEntities }) =>
        useUiContract(conn, entities, "melitta"),
      { initialProps: { entities: bridgeEntities() } },
    );
    await waitFor(() => expect(contractCalls(conn)).toHaveLength(1));
    expect(result.current.contract).toBeNull();

    fail = false;
    // connected true→false→true: exactly one bounded retry.
    rerender({ entities: bridgeEntities({ connected: false }) });
    await act(async () => {});
    expect(contractCalls(conn)).toHaveLength(1);
    rerender({ entities: bridgeEntities({ connected: true }) });
    await waitFor(() => expect(result.current.contract).not.toBeNull());
    expect(contractCalls(conn)).toHaveLength(2);
    expect(result.current.stale).toBe(false);
  });

  it("a contract_fingerprint change refetches (session cache keyed on it, §2.3.4)", async () => {
    const doc2: UiContract = { ...MELITTA_CONTRACT_FULL, contract_fingerprint: "ffff00001111" };
    let doc: UiContract = MELITTA_CONTRACT_FULL;
    const conn = makeConn(() => Promise.resolve(doc));
    const { result, rerender } = renderHook(
      ({ entities }: { entities: HassEntities }) =>
        useUiContract(conn, entities, "melitta"),
      { initialProps: { entities: bridgeEntities() } },
    );
    await waitFor(() =>
      expect(result.current.contract?.contract_fingerprint).toBe(
        MELITTA_CONTRACT_FULL.contract_fingerprint,
      ),
    );
    doc = doc2;
    rerender({ entities: bridgeEntities({ contract_fingerprint: "ffff00001111" }) });
    await waitFor(() =>
      expect(result.current.contract?.contract_fingerprint).toBe("ffff00001111"),
    );
    expect(contractCalls(conn)).toHaveLength(2);
  });

  it("persisted last-good renders stale-marked while the fetch keeps failing (§5.4)", async () => {
    persistLastGoodContract(MELITTA_CONTRACT_FULL);
    const conn = makeConn(() => Promise.reject({ code: "contract_not_ready" }));
    const { result } = renderHook(() =>
      useUiContract(conn, bridgeEntities(), "melitta"),
    );
    await waitFor(() => expect(result.current.contract).not.toBeNull());
    expect(result.current.stale).toBe(true);
    expect(result.current.contract).toEqual(MELITTA_CONTRACT_FULL);
    // The persisted document still feeds strings revalidation.
    expect(result.current.stringsVersion).toBe("0.93.0");
  });

  it("a supported bridge latches: transient attribute loss neither shows the mismatch screen nor drops the document", async () => {
    const conn = makeConn(() => Promise.resolve(MELITTA_CONTRACT_FULL));
    const { result, rerender } = renderHook(
      ({ entities }: { entities: HassEntities }) =>
        useUiContract(conn, entities, "melitta"),
      { initialProps: { entities: bridgeEntities() } },
    );
    await waitFor(() => expect(result.current.contract).not.toBeNull());
    rerender({
      entities: {
        "sensor.melitta_connection": ent("unavailable", {}),
      },
    });
    await act(async () => {});
    expect(result.current.mismatch).toBeNull();
    expect(result.current.contract).toEqual(MELITTA_CONTRACT_FULL);
  });
});

// ---------------------------------------------------------------------------
// App wiring — §5.4 screens, gated tabs, props threading, i18n trigger
// ---------------------------------------------------------------------------

describe("App wiring", () => {
  it("v2 bridge → the 'update the app' screen, no sections", async () => {
    const conn = makeConn(() => Promise.resolve(MELITTA_CONTRACT_FULL));
    ha.current = connectedHA(conn, bridgeEntities({ contract_version: 2 }));
    renderWithProviders(<App />);
    expect(await screen.findByText("Update the app")).toBeInTheDocument();
    expect(screen.queryByTestId("section-brew")).toBeNull();
  });

  it("pre-contract bridge → the 'update the integration' screen (§5.4 PWA rule)", async () => {
    const conn = makeConn(() => Promise.resolve(MELITTA_CONTRACT_FULL));
    ha.current = connectedHA(conn, {
      "sensor.melitta_connection": ent("Connected", { friendly_name: "connection" }),
    });
    renderWithProviders(<App />);
    expect(await screen.findByText("Update the integration")).toBeInTheDocument();
    expect(screen.queryByTestId("section-brew")).toBeNull();
  });

  it("no connection sensor (demo-style session): all six tabs, sections get a null contract", async () => {
    const conn = makeConn(() => Promise.resolve(MELITTA_CONTRACT_FULL));
    ha.current = connectedHA(conn, { "sensor.melitta_state": ent("Ready") });
    renderWithProviders(<App />);
    await act(async () => {});
    expect(screen.getAllByRole("button")).toHaveLength(6);
    expect(screen.getByTestId("section-brew").dataset.contract).toBe("null");
    expect(screen.getByTestId("section-stats")).toBeInTheDocument();
  });

  it("Nivona contract gates the freestyle tab (§3.5) and threads the contract to sections", async () => {
    const conn = makeConn(() => Promise.resolve(NIVONA_CONTRACT_FULL));
    ha.current = connectedHA(conn, {
      "sensor.melitta_connection": ent("Connected", {
        entry_id: NIVONA_CONTRACT_FULL.entry_id,
        contract_version: 1,
        contract_fingerprint: NIVONA_CONTRACT_FULL.contract_fingerprint,
        connected: true,
      }),
    });
    renderWithProviders(<App />);
    await waitFor(() =>
      expect(screen.getByTestId("section-settings").dataset.contract).toBe(
        NIVONA_CONTRACT_FULL.contract_fingerprint,
      ),
    );
    // §3.8 Nivona: supports_freestyle false, supports_stats true → 5 tabs.
    expect(screen.getAllByRole("button")).toHaveLength(5);
    expect(screen.queryByTestId("section-freestyle")).toBeNull();
    expect(screen.getByTestId("section-stats")).toBeInTheDocument();
    expect(screen.getByTestId("section-sommelier").dataset.contract).toBe(
      NIVONA_CONTRACT_FULL.contract_fingerprint,
    );
  });

  it("fires one i18n/get for the active locale (§6.3.2 trigger)", async () => {
    const conn = makeConn(() => Promise.resolve(MELITTA_CONTRACT_FULL));
    ha.current = connectedHA(conn, bridgeEntities());
    renderWithProviders(<App />);
    await waitFor(() => {
      const i18nCalls = (conn.sendMessagePromise as ReturnType<typeof vi.fn>).mock.calls
        .map((c) => c[0] as WsMsg)
        .filter((m) => m.type === "melitta_barista/i18n/get");
      expect(i18nCalls).toEqual([
        { type: "melitta_barista/i18n/get", locale: "en" },
      ]);
    });
  });

  it("shows the stale banner while rendering the persisted last-good contract", async () => {
    persistLastGoodContract(MELITTA_CONTRACT_FULL);
    const conn = makeConn(() => Promise.reject({ code: "contract_not_ready" }));
    ha.current = connectedHA(conn, bridgeEntities());
    renderWithProviders(<App />);
    expect(
      await screen.findByText(
        "No live connection to the machine — showing the last known data.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByTestId("section-brew").dataset.contract).toBe(
      MELITTA_CONTRACT_FULL.contract_fingerprint,
    );
  });
});
