import { describe, it, expect, beforeEach } from "vitest";
import {
  readActionCatalog,
  resolveActionCatalog,
  maintenanceActionGroups,
  evalRequires,
  requiresContextFromStatus,
  isDestructive,
  needsConfirm,
  planActionInvocation,
  findCatalogAction,
  saveDirectkeyDefaults,
  actionIconName,
  actionLabel,
  actionDescription,
  actionGroupLabel,
  DEFAULT_ACTION_ICON,
  KNOWN_GROUP_ORDER,
  INFORMATIONAL_GROUPS,
  type CatalogAction,
} from "../src/lib/actions";
import type { UiContract } from "../src/lib/contract";
import type { MachineStatusView } from "../src/lib/status";
import { setServerStrings, resetServerStrings } from "../src/lib/server-strings";
import { MELITTA_CONTRACT, MELITTA_ACTIONS, clone } from "./fixtures/contracts";

/** The §3.7 document extended with the §6.2.2/§9.3.5 action catalog. */
function contractWithActions(
  actions: unknown[] = clone(MELITTA_ACTIONS),
): UiContract {
  return { ...clone(MELITTA_CONTRACT), actions } as UiContract;
}

function entry(action: string, over: Partial<CatalogAction> = {}): CatalogAction {
  return {
    action,
    group: "cleaning",
    process: null,
    confirm: false,
    destructive: false,
    requires: [],
    available: true,
    invocation: { kind: "button", entity_suffix: action },
    ...over,
  };
}

function view(over: Partial<MachineStatusView> = {}): MachineStatusView {
  return {
    source: "tokens",
    connected: true,
    offline: false,
    off: false,
    ready: true,
    brewing: false,
    service: null,
    unknownActive: false,
    processToken: "READY",
    statusLabel: "Ready",
    activityLabel: null,
    hasAction: false,
    actionLabel: null,
    actionHint: null,
    awaitingConfirmation: false,
    ...over,
  };
}

beforeEach(() => resetServerStrings());

describe("readActionCatalog — §6.2.1/§6.0.3", () => {
  it("returns null with no contract or no actions block (legacy fallback)", () => {
    expect(readActionCatalog(null)).toBeNull();
    expect(readActionCatalog(clone(MELITTA_CONTRACT))).toBeNull();
  });

  it("parses the full 17-entry fixture catalog", () => {
    const entries = readActionCatalog(contractWithActions());
    expect(entries).toHaveLength(17);
    expect(entries!.map((e) => e.action)).toContain("save_directkey");
  });

  it("drops entries with unknown or malformed invocation kinds", () => {
    const entries = readActionCatalog(
      contractWithActions([
        { action: "ok", group: "cleaning", invocation: { kind: "button", entity_suffix: "ok" } },
        { action: "weird", group: "cleaning", invocation: { kind: "intent", intent: "brew" } },
        { action: "anchorless", group: "cleaning", invocation: { kind: "service", service: "x", params: [] } },
        { action: "shapeless", group: "cleaning", invocation: "press" },
        { group: "cleaning", invocation: { kind: "button", entity_suffix: "unnamed" } },
      ]),
    );
    expect(entries!.map((e) => e.action)).toEqual(["ok"]);
  });

  it("defaults safe: missing available → shown, missing requires → []", () => {
    const entries = readActionCatalog(
      contractWithActions([
        { action: "bare", group: "power", invocation: { kind: "button", entity_suffix: "bare" } },
      ]),
    );
    expect(entries![0].available).toBe(true);
    expect(entries![0].requires).toEqual([]);
    expect(entries![0].confirm).toBe(false);
    expect(entries![0].destructive).toBe(false);
  });
});

describe("resolveActionCatalog — §6.2.3/§6.2.5", () => {
  it("hides available:false entries (§6.2.5.3): TS serves no danger group", () => {
    const groups = resolveActionCatalog(contractWithActions())!;
    expect(groups.map((g) => g.group)).toEqual([
      "brew", "control", "cleaning", "filter", "power",
    ]);
  });

  it("orders known groups per §6.2.3 with unknown groups after, served order", () => {
    const actions = clone(MELITTA_ACTIONS) as Array<Record<string, unknown>>;
    for (const a of actions) a.available = true;
    actions.unshift({
      action: "future_thing", group: "experimental", process: null,
      requires: [], available: true,
      invocation: { kind: "button", entity_suffix: "future_thing" },
    });
    const groups = resolveActionCatalog(contractWithActions(actions))!;
    expect(groups.map((g) => g.group)).toEqual([
      ...KNOWN_GROUP_ORDER, "experimental",
    ]);
  });

  it("an empty catalog is catalog mode with nothing to show, not legacy", () => {
    expect(resolveActionCatalog(contractWithActions([]))).toEqual([]);
    expect(resolveActionCatalog(null)).toBeNull();
  });

  it("maintenanceActionGroups strips the informational brew/control groups", () => {
    const groups = maintenanceActionGroups(resolveActionCatalog(contractWithActions())!);
    expect(groups.map((g) => g.group)).toEqual(["cleaning", "filter", "power"]);
    for (const g of groups) expect(INFORMATIONAL_GROUPS).not.toContain(g.group);
  });
});

describe("evalRequires — §6.2.4, advisory and fail-open", () => {
  const ctx = { connected: true, ready: false, awaitingConfirmation: false };

  it("empty requires is always satisfied", () => {
    expect(evalRequires([], { connected: false, ready: false, awaitingConfirmation: false })).toBe(true);
  });

  it("ANDs all known tokens", () => {
    expect(evalRequires(["connected", "ready"], ctx)).toBe(false);
    expect(evalRequires(["connected", "ready"], { ...ctx, ready: true })).toBe(true);
    expect(evalRequires(["awaiting_confirmation"], ctx)).toBe(false);
    expect(
      evalRequires(["awaiting_confirmation"], { ...ctx, awaitingConfirmation: true }),
    ).toBe(true);
  });

  it("treats unknown tokens as satisfied (fail-open)", () => {
    expect(evalRequires(["machine_of_the_future"], ctx)).toBe(true);
    expect(evalRequires(["machine_of_the_future", "connected"], { ...ctx, connected: false })).toBe(false);
  });

  it("switch_off requires connected only — usable while not ready (PR #42 as data)", () => {
    const swOff = findCatalogAction(contractWithActions(), "switch_off")!;
    expect(swOff.requires).toEqual(["connected"]);
    expect(evalRequires(swOff.requires, { connected: true, ready: false, awaitingConfirmation: false })).toBe(true);
    expect(evalRequires(swOff.requires, { connected: false, ready: false, awaitingConfirmation: false })).toBe(false);
    // Cleaning stays ready-gated in the same context.
    const clean = findCatalogAction(contractWithActions(), "easy_clean")!;
    expect(evalRequires(clean.requires, { connected: true, ready: false, awaitingConfirmation: false })).toBe(false);
  });

  it("requiresContextFromStatus ANDs ready with the absence of a pending action", () => {
    expect(requiresContextFromStatus(view())).toEqual({
      connected: true, ready: true, awaitingConfirmation: false,
    });
    expect(requiresContextFromStatus(view({ hasAction: true })).ready).toBe(false);
    expect(requiresContextFromStatus(view({ connected: false, awaitingConfirmation: true }))).toEqual({
      connected: false, ready: true, awaitingConfirmation: true,
    });
  });
});

describe("confirm / destructive policy — §6.2.5.4", () => {
  it("destructive forces the confirm step regardless of confirm", () => {
    expect(needsConfirm(entry("a", { confirm: false, destructive: true }))).toBe(true);
    expect(needsConfirm(entry("a", { confirm: true }))).toBe(true);
    expect(needsConfirm(entry("a"))).toBe(false);
    expect(isDestructive(entry("a", { destructive: true }))).toBe(true);
    expect(isDestructive(entry("a", { confirm: true }))).toBe(false);
  });
});

describe("planActionInvocation — §6.2.1", () => {
  const catalog = readActionCatalog(contractWithActions())!;
  const byAction = (a: string) => catalog.find((e) => e.action === a)!;

  it("plans button entries as a press", () => {
    expect(planActionInvocation(byAction("easy_clean"), "melitta")).toEqual({
      button: "easy_clean",
    });
  });

  it("plans service entries with the entity_id anchor and declared defaults", () => {
    const plan = planActionInvocation(byAction("brew_directkey"), "melitta", {
      category: "espresso",
    });
    expect(plan).toEqual({
      domain: "melitta_barista",
      service: "brew_directkey",
      data: {
        category: "espresso",
        two_cups: false, // declared default applied
        entity_id: "button.melitta_brew",
      },
    });
  });

  it("omits params with neither a value nor a default (server defaults apply)", () => {
    const plan = planActionInvocation(byAction("reset_recipe"), "melitta");
    expect(plan).toEqual({
      domain: "melitta_barista",
      service: "reset_recipe",
      data: { entity_id: "button.melitta_brew" },
    });
  });

  it("spreads a params_ref record flat onto the wire", () => {
    const plan = planActionInvocation(byAction("brew_freestyle"), "melitta", {
      params: { name: "Custom", process1: "coffee", portion1_ml: 40 },
    });
    expect(plan).toEqual({
      domain: "melitta_barista",
      service: "brew_freestyle",
      data: {
        name: "Custom",
        process1: "coffee",
        portion1_ml: 40,
        entity_id: "button.melitta_brew",
      },
    });
  });

  it("the entity_id anchor can never be overridden by form values", () => {
    const plan = planActionInvocation(byAction("brew_freestyle"), "melitta", {
      params: { entity_id: "button.evil_brew" },
    }) as { data: Record<string, unknown> };
    expect(plan.data.entity_id).toBe("button.melitta_brew");
  });

  it("a dotted service name carries its own domain", () => {
    const e = entry("x", {
      invocation: {
        kind: "service", service: "other_domain.do_it", entity_suffix: "brew", params: [],
      },
    });
    expect(planActionInvocation(e, "melitta")).toEqual({
      domain: "other_domain",
      service: "do_it",
      data: { entity_id: "button.melitta_brew" },
    });
  });
});

describe("saveDirectkeyDefaults — §9.3.5 introspected defaults", () => {
  it("collects the declared defaults keyed by param name", () => {
    const defaults = saveDirectkeyDefaults(contractWithActions())!;
    expect(defaults).toEqual({
      process1: "coffee",
      intensity1: "medium",
      aroma1: "standard",
      portion1_ml: 40,
      temperature1: "normal",
      shots1: "one",
      process2: "none",
      intensity2: "medium",
      aroma2: "standard",
      portion2_ml: 0,
      temperature2: "normal",
      shots2: "none",
    });
    // Required-no-default params never appear.
    expect(defaults.category).toBeUndefined();
    expect(defaults.profile_id).toBeUndefined();
  });

  it("returns null without a catalog or without the entry", () => {
    expect(saveDirectkeyDefaults(null)).toBeNull();
    expect(saveDirectkeyDefaults(clone(MELITTA_CONTRACT))).toBeNull();
    expect(saveDirectkeyDefaults(contractWithActions([]))).toBeNull();
  });
});

describe("display resolution — §6.2.1 icons, §6.3.5.1 labels", () => {
  it("keeps well-formed mdi identifiers and discards everything else", () => {
    expect(actionIconName(entry("a", { icon: "mdi:water-sync" }))).toBe("mdi:water-sync");
    expect(actionIconName(entry("a", { icon: "Coffee" }))).toBe(DEFAULT_ACTION_ICON);
    expect(actionIconName(entry("a", { icon: "mdi:" }))).toBe(DEFAULT_ACTION_ICON);
    expect(actionIconName(entry("a", { icon: "mdi:Bad Name" }))).toBe(DEFAULT_ACTION_ICON);
    expect(actionIconName(entry("a"))).toBe(DEFAULT_ACTION_ICON);
  });

  it("labels prefer server strings, then the maint.* bundle, then humanized", () => {
    setServerStrings({ "actions.easy_clean.label": "Served Easy Clean" });
    expect(actionLabel("en", "easy_clean")).toBe("Served Easy Clean");
    resetServerStrings();
    expect(actionLabel("en", "easy_clean")).toBe("Easy Clean");
    expect(actionLabel("ru", "easy_clean")).not.toBe("Easy Clean");
    expect(actionLabel("en", "quantum_flush")).toBe("Quantum flush");
  });

  it("descriptions prefer server strings, then bundle, then null", () => {
    setServerStrings({ "actions.easy_clean.description": "Served desc" });
    expect(actionDescription("en", "easy_clean")).toBe("Served desc");
    resetServerStrings();
    expect(actionDescription("en", "easy_clean")).toBe("Quick rinse of the brew unit");
    expect(actionDescription("en", "quantum_flush")).toBeNull();
  });

  it("group headers map to the legacy section keys with humanized fallback", () => {
    setServerStrings({ "actions._groups.cleaning": "Served Cleaning" });
    expect(actionGroupLabel("en", "cleaning")).toBe("Served Cleaning");
    resetServerStrings();
    expect(actionGroupLabel("en", "cleaning")).toBe("Cleaning & Descaling");
    expect(actionGroupLabel("en", "filter")).toBe("Water Filter");
    expect(actionGroupLabel("en", "power")).toBe("Other");
    expect(actionGroupLabel("en", "danger")).toBe("Danger Zone");
    expect(actionGroupLabel("en", "experimental")).toBe("Experimental");
  });
});
