import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Connection, HassEntities } from "home-assistant-js-websocket";
import {
  resolveDirectKeyModel,
  legacyDirectKeyModel,
  visibleProfileSlots,
  canRenameProfileSlot,
  activeProfileFromEntities,
  directKeyProfilesFromList,
  fetchDirectKeyRecipeList,
  directKeyCategoryLabel,
  DIRECTKEY_CATEGORIES,
  LEGACY_DIRECTKEY_ENTRIES,
  DEFAULT_DIRECTKEY_ICON,
  type DirectKeyModel,
} from "../src/lib/entities";
import type { UiContract } from "../src/lib/contract";
import { setServerStrings, resetServerStrings } from "../src/lib/server-strings";
import {
  MELITTA_CONTRACT,
  MELITTA_CONTRACT_FULL,
  MELITTA_DIRECTKEY,
  clone,
} from "./fixtures/contracts";

const CTX = { id: "", user_id: null, parent_id: null };

function ent(state: string, attributes: Record<string, unknown> = {}) {
  return { entity_id: "", state, attributes, last_changed: "", last_updated: "", context: CTX };
}

function entities(map: Record<string, ReturnType<typeof ent>>): HassEntities {
  return map as unknown as HassEntities;
}

/** §3.7 doc with a mutated §9.3.3 directkey block. */
function contractWith(directkey: unknown): UiContract {
  return { ...clone(MELITTA_CONTRACT), directkey } as UiContract;
}

beforeEach(() => {
  resetServerStrings();
});

// ---------------------------------------------------------------------------
// resolveDirectKeyModel — §9.3.6 rule 1 tiers
// ---------------------------------------------------------------------------

describe("resolveDirectKeyModel (contract tier)", () => {
  it("maps the §9.3.3 block verbatim: served order, ids, machine_button, icons", () => {
    const model = resolveDirectKeyModel(clone(MELITTA_CONTRACT_FULL), 9);
    expect(model.source).toBe("contract");
    expect(model.categories.map((c) => c.category)).toEqual([
      "espresso", "cafe_creme", "cappuccino", "latte_macchiato",
      "milk_froth", "milk", "water",
    ]);
    expect(model.categories.map((c) => c.id)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(model.categories.find((c) => c.category === "milk")?.machineButton).toBe(false);
    expect(model.categories.filter((c) => c.category !== "milk").every((c) => c.machineButton)).toBe(true);
    expect(model.categories[3].icon).toBe("mdi:glass-mug-variant");
    expect(model.profileSelectSuffix).toBe("profile");
    expect(model.activeProfileAttribute).toBe("active_profile");
  });

  it("maps profile slots: fixed slot 0 with name_key, entity bindings for 1..8", () => {
    const model = resolveDirectKeyModel(clone(MELITTA_CONTRACT_FULL), 9);
    expect(model.profiles).toHaveLength(9);
    expect(model.profiles[0]).toEqual({
      slot: 0, fixed: true, nameKey: "my_coffee",
      nameEntitySuffix: null, activeEntitySuffix: null,
    });
    expect(model.profiles[3]).toEqual({
      slot: 3, fixed: false, nameKey: null,
      nameEntitySuffix: "profile_3_name", activeEntitySuffix: "profile_3_active",
    });
  });

  it("defaults an absent or malformed category icon to mdi:cup (§9.3.2)", () => {
    const block = clone(MELITTA_DIRECTKEY) as Record<string, unknown>;
    const cats = block.categories as Record<string, unknown>[];
    delete cats[0].icon;
    cats[1].icon = "<script>alert(1)</script>";
    cats[2].icon = "coffee"; // not an mdi: identifier
    const model = resolveDirectKeyModel(contractWith(block), 9);
    expect(model.categories[0].icon).toBe(DEFAULT_DIRECTKEY_ICON);
    expect(model.categories[1].icon).toBe(DEFAULT_DIRECTKEY_ICON);
    expect(model.categories[2].icon).toBe(DEFAULT_DIRECTKEY_ICON);
    expect(model.categories[3].icon).toBe("mdi:glass-mug-variant");
  });

  it("drops malformed category and profile entries individually (§6.0.3)", () => {
    const block = clone(MELITTA_DIRECTKEY) as Record<string, unknown>;
    (block.categories as unknown[]).push({ id: 9 }, "junk", { category: "" });
    (block.profiles as unknown[]).push({ slot: -1 }, { slot: 1.5 }, {}, null);
    const model = resolveDirectKeyModel(contractWith(block), 9);
    expect(model.source).toBe("contract");
    expect(model.categories).toHaveLength(7);
    expect(model.profiles).toHaveLength(9);
  });

  it("tolerates a missing id (-1) and a missing machine_button (true)", () => {
    const model = resolveDirectKeyModel(
      contractWith({
        categories: [{ category: "espresso" }],
        profiles: [{ slot: 0, fixed: true }],
        profile_select_entity_suffix: "profile",
        active_profile_attribute: "active_profile",
      }),
      1,
    );
    expect(model.categories[0]).toEqual({
      category: "espresso", id: -1, machineButton: true, icon: DEFAULT_DIRECTKEY_ICON,
    });
  });

  it("passes custom select suffix / attribute through; empty → defaults", () => {
    const custom = resolveDirectKeyModel(
      contractWith({
        ...clone(MELITTA_DIRECTKEY),
        profile_select_entity_suffix: "user_profile",
        active_profile_attribute: "current_profile",
      }),
      9,
    );
    expect(custom.profileSelectSuffix).toBe("user_profile");
    expect(custom.activeProfileAttribute).toBe("current_profile");

    const defaulted = resolveDirectKeyModel(
      contractWith({ ...clone(MELITTA_DIRECTKEY), profile_select_entity_suffix: "", active_profile_attribute: undefined }),
      9,
    );
    expect(defaulted.profileSelectSuffix).toBe("profile");
    expect(defaulted.activeProfileAttribute).toBe("active_profile");
  });
});

describe("resolveDirectKeyModel (legacy tier)", () => {
  it("null contract and a block-less document fall back to the legacy model", () => {
    expect(resolveDirectKeyModel(null, 9).source).toBe("legacy");
    expect(resolveDirectKeyModel(clone(MELITTA_CONTRACT), 9).source).toBe("legacy");
  });

  it("a block emptied by validation degrades whole to the legacy tier", () => {
    expect(
      resolveDirectKeyModel(contractWith({ categories: [], profiles: clone(MELITTA_DIRECTKEY).profiles }), 9).source,
    ).toBe("legacy");
    expect(
      resolveDirectKeyModel(contractWith({ categories: clone(MELITTA_DIRECTKEY).categories, profiles: [{ slot: -2 }] }), 9).source,
    ).toBe("legacy");
  });

  it("legacy categories keep the pre-contract truth: milk has no machine button", () => {
    const model = legacyDirectKeyModel(9);
    expect(model.categories.map((c) => c.category)).toEqual([
      "espresso", "cafe_creme", "cappuccino", "latte_macchiato",
      "milk_froth", "milk", "water",
    ]);
    expect(model.categories.find((c) => c.category === "milk")?.machineButton).toBe(false);
    // Byte parity with the pre-contract const: the rendered (machine-button)
    // token list is exactly the legacy DIRECTKEY_CATEGORIES.
    expect(model.categories.filter((c) => c.machineButton).map((c) => c.category)).toEqual([
      ...DIRECTKEY_CATEGORIES,
    ]);
    expect(DIRECTKEY_CATEGORIES).not.toContain("milk");
  });

  it("legacy profiles carry the string-template bindings and a fixed slot 0", () => {
    const model = legacyDirectKeyModel(3);
    expect(model.profiles).toEqual([
      { slot: 0, fixed: true, nameKey: "my_coffee", nameEntitySuffix: null, activeEntitySuffix: null },
      { slot: 1, fixed: false, nameKey: null, nameEntitySuffix: "profile_1_name", activeEntitySuffix: "profile_1_active" },
      { slot: 2, fixed: false, nameKey: null, nameEntitySuffix: "profile_2_name", activeEntitySuffix: "profile_2_active" },
    ]);
    expect(model.profileSelectSuffix).toBe("profile");
    expect(model.activeProfileAttribute).toBe("active_profile");
    // Before any entity data arrives, slot 0 still exists.
    expect(legacyDirectKeyModel(0).profiles).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Slot visibility / rename gating — §9.3.2 semantics + §9.3.6 rule 6
// ---------------------------------------------------------------------------

const OPTIONS = ["My Coffee", "Anna", "Ben"];

function contractModel(): DirectKeyModel {
  return resolveDirectKeyModel(clone(MELITTA_CONTRACT_FULL), OPTIONS.length);
}

describe("visibleProfileSlots", () => {
  it("slot 0 is always visible; others require their activity switch to be on", () => {
    const model = legacyDirectKeyModel(OPTIONS.length);
    const ents = entities({
      "switch.melitta_profile_1_active": ent("on"),
      "switch.melitta_profile_2_active": ent("off"),
    });
    const visible = visibleProfileSlots(model, OPTIONS, ents, "melitta");
    expect(visible.map((s) => s.slot)).toEqual([0, 1]);
  });

  it("a missing activity switch entity hides the slot (§9.3.6 rule 6)", () => {
    const model = contractModel();
    const visible = visibleProfileSlots(model, OPTIONS, entities({}), "melitta");
    expect(visible.map((s) => s.slot)).toEqual([0]);
  });

  it("a slot without a profile-select option is never rendered", () => {
    const model = contractModel(); // 9 served slots, 3 options
    const ents = entities({
      "switch.melitta_profile_1_active": ent("on"),
      "switch.melitta_profile_5_active": ent("on"), // no option at index 5
    });
    const visible = visibleProfileSlots(model, OPTIONS, ents, "melitta");
    expect(visible.map((s) => s.slot)).toEqual([0, 1]);
  });

  it("a served slot missing its active binding is hidden", () => {
    const block = clone(MELITTA_DIRECTKEY) as Record<string, unknown>;
    (block.profiles as Record<string, unknown>[])[1] = { slot: 1, name_entity_suffix: "profile_1_name" };
    const model = resolveDirectKeyModel(contractWith(block), OPTIONS.length);
    const ents = entities({ "switch.melitta_profile_1_active": ent("on") });
    expect(visibleProfileSlots(model, OPTIONS, ents, "melitta").map((s) => s.slot)).toEqual([0]);
  });
});

describe("canRenameProfileSlot", () => {
  it("fixed slot 0 is never renameable", () => {
    const model = contractModel();
    expect(canRenameProfileSlot(model, model.profiles[0], entities({}), "melitta")).toBe(false);
  });

  it("legacy tier keeps the current behavior: any slot > 0 is editable", () => {
    const model = legacyDirectKeyModel(3);
    expect(canRenameProfileSlot(model, model.profiles[1], entities({}), "melitta")).toBe(true);
  });

  it("contract tier requires the bound text entity to exist (§9.3.6 rule 6)", () => {
    const model = contractModel();
    const slot1 = model.profiles[1];
    expect(canRenameProfileSlot(model, slot1, entities({}), "melitta")).toBe(false);
    const ents = entities({ "text.melitta_profile_1_name": ent("Anna") });
    expect(canRenameProfileSlot(model, slot1, ents, "melitta")).toBe(true);
  });
});

describe("activeProfileFromEntities", () => {
  it("reads the served attribute name off the served select suffix", () => {
    const model = resolveDirectKeyModel(
      contractWith({
        ...clone(MELITTA_DIRECTKEY),
        profile_select_entity_suffix: "user_profile",
        active_profile_attribute: "current_profile",
      }),
      9,
    );
    const ents = entities({
      "select.melitta_user_profile": ent("Anna", { current_profile: 2 }),
    });
    expect(activeProfileFromEntities(model, ents, "melitta")).toBe(2);
  });

  it("returns null when the select or the attribute is absent/non-numeric", () => {
    const model = legacyDirectKeyModel(3);
    expect(activeProfileFromEntities(model, entities({}), "melitta")).toBeNull();
    const ents = entities({ "select.melitta_profile": ent("Anna", { active_profile: "2" }) });
    expect(activeProfileFromEntities(model, ents, "melitta")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// recipes/list join — §9.3.4 / §9.3.6 rule 5
// ---------------------------------------------------------------------------

const CATEGORY_IDS = Object.fromEntries(
  MELITTA_DIRECTKEY.categories.map((c) => [c.category, c.id]),
);

function listRow(category: string, over: Record<string, unknown> = {}) {
  return {
    id: 312,
    name: "Espresso",
    type: 0,
    icon: null,
    category,
    components: [
      { process: "coffee", process_code: 1, shots: "one", intensity: "strong", aroma: "standard", temperature: "high", blend: 0, portion_ml: 40 },
      { process: "none", process_code: 0, shots: "none", intensity: "medium", aroma: "standard", temperature: "normal", blend: 0, portion_ml: 0 },
    ],
    ...over,
  };
}

describe("directKeyProfilesFromList", () => {
  it("joins rows on profile_id + category token — no id math, no reverse maps", () => {
    const payload = {
      schema_version: 1,
      base_recipes: [],
      directkey: [
        { profile_id: 0, profile_name: "My Coffee", recipes: [listRow("espresso")] },
        { profile_id: 1, profile_name: "Anna", recipes: [listRow("water", { id: 318 })] },
      ],
    };
    const joined = directKeyProfilesFromList(payload, CATEGORY_IDS)!;
    expect(Object.keys(joined[0])).toEqual(["espresso"]);
    expect(joined[0].espresso.category).toBe(0);
    expect(joined[0].espresso.c1_process).toBe("coffee");
    expect(joined[0].espresso.c1_intensity).toBe("strong");
    expect(joined[0].espresso.c1_portion_ml).toBe(40);
    expect(joined[0].espresso.c2_process).toBe("none");
    expect(joined[1].water.category).toBe(6);
  });

  it("carries the served IconSpec on the joined recipe (§9.3.6 rule 2)", () => {
    const icon = { spec_version: 1, glass: "espresso_cup", total_ml: 40, fill_level: 0.35, layers: [], foam: null, steam: true };
    const payload = { directkey: [{ profile_id: 1, recipes: [listRow("espresso", { icon })] }] };
    const joined = directKeyProfilesFromList(payload, CATEGORY_IDS)!;
    expect(joined[1].espresso.icon).toEqual(icon);
    const noIcon = directKeyProfilesFromList(
      { directkey: [{ profile_id: 1, recipes: [listRow("espresso")] }] },
      CATEGORY_IDS,
    )!;
    expect(noIcon[1].espresso.icon).toBeNull();
  });

  it("keeps unknown tokens (tolerated) with category id -1", () => {
    const payload = { directkey: [{ profile_id: 1, recipes: [listRow("turbo_shot")] }] };
    const joined = directKeyProfilesFromList(payload, CATEGORY_IDS)!;
    expect(joined[1].turbo_shot.category).toBe(-1);
  });

  it("skips empty-token rows and empty-slot rows; empty recipe lists survive", () => {
    const payload = {
      directkey: [
        {
          profile_id: 1,
          recipes: [
            listRow("espresso"),
            listRow(""), // out-of-enum category byte (§9.3.4)
            listRow("water", { components: [null, null] }), // empty slot
          ],
        },
        { profile_id: 2, recipes: [] },
      ],
    };
    const joined = directKeyProfilesFromList(payload, CATEGORY_IDS)!;
    expect(Object.keys(joined[1])).toEqual(["espresso"]);
    expect(joined[2]).toEqual({});
  });

  it("returns null for a pre-0.93 payload whose rows carry no tokens", () => {
    const row = listRow("espresso") as Record<string, unknown>;
    delete row.category;
    expect(
      directKeyProfilesFromList({ directkey: [{ profile_id: 0, recipes: [row] }] }, CATEGORY_IDS),
    ).toBeNull();
  });

  it("returns null for malformed payloads (fallback to the attribute path)", () => {
    expect(directKeyProfilesFromList(null, CATEGORY_IDS)).toBeNull();
    expect(directKeyProfilesFromList({ base_recipes: [] }, CATEGORY_IDS)).toBeNull();
    expect(directKeyProfilesFromList({ directkey: "nope" }, CATEGORY_IDS)).toBeNull();
  });

  it("drops malformed profile entries but keeps the rest", () => {
    const payload = {
      directkey: [
        "junk",
        { profile_name: "no id", recipes: [] },
        { profile_id: 3, recipes: [listRow("cappuccino")] },
      ],
    };
    const joined = directKeyProfilesFromList(payload, CATEGORY_IDS)!;
    expect(Object.keys(joined)).toEqual(["3"]);
    expect(joined[3].cappuccino.category).toBe(2);
  });
});

describe("fetchDirectKeyRecipeList", () => {
  it("sends melitta_barista/recipes/list scoped by entry_id", async () => {
    const payload = { schema_version: 1, base_recipes: [], directkey: [] };
    const send = vi.fn().mockResolvedValue(payload);
    const conn = { sendMessagePromise: send } as unknown as Connection;
    await expect(fetchDirectKeyRecipeList(conn, "a1b2c3d4e5f6")).resolves.toBe(payload);
    expect(send).toHaveBeenCalledWith({
      type: "melitta_barista/recipes/list",
      entry_id: "a1b2c3d4e5f6",
    });
  });

  it("never throws — a WS failure degrades to null", async () => {
    const conn = {
      sendMessagePromise: vi.fn().mockRejectedValue({ code: "not_found" }),
    } as unknown as Connection;
    await expect(fetchDirectKeyRecipeList(conn, "x")).resolves.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Category labels — §9.3.6 rule 2 chain
// ---------------------------------------------------------------------------

describe("directKeyCategoryLabel", () => {
  it("prefers the served values.directkey_category.* string", () => {
    setServerStrings({ "values.directkey_category.cafe_creme": "Kaffee Crème" });
    expect(directKeyCategoryLabel("de", "cafe_creme")).toBe("Kaffee Crème");
  });

  it("falls back to the legacy brew.dk_* bundle keys — byte-identical labels", () => {
    expect(directKeyCategoryLabel("en", "cafe_creme")).toBe("Café Crème");
    expect(directKeyCategoryLabel("en", "water")).toBe("Hot Water");
    expect(directKeyCategoryLabel("en", "milk")).toBe("Milk");
  });

  it("humanizes an unknown token as the last resort", () => {
    expect(directKeyCategoryLabel("en", "turbo_shot")).toBe("Turbo shot");
  });
});

// ---------------------------------------------------------------------------
// Fixture consistency (§9.3.4 pinned relations)
// ---------------------------------------------------------------------------

describe("§9.3.3 fixture consistency", () => {
  it("len(profiles) == my_coffee_slots + 1 and the token set matches the legacy table", () => {
    expect(MELITTA_DIRECTKEY.profiles).toHaveLength(
      MELITTA_CONTRACT_FULL.capabilities.my_coffee_slots + 1,
    );
    expect(MELITTA_DIRECTKEY.categories.map((c) => c.category)).toEqual(
      LEGACY_DIRECTKEY_ENTRIES.map((e) => e.category),
    );
  });
});
