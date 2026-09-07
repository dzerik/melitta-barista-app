/**
 * BrewSection's side of the two findings that had no test at all.
 *
 * C1 — THE ONE BREWING TAKEOVER. Two components used to draw `view.brewing`:
 * this one, and a z-50 `StatusOverlay` portal that mounted on top of it. The
 * portal always won, so the screen the language actually specifies was never
 * seen and nothing pinned it. The portal's brewing branch is gone (pinned from
 * the other side in `status-descriptions.test.tsx`); these tests pin what is
 * left, which is now the whole of what a user sees during a pour.
 *
 * H12 — SELECTION IS NEVER A FILL. The list view said "chosen" with a 2px
 * `--accent` gutter painted down the row. Owner decision 1 fixes selection for
 * every control in the app as one mark — the name in `--text-primary` over a
 * lit 1px `--accent` underline in an always-reserved slot — and these assert
 * the list row now draws exactly what the grid cell draws.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import type { Connection, HassEntities } from "home-assistant-js-websocket";
import { renderWithProviders } from "./test-utils";
import { BrewSection } from "../src/components/BrewSection";
import { assertHardRules } from "./hard-rules";

const CTX = { id: "", user_id: null, parent_id: null };

function ent(state: string, attributes: Record<string, unknown> = {}) {
  return { entity_id: "", state, attributes, last_changed: "", last_updated: "", context: CTX };
}

const CAPPUCCINO = {
  c1_process: "coffee",
  c1_intensity: "strong",
  c1_aroma: "standard",
  c1_temperature: "normal",
  c1_shots: 2,
  c1_portion_ml: 40,
  c2_process: "milk",
  c2_intensity: "medium",
  c2_aroma: "standard",
  c2_temperature: "normal",
  c2_shots: 0,
  c2_portion_ml: 120,
};

const conn = { sendMessagePromise: async () => ({}) } as unknown as Connection;

/** A machine with two recipes, "Cappuccino" chosen, in whatever process. */
function machine(
  tokens: Record<string, unknown>,
  extra: Record<string, unknown> = {},
): HassEntities {
  return {
    "sensor.melitta_connection": ent("Connected", {
      entry_id: "e1",
      contract_version: 1,
      contract_fingerprint: "abc123",
      connected: true,
    }),
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
    "select.melitta_recipe": ent("Cappuccino", {
      options: ["Espresso", "Cappuccino"],
      recipes: { Cappuccino: CAPPUCCINO },
    }),
    ...extra,
  } as unknown as HassEntities;
}

beforeEach(() => {
  localStorage.clear();
});



describe("BrewSection owns the pour (C1)", () => {
  function renderBrewing(progress?: string) {
    const extra = progress === undefined ? {} : { "sensor.melitta_progress": ent(progress) };
    return renderWithProviders(
      <BrewSection
        conn={conn}
        entities={machine(
          { process_token: "PRODUCT", is_brewing: true, sub_process_token: "GRINDING" },
          extra,
        )}
        prefix="melitta"
      />,
    );
  }

  it("keeps the drink, its name and its composition on screen", () => {
    const { container } = renderBrewing("40");

    // The drink is the CHOSEN RECIPE. This screen used to hand the
    // sub-process label ("Grinding") to CoffeeIcon as though it were a drink
    // name, which matches nothing in the image table and fell through to the
    // freestyle placeholder — invisible for as long as the portal covered it.
    expect(container.querySelector('img[alt="Cappuccino"]')).toBeInTheDocument();
    expect(container.querySelector('img[alt="Grinding"]')).toBeNull();

    // Its name, at the largest step on its own screen (§7.2)…
    const name = screen.getByText("Cappuccino");
    expect(name.className).toContain("t-title");

    // …its composition, as the one value strip…
    const strip = container.querySelector('[data-ui="value-strip"]')!;
    expect(strip).toBeTruthy();
    expect(strip.textContent).toContain("120");

    // …and the activity as the SMALLEST white text on a busy screen (§7.4).
    const status = screen.getByText("Grinding");
    expect(status.className).toContain("t-label");
    expect(status.className).not.toContain("t-title");
  });

  it("adds a bottom-pinned segmented meter and no other progress form", () => {
    const { container } = renderBrewing("40");

    const meter = container.querySelector('[data-ui="meter"]')!;
    expect(meter).toBeTruthy();
    // round(0.40 × 12) segments painted — the paint IS the value.
    expect(meter.getAttribute("data-filled")).toBe("5");
    expect(meter.getAttribute("data-segments")).toBe("12");
    // A pour's end is only ever ESTIMATED, so it never gets the tick ring…
    expect(container.querySelector('[data-ui="tick-ring"]')).toBeNull();
    // …and never a numeric readout beside it (the C18 rule, settled once).
    expect(container.textContent).not.toMatch(/\d+\s*%/);
  });

  it("draws no meter at all when the machine reports no figure", () => {
    const { container } = renderBrewing();
    expect(container.querySelector('[data-ui="meter"]')).toBeNull();
    expect(container.querySelector('[data-ui="tick-ring"]')).toBeNull();
  });

  it("collapses to one labelled abort: a true circle with its word outside it", () => {
    const { container } = renderBrewing("40");

    const cancel = screen.getByRole("button", { name: "Cancel" });
    expect(cancel.className).toContain("tap");
    expect(cancel.className).toContain("press");
    // It is the shared `Word`, not a ninth hand-rolled copy of one (C5)…
    expect(cancel.getAttribute("data-ui")).toBe("word");
    // …so it wears no underline: that mark means "chosen", and an ACTION
    // is not chosen.
    expect(cancel.style.borderBottomStyle).toBe("");
    expect(cancel.style.borderBottomColor).toBe("");

    // The word is a sibling of the circle, never inside it.
    const circle = cancel.querySelector<HTMLElement>('[data-ui="abort-circle"]')!;
    expect(circle).toBeTruthy();
    expect(circle.style.backgroundColor).toBe("var(--error-text)");
    expect(circle.style.borderRadius).toBe("50%");
    expect(circle.style.width).toBe(circle.style.height);
    expect(circle).toHaveAttribute("data-fill", "commit");
    expect(circle.textContent).toBe("");

    // The abort is the ONLY control while the machine prepares (Jura's rule).
    expect(container.querySelectorAll("button")).toHaveLength(1);
    // And the only saturated shape on the screen (§5.C, §C3.5).
    expect(container.querySelectorAll('[data-fill="commit"]')).toHaveLength(1);
    assertHardRules(container);
  });
});

describe("DirectKey mosaic — one tile composition (C12)", () => {
  /**
   * A machine with a DirectKey band on its editable profile slot. Rendered in
   * list view purely because the paged grid mounts Embla, which needs an
   * `IntersectionObserver` jsdom does not have; the band is drawn above the
   * shelf and is identical in all three view modes.
   */
  function renderMosaic() {
    localStorage.setItem("melitta_view_mode", "list");
    return renderWithProviders(
      <BrewSection
        conn={conn}
        entities={machine({}, {
          "select.melitta_profile": ent("Profile 1", {
            options: ["Profile 1", "Profile 2"],
            active_profile: 1,
            directkey_recipes: { 1: { Espresso: CAPPUCCINO } },
          }),
        })}
        prefix="melitta"
      />,
    );
  }

  function tileOf(container: HTMLElement) {
    const band = container.querySelector<HTMLElement>('[data-ui="directkey-mosaic"]')!;
    expect(band).toBeTruthy();
    const tile = [...band.querySelectorAll<HTMLElement>("button")].find((b) =>
      b.textContent?.includes("Espresso"),
    )!;
    expect(tile).toBeTruthy();
    const caption = [...tile.querySelectorAll<HTMLElement>("span")].find(
      (s) => s.textContent === "Espresso",
    )!;
    expect(caption).toBeTruthy();
    return { band, tile, caption };
  }

  it("lets the caption FLOW under the glyph, as the stats tile does", () => {
    const { container } = renderMosaic();
    const { tile, caption } = tileOf(container);
    // The absolutely-pinned label band (`p-2 pb-9` + `absolute bottom-0`) is
    // retired: a mosaic tile is composed one way in both mosaics, and it is
    // the flow one.
    expect(caption.className).not.toMatch(/absolute/);
    expect(tile.className).not.toMatch(/pb-9/);
    expect(tile.className).toContain("pb-3");
  });

  it("reserves the caption band so arming a tile never moves the glyph", () => {
    const { container } = renderMosaic();
    const { caption } = tileOf(container);
    // The band's height and leading are fixed, so the `t-label` → `t-body`
    // swap on arming occupies exactly the same box (what the pinning bought).
    expect(caption.style.height).toBe("1.75rem");
    expect(caption.style.lineHeight).toBe("1.75rem");
    expect(caption.className).toContain("t-label");
    assertHardRules(container);
  });
});

describe("BrewSection list view — selection is never a fill (H12)", () => {
  function renderList() {
    localStorage.setItem("melitta_view_mode", "list");
    return renderWithProviders(
      <BrewSection conn={conn} entities={machine({})} prefix="melitta" />,
    );
  }

  it("says 'chosen' with the reserved underline, exactly as a grid cell does", () => {
    const { container } = renderList();

    const rows = container.querySelectorAll<HTMLElement>('[data-ui="recipe-row"]');
    expect(rows).toHaveLength(2);
    const chosen = [...rows].find((r) => r.getAttribute("data-underline") === "lit")!;
    const other = [...rows].find((r) => r.getAttribute("data-underline") === "reserved")!;
    expect(chosen).toBeTruthy();
    expect(other).toBeTruthy();

    const litName = chosen.querySelector<HTMLElement>('[data-ui="recipe-name"]')!;
    const quietName = other.querySelector<HTMLElement>('[data-ui="recipe-name"]')!;
    expect(litName.style.borderBottomColor).toBe("var(--accent)");
    expect(litName.style.color).toBe("var(--text-primary)");
    expect(litName.style.fontWeight).toBe("600");
    // The slot is declared in both states, so selection never shifts a pixel.
    expect(quietName.style.borderBottomStyle).toBe("solid");
    expect(quietName.style.borderBottomColor).toBe("transparent");
    expect(quietName.style.color).toBe("var(--text-secondary)");
  });

  it("spends accent only inside the action band — never in a row's gutter", () => {
    const { container } = renderList();

    // What is left of `--accent` as PAINT on this screen is the action band's
    // two licensed shapes: the 2px rule that opens it (§8.3) and the one
    // commit rectangle (§5.C). The retired mark — a 2px accent bar down each
    // chosen row's left gutter — would sit outside the band, and does not.
    const band = container.querySelector('[data-ui="action-band"]')!;
    expect(band).toBeTruthy();
    const accentPaint = [...container.querySelectorAll<HTMLElement>("*")].filter(
      (el) => el.style.backgroundColor === "var(--accent)",
    );
    expect(accentPaint.length).toBeGreaterThan(0);
    for (const el of accentPaint) {
      expect(band.contains(el), `${el.tagName} paints accent outside the action band`).toBe(true);
    }

    // And the rows themselves paint nothing at all, in either state.
    for (const row of container.querySelectorAll<HTMLElement>('[data-ui="recipe-row"]')) {
      expect(row.style.backgroundColor).toBe("");
      expect(row.style.borderRadius).toBe("0px");
      expect(row.className).not.toMatch(/rounded-|ring-|shadow-/);
    }
    assertHardRules(container);
  });
});