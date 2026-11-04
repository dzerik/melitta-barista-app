import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, within } from "@testing-library/react";
import type { Connection, HassEntities } from "home-assistant-js-websocket";
import { FreestyleSection } from "../src/components/FreestyleSection";
import { RecipeEditModal } from "../src/components/RecipeEditModal";
import type { DirectKeyRecipe } from "../src/lib/entities";
import type { UiContract } from "../src/lib/contract";
import { brewOrigin, clearBrewOrigin } from "../src/lib/brew-origin";
import { resetServerStrings, setServerStrings } from "../src/lib/server-strings";
import { MELITTA_CONTRACT_FULL, clone } from "./fixtures/contracts";
import { renderWithProviders } from "./test-utils";

const CTX = { id: "", user_id: null, parent_id: null };
const ent = (state: string, attributes = {}) => ({
  entity_id: "", state, attributes, last_changed: "", last_updated: "", context: CTX,
});
const BASE = {
  name: "Custom", process1: "coffee", intensity1: "medium", aroma1: "standard",
  temperature1: "normal", shots1: "three", portion1: 40,
  process2: "milk", intensity2: "medium", aroma2: "standard",
  temperature2: "normal", shots2: "two", portion2: 120,
};
const RECIPE = {
  c1_process: "milk", c1_intensity: "medium", c1_aroma: "standard",
  c1_temperature: "normal", c1_shots: 0, c1_portion_ml: 80,
  c2_process: "milk", c2_intensity: "medium", c2_aroma: "standard",
  c2_temperature: "normal", c2_shots: 3, c2_portion_ml: 100,
} as DirectKeyRecipe;

const sendMessagePromise = vi.fn().mockResolvedValue({});
const conn = { sendMessagePromise } as unknown as Connection;
const entities = {
  "sensor.mb_state": ent("Ready"),
  "sensor.mb_connection": ent("Connected"),
  "select.mb_recipe": ent("Foam", {
    options: ["Foam", "Warm"],
    recipes: {
      Foam: { ...RECIPE, c1_shots: 0, c2_shots: 0 },
      Warm: { ...RECIPE, c1_shots: 1, c2_shots: 2 },
    },
  }),
} as unknown as HassEntities;

function renderFreestyle(contract: UiContract | null = null, currentEntities = entities) {
  return renderWithProviders(<FreestyleSection conn={conn} entities={currentEntities} prefix="mb" contract={contract} />);
}

function renderEditor(recipe = RECIPE, contract: UiContract | null = null) {
  return renderWithProviders(<RecipeEditModal conn={conn} brewEntityId="button.mb_brew"
    category="espresso" categoryLabel="Espresso" recipe={recipe} profileId={4}
    onClose={() => {}} contract={contract} />);
}

function chooseProcess(component: 1 | 2, name: string) {
  fireEvent.click(within(screen.getByRole("radiogroup", { name: `Component ${component}` })).getByRole("radio", { name }));
}

function modeRows() {
  return screen.getAllByRole("radiogroup", { name: "Milk mode" });
}

function chooseMode(row: number, name: "Milk" | "Milk Froth") {
  fireEvent.click(within(modeRows()[row]).getByRole("radio", { name }));
}

function lastPayload(service: string) {
  expect(sendMessagePromise).toHaveBeenLastCalledWith(expect.objectContaining({
    type: "call_service", domain: "melitta_barista", service,
  }));
  const data = sendMessagePromise.mock.calls.at(-1)![0].service_data;
  expect(data).not.toHaveProperty("milk_mode1");
  expect(data).not.toHaveProperty("milk_mode2");
  return data;
}

beforeEach(() => {
  localStorage.clear();
  sendMessagePromise.mockClear();
  clearBrewOrigin();
  resetServerStrings();
});

describe("freestyle milk modes", () => {
  it("uses independent explicit milk choices in the actual old-server request and brew note", () => {
    localStorage.setItem("melitta_freestyle", JSON.stringify(BASE));
    renderFreestyle();
    chooseProcess(1, "Milk");
    chooseMode(0, "Milk Froth");
    chooseMode(1, "Milk");
    fireEvent.click(screen.getByRole("button", { name: "Brew Custom" }));
    expect(lastPayload("brew_freestyle")).toMatchObject({ process1: "milk", shots1: "none", process2: "milk", shots2: "one" });
    expect(brewOrigin()?.details).toMatchObject({ c1_shots: "none", c2_shots: "one" });
    expect(JSON.parse(localStorage.getItem("melitta_freestyle")!)).toMatchObject({ shots1: "three", shots2: "two", milk_mode1: "milk_froth", milk_mode2: "warm_milk" });
  });

  it("preserves coffee shots across coffee→milk→coffee on both components", () => {
    localStorage.setItem("melitta_freestyle", JSON.stringify(BASE));
    renderFreestyle();
    chooseProcess(1, "Milk");
    chooseMode(0, "Milk Froth");
    chooseMode(1, "Milk");
    chooseProcess(1, "Coffee");
    chooseProcess(2, "Coffee");
    expect(screen.queryByRole("radiogroup", { name: "Milk mode" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Brew Custom" }));
    expect(lastPayload("brew_freestyle")).toMatchObject({ shots1: "three", shots2: "two" });
  });

  it.each(["two", "three"])("displays inherited warm milk without normalizing legacy cache shots %s", (shots) => {
    localStorage.setItem("melitta_freestyle", JSON.stringify({ ...BASE, process1: "milk", shots1: shots, shots2: shots }));
    renderFreestyle();
    for (const row of modeRows()) expect(within(row).getByRole("radio", { name: "Milk" })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("button", { name: "Brew Custom" }));
    expect(lastPayload("brew_freestyle")).toMatchObject({ shots1: shots, shots2: shots });
  });

  it.each([["Foam", "Milk Froth", "none", "none"], ["Warm", "Milk", "one", "two"]])(
    "loading %s clears stale explicit modes and uses actual saved shots", (name, label, shots1, shots2) => {
      localStorage.setItem("melitta_freestyle", JSON.stringify({ ...BASE, milk_mode1: "milk_froth", milk_mode2: "warm_milk" }));
      renderFreestyle();
      fireEvent.click(screen.getByRole("button", { name: /use recipe/i }));
      fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${name}`) }));
      for (const row of modeRows()) expect(within(row).getByRole("radio", { name: label })).toHaveAttribute("aria-checked", "true");
      fireEvent.click(screen.getByRole("button", { name: `Brew ${name}` }));
      expect(lastPayload("brew_freestyle")).toMatchObject({ shots1, shots2 });
      const stored = JSON.parse(localStorage.getItem("melitta_freestyle")!);
      expect(stored.milk_mode1).toBeUndefined();
      expect(stored.milk_mode2).toBeUndefined();
    },
  );

  it.each([
    ["milk_froth", { milk_mode: "milk_froth" }, "none"],
    ["warm_milk", { milk_mode: "warm_milk" }, "one"],
    ["warm_milk", { milk_mode: null }, "three"],
    ["milk_froth", {}, "none"],
  ])("seeds optional native mode %s with attributes %j", (nativeMode, attributes, shots) => {
    renderFreestyle(null, {
      ...entities,
      "select.mb_freestyle_process_1": ent("milk"),
      "select.mb_freestyle_shots_1": ent("three"),
      "select.mb_freestyle_milk_mode_1": ent(nativeMode, attributes),
    } as HassEntities);
    expect(within(modeRows()[0]).getByRole("radio", { name: nativeMode === "milk_froth" ? "Milk Froth" : "Milk" })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("button", { name: "Brew Custom" }));
    expect(lastPayload("brew_freestyle").shots1).toBe(shots);
  });
});

describe("shared recipe editor milk modes", () => {
  it("derives foam/warm labels and preserves unedited legacy recipe shots", () => {
    renderEditor();
    expect(within(modeRows()[0]).getByRole("radio", { name: "Milk Froth" })).toHaveAttribute("aria-checked", "true");
    expect(within(modeRows()[1]).getByRole("radio", { name: "Milk" })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(lastPayload("save_directkey")).toMatchObject({ category: "espresso", profile_id: 4, shots1: "none", shots2: "three" });
  });

  it("serializes both explicit milk choices for the existing save service", () => {
    renderEditor();
    chooseMode(0, "Milk");
    chooseMode(1, "Milk Froth");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(lastPayload("save_directkey")).toMatchObject({ shots1: "one", shots2: "none", category: "espresso", profile_id: 4 });
  });

  it("keeps coffee shots independent of milk mode in both editor components", () => {
    renderEditor({ ...RECIPE, c1_process: "coffee", c1_shots: 2, c2_process: "coffee", c2_shots: 3 });
    chooseProcess(1, "Milk");
    chooseProcess(2, "Milk");
    chooseMode(0, "Milk Froth");
    chooseMode(1, "Milk");
    chooseProcess(1, "Coffee");
    chooseProcess(2, "Coffee");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(lastPayload("save_directkey")).toMatchObject({ shots1: "two", shots2: "three" });
  });

  it.each([
    { kind: "enum", scope: ["freestyle"], tokens: ["milk_froth", "warm_milk"] },
    { kind: "future_kind", scope: ["freestyle"], tokens: ["unknown"] },
    { kind: "enum", scope: ["brew_override"], tokens: ["unknown"] },
  ])("honors compatible descriptor tokens and falls back for unknown kind/scope: %j", (descriptor) => {
    const contract = clone(MELITTA_CONTRACT_FULL);
    contract.parameters!.milk_mode = descriptor;
    renderEditor(RECIPE, contract);
    const labels = within(modeRows()[0]).getAllByRole("radio").map((node) => node.textContent);
    expect(labels).toEqual(descriptor.kind === "enum" && descriptor.scope.includes("freestyle") ? ["Milk Froth", "Milk"] : ["Milk", "Milk Froth"]);
    chooseMode(0, "Milk");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(lastPayload("save_directkey").shots1).toBe("one");
  });

  it("prefers server mode labels over existing recipe translations", () => {
    setServerStrings({ "values.milk_mode.warm_milk": "Warm choice", "values.milk_mode.milk_froth": "Foam choice", "recipes.name.warm_milk": "Old warm" });
    renderEditor();
    fireEvent.click(within(modeRows()[0]).getByRole("radio", { name: "Warm choice" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(lastPayload("save_directkey").shots1).toBe("one");
  });

  it("falls back to legacy server recipe labels before client drink labels", () => {
    setServerStrings({ "recipes.name.warm_milk": "Legacy warm", "recipes.name.milk_froth": "Legacy foam" });
    renderEditor();
    fireEvent.click(within(modeRows()[1]).getByRole("radio", { name: "Legacy foam" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(lastPayload("save_directkey").shots2).toBe("none");
  });
});
