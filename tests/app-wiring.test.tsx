/**
 * Zone P-I — app-level wiring (UI Contract §2.3, §5.4, §6.3.2, §10.2 P-I).
 *
 * useUiContract lifecycle: bridge detection, version gate + mismatch latch,
 * fetch/cache/refetch, bounded transient retry, last-good persistence.
 * App wiring: mismatch screens, capability-gated tabs, contract props
 * threading into the sections, the i18n/get trigger, the stale banner.
 */
import { readFileSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
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

  it("the mismatch screen's mark is the state glyph and its verb is a bare Word", async () => {
    const conn = makeConn(() => Promise.resolve(MELITTA_CONTRACT_FULL));
    ha.current = connectedHA(conn, bridgeEntities({ contract_version: 2 }));
    const { container } = renderWithProviders(<App />);
    await screen.findByText("Update the app");

    // C27: `h-24 opacity-50` was a size picked here and nowhere else.
    const glyph = container.querySelector('[data-ui="glyph"]') as HTMLElement;
    expect(glyph.dataset.size).toBe("state");
    expect(glyph.style.height).toBe("80px");
    expect(glyph.getAttribute("class")).not.toMatch(/h-24|opacity-50/);

    // C5: ConnectScreen's own WORD_ACTION hung a `--border` rule under this
    // verb. An action wears no underline.
    const word = container.querySelector('[data-ui="word"]') as HTMLElement;
    expect(word.textContent).toBe("Disconnect");
    expect(word.style.borderBottomWidth).toBe("");
    expect(word.style.borderBottomColor).toBe("");
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

// ---------------------------------------------------------------------------
// App shell — the drawn contract (hard rules 1 and 2)
// ---------------------------------------------------------------------------

/** The complete fill allowlist: an element that paints MUST declare one. */
const FILL_ALLOWLIST = new Set([
  "commit",
  "meter",
  "glow",
  "contact",
  "rule",
  // The 2026-09-07 amendment's fourth gradient surface: the 1px
  // `--underline-fill` strip a chosen `Option` lays over the accent border its
  // slot already reserves. `none` in every family but obsidian, and a line
  // rather than a fill in all of them.
  "underline",
  // The amendment's FIRST gradient surface: the page ground itself. The shell
  // draws it as one declared layer (`data-ui="ground"`), held below to exactly
  // `var(--bg)` plus the family's `--ground-wash`.
  "ground",
  "scrim",
  "panel",
]);

function everyElement(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>("*"));
}

/**
 * Colour-bearing inline properties. A family repaints the app by moving
 * tokens, so a literal in any of these is a colour no theme can reach.
 * A gradient assembled FROM tokens is fine — what is banned is the literal.
 */
const COLOUR_PROPS = [
  "color",
  "backgroundColor",
  "backgroundImage",
  "borderColor",
  "borderTopColor",
  "borderRightColor",
  "borderBottomColor",
  "borderLeftColor",
  "outlineColor",
  "fill",
  "stroke",
] as const;

const LITERAL_COLOUR = /#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(/i;
/** Tailwind palette utilities — the other way a literal colour gets in. */
const PALETTE_UTILITY =
  /\b(bg|text|border|from|via|to|fill|stroke|decoration|outline|caret|divide|placeholder)-(black|white|slate|gray|grey|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(-\d{2,3})?(\/\d{1,3})?\b/;
/** Weight is a theme axis (`--w-*`); a utility pins it to one family. */
const WEIGHT_UTILITY =
  /\bfont-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)\b/;

/**
 * Every colour and every weight on a rendered screen must be reachable by a
 * theme — spelled as a token, never as a literal or a palette utility. This is
 * the shell's half of the three-family sweep: obsidian turns the ink platinum
 * and thins every weight, so one `#fff` or one `font-semibold` left in the
 * shell would survive the family switch and read as a bug in the theme.
 */
function assertNoHardcodedInk(root: HTMLElement) {
  for (const el of everyElement(root)) {
    const at = `<${el.tagName.toLowerCase()} class="${el.getAttribute("class") ?? ""}">`;
    const cls = el.getAttribute("class") ?? "";
    expect(cls, `palette utility on ${at}`).not.toMatch(PALETTE_UTILITY);
    expect(cls, `weight utility on ${at}`).not.toMatch(WEIGHT_UTILITY);
    for (const prop of COLOUR_PROPS) {
      const value = el.style[prop] ?? "";
      if (value === "") continue;
      expect(value, `${prop} on ${at}`).not.toMatch(LITERAL_COLOUR);
    }
  }
}

describe("App shell — visual contract", () => {
  async function renderShell(entities?: HassEntities) {
    const conn = makeConn(() => Promise.resolve(MELITTA_CONTRACT_FULL));
    ha.current = connectedHA(conn, entities ?? bridgeEntities());
    const view = renderWithProviders(<App />);
    await act(async () => {});
    return view;
  }

  /** A bridge whose manipulation token locks navigation to the current tab. */
  function lockedEntities(): HassEntities {
    return {
      ...bridgeEntities(),
      "sensor.melitta_state": ent("Ready", {
        process_id: 4,
        process_token: "READY",
        sub_process_token: null,
        manipulation_token: "FILL_WATER",
        is_brewing: false,
        awaiting_confirmation: false,
        info_messages: [],
      }),
    };
  }

  it("draws exactly one page-ground layer, and it declares itself", async () => {
    const { container } = await renderShell();
    const grounds = container.querySelectorAll<HTMLElement>('[data-fill="ground"]');
    expect(grounds).toHaveLength(1);

    const ground = grounds[0];
    expect(ground.dataset.ui).toBe("ground");
    // §S4.1 held literally: the ground paints the ground colour and the
    // family's wash over it, and nothing else may claim the name (hard-rules.ts
    // pins `data-fill="ground"` to exactly `var(--bg)`).
    expect(ground.style.backgroundColor).toBe("var(--bg)");
    expect(ground.style.backgroundImage).toBe("var(--ground-wash)");
    expect(ground.style.borderRadius).toBe("0px");
    expect(ground.getAttribute("aria-hidden")).toBe("true");
  });

  it("keeps the ground behind the content, out of reach and out of the scroll", async () => {
    const { container } = await renderShell();
    const ground = container.querySelector<HTMLElement>('[data-ui="ground"]')!;
    const shell = ground.parentElement!;

    // Scenery, never a target: the pager, the tab words and the status strip
    // all sit over it and every pointer must fall through.
    expect(ground.className).toContain("pointer-events-none");
    // One layer pinned to the shell box — it cannot scroll away from the
    // content, because it does not scroll at all.
    expect(ground.className).toContain("absolute");
    expect(ground.className).toContain("inset-0");
    expect(ground.className).not.toMatch(/overflow-|fixed|sticky/);

    // Behind all content and above nothing: the ground is the first thing the
    // shell draws, and the one column that holds every tab is stacked over it.
    expect(shell.firstElementChild).toBe(ground);
    expect(ground.style.zIndex).toBe("0");
    const content = ground.nextElementSibling as HTMLElement;
    expect(content.className).toContain("z-10");
    expect(content.contains(container.querySelector("nav"))).toBe(true);
    expect(content.contains(screen.getByTestId("status-bar"))).toBe(true);
  });

  it("the ground paints nothing at all in cappuccino", async () => {
    // The layer reaches its wash only through `--ground-wash`, and cappuccino
    // declares that token `none` — which is the whole mechanical claim that
    // adding three families did not move a pixel of the shipped one. Asserted
    // end to end: the element's paint here, the token's value in the base
    // block (`:root` also serves cappuccino LIGHT, which restates palette
    // only) there.
    const { container } = await renderShell();
    const ground = container.querySelector<HTMLElement>('[data-ui="ground"]')!;
    expect(ground.style.backgroundImage).toBe("var(--ground-wash)");
    expect(ground.getAttribute("style")).not.toMatch(/gradient/);

    // From the vitest root, not `import.meta.url`: under jsdom that URL is an
    // http one and `readFileSync` refuses it.
    const css = readFileSync(resolvePath(process.cwd(), "src/index.css"), "utf8");
    const base = /:root,\s*\[data-theme="dark"\]\s*\{([\s\S]*?)\n\}/.exec(css);
    expect(base, "the cappuccino base block").not.toBeNull();
    expect(/--ground-wash:\s*none\s*;/.test(base![1])).toBe(true);
  });

  it("hardcodes no colour and no weight the three families cannot reach", async () => {
    const { container } = await renderShell();
    assertNoHardcodedInk(container);
  });

  it("…and neither does the status strip, which this file otherwise mocks", async () => {
    // The strip is stubbed above so App's wiring is what the shell tests
    // measure; its own ink still has to answer to the families, so the real
    // component is rendered once, here.
    const { StatusBar: RealStatusBar } = await vi.importActual<
      typeof import("../src/components/StatusBar")
    >("../src/components/StatusBar");
    const { container } = renderWithProviders(
      <RealStatusBar
        entities={bridgeEntities()}
        prefix="melitta"
        onDisconnect={vi.fn()}
        onOpenPrefs={vi.fn()}
      />,
    );
    assertNoHardcodedInk(container);
  });

  it("the tab bar paints nothing and sits under a rail-to-rail rule", async () => {
    const { container } = await renderShell();
    const nav = container.querySelector("nav") as HTMLElement;
    // The `--bg-elevated` fill is gone: a nav bar is ground, not a surface.
    expect(nav.style.backgroundColor).toBe("");
    expect(nav.style.backgroundImage).toBe("");
    expect(nav.style.marginLeft).toBe("var(--rail)");
    expect(nav.style.marginRight).toBe("var(--rail)");

    const rule = nav.parentElement!.querySelector('[data-ui="rule"]') as HTMLElement;
    expect(rule.style.marginLeft).toBe("var(--rail)");
    expect(rule.style.marginRight).toBe("var(--rail)");
    expect(rule.style.height).toBe("1px");
  });

  it("the tab mark is a square-cut 2px accent bar riding on that rule", async () => {
    const { container } = await renderShell();
    const mark = container.querySelector('[data-ui="tab-indicator"]') as HTMLElement;
    expect(mark.style.backgroundColor).toBe("var(--accent)");
    expect(mark.style.borderRadius).toBe("0px");
    // C19/C24: the weight comes from the nav underline token, not an `h-[2px]`
    // literal — this mark and a lit `Option level="nav"` underline are the
    // same 2px of the same ink.
    expect(mark.style.height).toBe("var(--underline-w-nav)");
    // -1px lands the 2px bar on top of the 1px rule above the nav, which is
    // the overlap `Option`'s own `margin-bottom: -1px` produces in the sub-nav.
    expect(mark.style.top).toBe("-1px");
    expect(mark.getAttribute("class")).not.toMatch(/rounded-|h-\[/);
    // The mark is a SELECTION underline that rides on the rule, not the rule,
    // and it carries the same material a chosen `Option` does: `--accent`
    // beneath, `--underline-fill` over it. `none` in cappuccino and caramel, so
    // the flat accent bar is untouched there; obsidian gets its chrome sliver
    // in the tab bar and the sub-nav alike instead of one of each.
    expect(mark.dataset.fill).toBe("underline");
    expect(mark.style.backgroundImage).toBe("var(--underline-fill)");
  });

  it("keeps every tab at the 60px reach and marks the current one by value", async () => {
    await renderShell();
    const tabs = screen.getAllByRole("button");
    for (const tabEl of tabs) {
      expect(tabEl.className).toContain("tap");
      expect(tabEl.className).toContain("tap-lg");
      expect(tabEl.className).toContain("press");
      expect((tabEl as HTMLElement).style.borderRadius).toBe("0px");
    }
    const current = tabs.filter((b) => b.getAttribute("aria-current") === "page");
    expect(current).toHaveLength(1);
    expect(current[0].className).toContain("text-primary");
    expect(current[0].dataset.selected).toBe("true");
  });

  it("sets its words at the sub-nav's type step, not one below it (C19)", async () => {
    await renderShell();
    // `Option level="nav"` — the §C6a reference the sommelier sub-nav uses —
    // is `t-body`. The tab bar was `t-label`, so the app's two nav idioms
    // disagreed on word size as well as on the mark.
    for (const tabEl of screen.getAllByRole("button")) {
      expect(tabEl.className).toContain("t-body");
      expect(tabEl.className).not.toContain("t-label");
    }
  });

  it("the Disconnect verb is a bare Word and wears no underline (C5)", async () => {
    // No prefix yet: the "looking for the integration" screen, whose one
    // control is Disconnect. An underline means "chosen" in this language, so
    // an action must not wear one — the private WORD_ACTION constant hung a
    // `--border` rule under exactly this word.
    const conn = makeConn(() => Promise.resolve(MELITTA_CONTRACT_FULL));
    ha.current = { ...connectedHA(conn, bridgeEntities()), prefix: null };
    const { container } = renderWithProviders(<App />);
    await act(async () => {});

    const word = container.querySelector('[data-ui="word"]') as HTMLElement;
    expect(word).not.toBeNull();
    expect(word.textContent).toBe("Disconnect");
    expect(word.style.borderBottomWidth).toBe("");
    expect(word.style.borderBottomColor).toBe("");
    expect(word.style.color).toBe("var(--text-secondary)");
    // ...and the screen's mark is the one glyph ladder's `state` rung.
    const glyph = container.querySelector('[data-ui="glyph"]') as HTMLElement;
    expect(glyph.dataset.size).toBe("state");
    expect(glyph.style.width).toBe("80px");
    expect(glyph.getAttribute("class")).not.toMatch(/w-20|opacity-50/);
  });

  it("a locked tab uses the language's disabled value, not opacity-30", async () => {
    await renderShell(lockedEntities());
    const locked = screen
      .getAllByRole("button")
      .filter((b) => (b as HTMLButtonElement).disabled) as HTMLElement[];
    expect(locked.length).toBeGreaterThan(0);
    for (const tabEl of locked) {
      expect(tabEl.style.opacity).toBe("0.35");
      expect(tabEl.className).not.toMatch(/opacity-30/);
    }
  });

  it("the stale notice is type between hairlines, not a tinted strip", async () => {
    persistLastGoodContract(MELITTA_CONTRACT_FULL);
    const conn = makeConn(() => Promise.reject({ code: "contract_not_ready" }));
    ha.current = connectedHA(conn, bridgeEntities());
    const { container } = renderWithProviders(<App />);
    const notice = await screen.findByText(
      "No live connection to the machine — showing the last known data.",
    );
    expect((notice as HTMLElement).style.backgroundColor).toBe("");
    expect(notice.className).toContain("t-label");
    // Closed below by a rail rule; the StatusBar's own rule closes it above.
    const rules = container.querySelectorAll('[data-ui="rule"]');
    expect(rules.length).toBeGreaterThanOrEqual(2);
  });

  it("nothing in the shell paints a background without declaring data-fill", async () => {
    const { container } = await renderShell();
    for (const el of everyElement(container)) {
      const paints =
        el.style.backgroundColor !== "" || el.style.backgroundImage !== "";
      if (!paints) continue;
      expect(
        FILL_ALLOWLIST.has(el.dataset.fill ?? ""),
        `${el.tagName} "${el.getAttribute("class") ?? ""}" paints without an allowed data-fill`,
      ).toBe(true);
    }
  });

  it("carries no radius, ring, shadow, tracking or caps anywhere in the shell", async () => {
    const { container } = await renderShell();
    for (const el of everyElement(container)) {
      const cls = el.getAttribute("class") ?? "";
      expect(cls, cls).not.toMatch(/\b(rounded-|ring-|shadow|tracking-|uppercase)/);
      if (el.style.borderRadius !== "") {
        expect(el.style.borderRadius).toBe("0px");
      }
      expect(el.style.letterSpacing).toBe("");
      expect(el.style.boxShadow === "" || el.style.boxShadow === "none").toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Sign-in — the screen App renders before there is a connection at all
// ---------------------------------------------------------------------------

describe("Sign-in screen — visual contract", () => {
  function disconnectedHA() {
    return {
      status: "disconnected",
      connection: null,
      entities: {} as HassEntities,
      prefix: null,
      error: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
  }

  it("the form floats on the ground: no panel fill, no ring, no blur", async () => {
    ha.current = disconnectedHA();
    const { container } = renderWithProviders(<App />);
    await act(async () => {});
    const form = container.querySelector("form") as HTMLElement;
    expect(form.style.backgroundColor).toBe("");
    expect(form.style.backgroundImage).toBe("");
    expect(form.getAttribute("class")).not.toMatch(
      /rounded-|ring-|shadow|backdrop-blur|surface/,
    );
  });

  it("both fields are the shared Field — transparent, one tokenised rule, no box", async () => {
    ha.current = disconnectedHA();
    const { container } = renderWithProviders(<App />);
    await act(async () => {});
    // C6/C24: the screen no longer declares its own UNDERLINE_INPUT, so the
    // weight is `--underline-w` rather than a literal "1px" and the ink is the
    // one token that exists for an input's rule.
    const fields = container.querySelectorAll('[data-ui="field"]');
    expect(fields).toHaveLength(2);
    const inputs = Array.from(container.querySelectorAll<HTMLInputElement>("input"));
    expect(inputs).toHaveLength(2);
    for (const input of inputs) {
      expect(input.dataset.ui).toBe("field-input");
      expect(input.style.backgroundColor).toBe("transparent");
      expect(input.style.borderRadius).toBe("0px");
      expect(input.style.borderBottomWidth).toBe("var(--underline-w)");
      expect(input.style.borderBottomColor).toBe("var(--input-border)");
      expect(input.style.minHeight).toBe("var(--tap)");
      expect(input.getAttribute("class")).not.toMatch(/rounded-|ring-/);
    }
    // Each line is still named, and the label still points at its own input.
    const labels = Array.from(container.querySelectorAll<HTMLLabelElement>("label"));
    expect(labels.map((l) => l.htmlFor)).toContain("connect-url");
    expect(labels.map((l) => l.htmlFor)).toContain("connect-token");
  });

  it("an incomplete form leaves the commit at the language's disabled value", async () => {
    // `Field` carries no `required`, deliberately — the native validation
    // bubble is a rounded filled box. §10's disabled expression says the same
    // thing in the language instead. A blank token is the fresh-install state.
    ha.current = disconnectedHA();
    const { container } = renderWithProviders(<App />);
    await act(async () => {});
    const commit = container.querySelector('[data-ui="commit"]') as HTMLButtonElement;
    expect(commit.disabled).toBe(true);
    expect(commit.style.opacity).toBe("0.35");
  });

  it("carries exactly one commit rectangle, sized by the form column", async () => {
    ha.current = disconnectedHA();
    const { container } = renderWithProviders(<App />);
    await act(async () => {});
    const commits = container.querySelectorAll('[data-ui="commit"]');
    expect(commits).toHaveLength(1);
    const commit = commits[0] as HTMLElement;
    expect(commit.getAttribute("type")).toBe("submit");
    expect(commit.style.backgroundColor).toBe("var(--accent)");
    expect(commit.style.borderRadius).toBe("0px");
    expect(commit.className).not.toMatch(/px-16|max-w-/);
  });

  it("the connect error is type between two error rules, not a tinted box", async () => {
    ha.current = { ...disconnectedHA(), status: "error", error: "boom" };
    const { container } = renderWithProviders(<App />);
    await act(async () => {});
    const notice = container.querySelector('[data-ui="error-notice"]') as HTMLElement;
    expect(notice).not.toBeNull();
    expect(notice.style.backgroundColor).toBe("");
    const rules = Array.from(
      notice.querySelectorAll<HTMLElement>('[data-ui="rule"]'),
    );
    expect(rules).toHaveLength(2);
    for (const rule of rules) {
      expect(rule.style.backgroundColor).toBe("var(--error-border)");
    }
    const line = notice.querySelector("p") as HTMLElement;
    expect(line.style.color).toBe("var(--error-text)");
  });

  it("nothing on the sign-in screen paints or rounds without a licence", async () => {
    ha.current = disconnectedHA();
    const { container } = renderWithProviders(<App />);
    await act(async () => {});
    for (const el of everyElement(container)) {
      const cls = el.getAttribute("class") ?? "";
      expect(cls, cls).not.toMatch(/\b(rounded-|ring-|shadow|tracking-|uppercase)/);
      if (el.style.borderRadius !== "") expect(el.style.borderRadius).toBe("0px");
      const paints =
        (el.style.backgroundColor !== "" && el.style.backgroundColor !== "transparent") ||
        el.style.backgroundImage !== "";
      if (!paints) continue;
      expect(
        FILL_ALLOWLIST.has(el.dataset.fill ?? ""),
        `${el.tagName} "${cls}" paints without an allowed data-fill`,
      ).toBe(true);
    }
    // …and every ink on it is a token, so obsidian's platinum and caramel's
    // burnt sugar reach the sign-in screen as they reach the shell.
    assertNoHardcodedInk(container);
  });
});

// ---------------------------------------------------------------------------
// ResolutionGuard — the one overlay App always mounts
// ---------------------------------------------------------------------------

describe("ResolutionGuard — visual contract", () => {
  const realWidth = window.innerWidth;
  const realHeight = window.innerHeight;

  function setViewport(w: number, h: number) {
    Object.defineProperty(window, "innerWidth", { value: w, configurable: true });
    Object.defineProperty(window, "innerHeight", { value: h, configurable: true });
  }

  afterEach(() => setViewport(realWidth, realHeight));

  async function renderBlocked() {
    setViewport(800, 600);
    const conn = makeConn(() => Promise.resolve(MELITTA_CONTRACT_FULL));
    ha.current = connectedHA(conn, bridgeEntities());
    renderWithProviders(<App />);
    await act(async () => {});
  }

  it("is the scrim and nothing else — no second fill, no hand-rolled panel", async () => {
    await renderBlocked();

    const scrim = document.querySelector('[data-fill="scrim"]') as HTMLElement;
    expect(scrim).not.toBeNull();
    expect(scrim.style.backgroundColor).toBe("var(--overlay-bg)");

    // C7/C8/C9: this is a full-screen BLOCK, not a dismissible modal. `Panel`
    // cannot draw itself without a close control, and a close control here
    // would be one that lies — there is nothing to close to. So the block
    // stands bare on the scrim rather than forking the primitive.
    expect(document.querySelector('[data-fill="panel"]')).toBeNull();

    const block = document.querySelector('[data-ui="resolution-block"]') as HTMLElement;
    expect(block.style.backgroundColor).toBe("");
    expect(block.style.backgroundImage).toBe("");
    expect(block.getAttribute("class")).not.toMatch(/rounded-|ring-|shadow|max-w-sm/);
    // The one cap left is the §G2.3 prose measure; the rail does the bounding.
    // All three full-screen blocked columns in the shell share it (C8's class
    // of finding: nothing in the language picked a width, so each picked one).
    expect(block.className).toContain("max-w-prose");
    expect(scrim.style.paddingLeft).toBe("var(--rail)");
    // The block names itself with a heading, as the mismatch screen does.
    expect(block.querySelector("h2")!.className).toContain("t-title");

    // Every painting element in the overlay declares a licensed fill.
    for (const el of everyElement(scrim)) {
      const paints =
        (el.style.backgroundColor !== "" && el.style.backgroundColor !== "transparent") ||
        el.style.backgroundImage !== "";
      if (!paints) continue;
      expect(FILL_ALLOWLIST.has(el.dataset.fill ?? "")).toBe(true);
    }
    assertNoHardcodedInk(scrim);
  });

  it("draws its mark on the one glyph ladder and its figures with .num", async () => {
    await renderBlocked();

    // C27: `state`, 80px, the one 0.6 knock-down — not `w-16 opacity-60`.
    const glyph = document.querySelector('[data-ui="glyph"]') as HTMLElement;
    expect(glyph.dataset.size).toBe("state");
    expect(glyph.style.width).toBe("80px");
    expect(glyph.style.height).toBe("80px");
    expect(glyph.style.opacity).toBe("0.6");
    expect(glyph.getAttribute("class")).not.toMatch(/w-16|opacity-60/);

    // C25: `.num`, never the raw Tailwind utility.
    const readout = screen.getByText(/1024×690px/);
    expect((readout as HTMLElement).style.backgroundColor).toBe("");
    expect(readout.className).toContain("num");
    expect(readout.className).not.toContain("tabular-nums");
    expect(
      readout.parentElement!.querySelectorAll('[data-ui="rule"]'),
    ).toHaveLength(2);
  });
});
