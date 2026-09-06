/**
 * Served machine-state descriptions in the status surfaces (§6.3.7), plus the
 * StatusOverlay's rebuilt visual contract.
 *
 * The overlay's second line is machine-domain wording: the integration now
 * serves `status.process.<TOKEN>.description` and
 * `status.sub_process.<TOKEN>.description`, and the app's own `status.*_desc`
 * bundle entries stay as the tier-2 fallback (offline use, pre-0.94 servers).
 * These tests pin both tiers and the unchanged action-required branch, for
 * the full-screen StatusOverlay and for BrewSection's service-cycle screen
 * (whose sublabel is the same machine-domain sentence).
 *
 * The last block pins the geometry the overlay was rebuilt to (owner decision
 * 4): a pour is the bottom-pinned segmented meter with one labelled abort
 * circle, a known-duration maintenance programme is the desaturated tick ring,
 * and nothing anywhere carries a radius, a ring, a shadow or an undeclared
 * fill.
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

/* ══════════════════════════════════════════════════════════════════════
   The rebuilt visual contract (the two hard rules + owner decision 4)
   ══════════════════════════════════════════════════════════════════════ */

/** Fills the language permits; each must announce itself with `data-fill`. */
const CARVE_OUTS = new Set([
  "commit",
  "meter",
  "glow",
  "contact",
  "rule",
  "scrim",
  "panel",
]);

/**
 * Walk a rendered tree and assert the two hard rules on every node: radius 0
 * (a true circle — width === height — being the only curve), no fill that has
 * not declared itself a carve-out, no ring, no shadow, no tracked-out caps,
 * and `backdrop-blur` only on a scrim.
 */
function assertHardRules(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>("*").forEach((el) => {
    const cls = String(el.className);
    const radius = el.style?.borderRadius ?? "";
    if (radius !== "" && radius !== "0px") {
      expect(radius, `${el.tagName} draws a curve that is not a circle`).toBe("50%");
      expect(el.style.width).toBe(el.style.height);
    }
    expect(cls).not.toMatch(/(^|\s)rounded/);
    expect(cls).not.toMatch(/(^|\s)ring-/);
    expect(cls).not.toMatch(/shadow-|tracking-|uppercase/);
    if (/backdrop-blur/.test(cls)) {
      expect(el.getAttribute("data-fill")).toBe("scrim");
    }
    const shadow = el.style?.boxShadow ?? "";
    if (shadow !== "") expect(shadow).toBe("none");

    const painted =
      (el.style?.backgroundColor ?? "") !== "" ||
      (el.style?.backgroundImage ?? "") !== "";
    if (!painted) return;
    const declared = el.getAttribute("data-fill");
    expect(
      declared !== null && CARVE_OUTS.has(declared),
      `${el.tagName} paints without declaring a carve-out (data-fill=${declared})`,
    ).toBe(true);
  });
}

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

  it("draws a pour as the segmented meter — no ring, no capsule, no amber", () => {
    renderWithProgress({ process_token: "PRODUCT", is_brewing: true }, "40");

    const meter = document.querySelector('[data-ui="meter"]')!;
    expect(meter).toBeTruthy();
    // round(0.40 × 12) segments painted, the paint IS the value.
    expect(meter.getAttribute("data-filled")).toBe("5");
    expect(meter.getAttribute("data-segments")).toBe("12");
    expect(document.querySelector('[data-ui="tick-ring"]')).toBeNull();
    expect(document.body.innerHTML).not.toMatch(/amber/);
    assertHardRules(document.body);
  });

  it("collapses to one labelled abort: a true circle with its word outside it", () => {
    renderWithProgress({ process_token: "PRODUCT", is_brewing: true }, "40");

    const cancel = screen.getByRole("button", { name: "Cancel" });
    expect(cancel.className).toContain("tap");
    expect(cancel.className).toContain("press");
    // The word is a sibling of the circle, never inside it.
    const circle = cancel.querySelector<HTMLElement>('[data-ui="abort-circle"]')!;
    expect(circle.style.backgroundColor).toBe("var(--error-text)");
    expect(circle.style.borderRadius).toBe("50%");
    expect(circle.style.width).toBe(circle.style.height);
    expect(circle).toHaveAttribute("data-fill", "commit");
    expect(circle.textContent).toBe("");
    // Exactly one saturated shape on the whole screen.
    expect(document.querySelectorAll('[data-fill="commit"]')).toHaveLength(1);
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
