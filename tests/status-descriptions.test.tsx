/**
 * Served machine-state descriptions in the status surfaces (§6.3.7), plus the
 * StatusOverlay's rebuilt visual contract.
 *
 * The overlay's second line is machine-domain wording: the integration serves
 * `status.process.<TOKEN>.description`, and the app's own `status.*_desc`
 * bundle entries stay as the tier-2 fallback (offline use, pre-0.94 servers).
 * These tests pin both tiers and the unchanged action-required branch, for
 * the full-screen StatusOverlay and for BrewSection's service-cycle screen
 * (whose sublabel is the same machine-domain sentence).
 *
 * The middle block pins C1: the overlay draws the states in which the MACHINE
 * has the floor — a prompt, a fault, a switched-off machine, a running service
 * programme — and it no longer competes for `view.brewing`, which BrewSection
 * owns (owner decision 4). The last block pins the geometry that is left: a
 * known-duration maintenance programme is the desaturated tick ring, and
 * nothing anywhere carries a radius, a ring, a shadow or an undeclared fill.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import type { Connection, HassEntities } from "home-assistant-js-websocket";
import { renderWithProviders } from "./test-utils";
import { StatusOverlay } from "../src/components/StatusOverlay";
import { BrewSection } from "../src/components/BrewSection";
import { setServerStrings, resetServerStrings } from "../src/lib/server-strings";
import { assertHardRules } from "./hard-rules";

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

/* ══════════════════════════════════════════════════════════════════════
   C1 — one brewing takeover, and it is not this one
   ══════════════════════════════════════════════════════════════════════ */

describe("StatusOverlay yields the pour to BrewSection (C1)", () => {
  it("renders nothing at all while the machine is brewing", () => {
    setServerStrings({ "status.process.PRODUCT.description": "The machine is preparing a drink." });
    const { container } = renderOverlay({
      process_token: "PRODUCT",
      is_brewing: true,
      sub_process_token: "GRINDING",
    });

    expect(container).toBeEmptyDOMElement();
    // The portal writes to document.body, so absence has to be asserted there.
    expect(document.querySelector('[data-fill="scrim"]')).toBeNull();
    expect(screen.queryByText("The machine is preparing a drink.")).toBeNull();
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
    expect(document.querySelector('[data-ui="meter"]')).toBeNull();
  });

  it("does not re-take the screen for a brewing machine on an unknown token", () => {
    // The unknown-token branch renders neutral "busy" (§5.3.2 rule 2), and a
    // brewing machine outside the v1 vocabulary hits both. The brewing guard
    // is tested FIRST precisely so this cannot put a scrim over the pour.
    renderOverlay({ process_token: "NOT_IN_VOCAB", is_brewing: true });
    expect(document.querySelector('[data-fill="scrim"]')).toBeNull();
  });

  it("still surfaces a fault raised during a pour, and only the fault", () => {
    renderOverlay({
      process_token: "PRODUCT",
      is_brewing: true,
      manipulation_token: "FILL_WATER",
    });

    expect(screen.getByText("Action required")).toBeInTheDocument();
    // No abort circle and no progress furniture ride along with it: the fault
    // screen is one thing, not the old takeover wearing a different title.
    expect(document.querySelector('[data-ui="abort-circle"]')).toBeNull();
    expect(document.querySelector('[data-ui="meter"]')).toBeNull();
    expect(document.querySelector('[data-ui="tick-ring"]')).toBeNull();
  });
});

/* ══════════════════════════════════════════════════════════════════════
   The rebuilt visual contract (the two hard rules + owner decision 4)
   ══════════════════════════════════════════════════════════════════════ */



describe("StatusOverlay — the rebuilt visual contract", () => {
  function renderWithProgress(tokens: Record<string, unknown>, progress: string) {
    const withProgress = {
      ...entities(tokens),
      "sensor.melitta_progress": ent(progress),
    } as unknown as HassEntities;
    return renderWithProviders(
      <StatusOverlay entities={withProgress} prefix="melitta" conn={conn} />,
    );
  }

  it("draws no progress form for a pour, with or without a served figure", () => {
    // The bottom-pinned meter went to BrewSection with the rest of the
    // takeover (C1); a reported figure no longer pulls this portal open.
    renderWithProgress({ process_token: "PRODUCT", is_brewing: true }, "40");

    expect(document.querySelector('[data-ui="meter"]')).toBeNull();
    expect(document.querySelector('[data-ui="tick-ring"]')).toBeNull();
    expect(document.body.innerHTML).not.toMatch(/amber/);
    assertHardRules(document.body);
  });

  it("spends no saturated fill on any screen it still draws", () => {
    // The abort circle was the overlay's one `data-fill="commit"`, and it left
    // with the takeover. What remains — prompt, fault, off, service — commits
    // to nothing, so the scrim is the only fill on the screen.
    renderWithProgress({ process_token: "DESCALING" }, "50");
    expect(document.querySelectorAll('[data-fill="commit"]')).toHaveLength(0);
    expect(document.querySelector('[data-ui="abort-circle"]')).toBeNull();
  });

  it("gives a known-duration maintenance programme the desaturated tick ring", () => {
    renderWithProgress({ process_token: "DESCALING" }, "50");

    const ring = document.querySelector('[data-ui="tick-ring"]')!;
    expect(ring).toBeTruthy();
    expect(ring.getAttribute("data-completed")).toBe("45");
    // §9.4: service progress is --text-secondary, never the accent.
    expect(ring.querySelector('[data-tick="done"]')).toHaveAttribute(
      "fill",
      "var(--text-secondary)",
    );
    expect(document.querySelector('[data-ui="meter"]')).toBeNull();
    assertHardRules(document.body);
  });

  it("keeps the action-required screen bare — no progress furniture at all", () => {
    renderOverlay({ manipulation_token: "FILL_WATER" });

    expect(document.querySelector('[data-ui="meter"]')).toBeNull();
    expect(document.querySelector('[data-ui="tick-ring"]')).toBeNull();
    expect(document.querySelectorAll("[data-fill]")).toHaveLength(1); // the scrim
    assertHardRules(document.body);
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