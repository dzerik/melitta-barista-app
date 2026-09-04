/**
 * Served machine-state descriptions in the status surfaces (§6.3.7).
 *
 * The overlay's second line is machine-domain wording: the integration now
 * serves `status.process.<TOKEN>.description` and
 * `status.sub_process.<TOKEN>.description`, and the app's own `status.*_desc`
 * bundle entries stay as the tier-2 fallback (offline use, pre-0.94 servers).
 * These tests pin both tiers and the unchanged action-required branch, for
 * the full-screen StatusOverlay and for BrewSection's service-cycle screen
 * (whose sublabel is the same machine-domain sentence).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import type { Connection, HassEntities } from "home-assistant-js-websocket";
import { renderWithProviders } from "./test-utils";
import { StatusOverlay } from "../src/components/StatusOverlay";
import { BrewSection } from "../src/components/BrewSection";
import { setServerStrings, resetServerStrings } from "../src/lib/server-strings";

const CTX = { id: "", user_id: null, parent_id: null };

function ent(state: string, attributes: Record<string, unknown> = {}) {
  return { entity_id: "", state, attributes, last_changed: "", last_updated: "", context: CTX };
}

const BRIDGE_V1 = {
  entry_id: "e1",
  contract_version: 1,
  contract_fingerprint: "abc123",
  connected: true,
};

function entities(tokens: Record<string, unknown> = {}): HassEntities {
  return {
    "sensor.melitta_connection": ent("Connected", BRIDGE_V1),
    "sensor.melitta_state": ent("Ready", {
      process_id: 4,
      process_token: "READY",
      sub_process_token: null,
      manipulation_token: "NONE",
      is_brewing: false,
      awaiting_confirmation: false,
      info_messages: [],
      ...tokens,
    }),
  } as unknown as HassEntities;
}

const conn = { sendMessagePromise: async () => ({}) } as unknown as Connection;

function renderOverlay(tokens: Record<string, unknown>) {
  return renderWithProviders(
    <StatusOverlay entities={entities(tokens)} prefix="melitta" conn={conn} />,
  );
}

beforeEach(() => {
  resetServerStrings();
});

describe("StatusOverlay descriptions", () => {
  it("shows the app's own copy when the server serves no description", () => {
    renderOverlay({ process_token: "SWITCH_OFF" });
    expect(screen.getByText("Machine is turned off.")).toBeInTheDocument();
  });

  it("prefers the served process description (§6.3.7)", () => {
    setServerStrings({ "status.process.SWITCH_OFF.description": "The machine is switched off." });
    renderOverlay({ process_token: "SWITCH_OFF" });
    expect(screen.getByText("The machine is switched off.")).toBeInTheDocument();
    expect(screen.queryByText("Machine is turned off.")).not.toBeInTheDocument();
  });

  it("brewing: the served sub-process description beats the bare activity label", () => {
    setServerStrings({
      "status.process.PRODUCT.description": "The machine is preparing a drink.",
      "status.sub_process.GRINDING.description": "Grinding beans from the selected hopper.",
    });
    renderOverlay({ process_token: "PRODUCT", is_brewing: true, sub_process_token: "GRINDING" });
    expect(screen.getByText("Grinding beans from the selected hopper.")).toBeInTheDocument();
  });

  it("brewing: keeps the activity label when only the sub-process description is missing", () => {
    setServerStrings({ "status.process.PRODUCT.description": "The machine is preparing a drink." });
    renderOverlay({ process_token: "PRODUCT", is_brewing: true, sub_process_token: "GRINDING" });
    expect(screen.getByText("Grinding")).toBeInTheDocument();
  });

  it("brewing without a sub-process falls back to the process description", () => {
    setServerStrings({ "status.process.PRODUCT.description": "The machine is preparing a drink." });
    renderOverlay({ process_token: "PRODUCT", is_brewing: true });
    expect(screen.getByText("The machine is preparing a drink.")).toBeInTheDocument();
  });

  it("action-required keeps the manipulation title, descriptions notwithstanding", () => {
    setServerStrings({
      "status.process.READY.description": "The machine is on and ready to brew.",
      "status.manipulation.FILL_WATER": "Refill the water tank",
    });
    renderOverlay({ manipulation_token: "FILL_WATER" });
    expect(screen.getByText("Refill the water tank")).toBeInTheDocument();
    expect(
      screen.queryByText("The machine is on and ready to brew."),
    ).not.toBeInTheDocument();
  });
});

describe("BrewSection service screen sublabel", () => {
  function renderService(tokens: Record<string, unknown>) {
    return renderWithProviders(
      <BrewSection conn={conn} entities={entities(tokens)} prefix="melitta" />,
    );
  }

  it("keeps the app's own sublabel when the server serves no description", () => {
    renderService({ process_token: "DESCALING" });
    expect(screen.getByText("Descaling cycle in progress")).toBeInTheDocument();
  });

  it("prefers the served process description for the running cycle", () => {
    setServerStrings({
      "status.process.DESCALING.description":
        "A descaling cycle is running. Leave the machine on until it finishes.",
    });
    renderService({ process_token: "DESCALING" });
    expect(
      screen.getByText("A descaling cycle is running. Leave the machine on until it finishes."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Descaling cycle in progress")).not.toBeInTheDocument();
  });
});
