import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, renderHook, screen, waitFor, within } from "@testing-library/react";
import type { Connection, HassEntities } from "home-assistant-js-websocket";
import { BrewSection } from "../src/components/BrewSection";
import { useRecipeCache } from "../src/hooks/useRecipeCache";
import { brewOrigin, clearBrewOrigin } from "../src/lib/brew-origin";
import { usePreferences } from "../src/lib/preferences";
import { resetServerStrings, setServerStrings } from "../src/lib/server-strings";
import { MELITTA_CONTRACT_FULL } from "./fixtures/contracts";
import { renderWithProviders } from "./test-utils";

const LUNGO = { type: 2, name: "Lungo", name_key: "lungo" };
const RISTRETTO = { type: 1, name: "Ristretto", name_key: "ristretto" };
const DOPPIO = { type: 3, name: "Espresso Doppio", name_key: "espresso_doppio" };
const RECIPE = {
  category: 0,
  c1_process: "coffee", c1_intensity: "strong", c1_aroma: "standard",
  c1_temperature: "normal", c1_shots: 1, c1_portion_ml: 80,
  c2_process: "none", c2_intensity: "medium", c2_aroma: "standard",
  c2_temperature: "normal", c2_shots: 0, c2_portion_ml: 0,
};

function ent(state: string, attributes: Record<string, unknown> = {}) {
  return { entity_id: "", state, attributes, last_changed: "", last_updated: "",
    context: { id: "", parent_id: null, user_id: null } };
}

function machine(drinks: unknown = { 1: { espresso: LUNGO } }, active = 1): HassEntities {
  return {
    "sensor.melitta_connection": ent("Connected", { connected: true }),
    "sensor.melitta_state": ent("Ready", {
      process_token: "READY", sub_process_token: null, manipulation_token: "NONE",
      is_brewing: false, awaiting_confirmation: false, info_messages: [],
    }),
    "select.melitta_recipe": ent("Espresso", { options: ["Espresso"], recipes: { Espresso: RECIPE } }),
    "select.melitta_profile": ent(`Profile ${active}`, {
      options: ["My Coffee", "Profile 1", "Profile 2", "Profile 3"], active_profile: active,
      directkey_recipes: { 1: { Espresso: RECIPE }, 2: { Espresso: RECIPE }, 3: { Espresso: RECIPE } },
      ...(drinks === undefined ? {} : { directkey_drinks: drinks }),
    }),
    "switch.melitta_profile_1_active": ent("on"),
    "switch.melitta_profile_2_active": ent("on"),
    "switch.melitta_profile_3_active": ent("on"),
    "button.melitta_brew": ent("unknown"),
  } as unknown as HassEntities;
}

const sendMessagePromise = vi.fn().mockResolvedValue({});
const conn = { sendMessagePromise } as unknown as Connection;

function band(container: HTMLElement) {
  return within(container.querySelector<HTMLElement>('[data-ui="directkey-mosaic"]')!);
}

function LocaleSwitch() {
  const { setLocale } = usePreferences();
  return <button onClick={() => {
    setServerStrings({ "recipes.name.lungo": "Лунго" });
    setLocale("ru");
  }}>Russian</button>;
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("melitta_view_mode", "list");
  localStorage.setItem("melitta_locale", "en");
  resetServerStrings();
  clearBrewOrigin();
  sendMessagePromise.mockReset().mockResolvedValue({});
});

describe("configured DirectKey drink cache", () => {
  it("joins identity by profile and category without mutating shared HA attributes", () => {
    const entities = machine({ 1: { espresso: LUNGO }, 2: { espresso: RISTRETTO } });
    const before = JSON.stringify(entities);
    const { result, rerender } = renderHook(({ entities }) => useRecipeCache(entities, "melitta"), {
      initialProps: { entities },
    });
    expect(result.current.directKey?.profiles[1].espresso).toMatchObject({ configured_recipe: LUNGO, category: 0 });
    expect(result.current.directKey?.profiles[2].espresso).toMatchObject({ configured_recipe: RISTRETTO });
    expect(result.current.directKey?.profiles[3].espresso).not.toHaveProperty("configured_recipe", LUNGO);
    expect(JSON.stringify(entities)).toBe(before);
    rerender({ entities: machine({}) });
    expect(result.current.directKey?.profiles[1].espresso.configured_recipe).toBeNull();
  });

  it.each([
    null, "bad", [[]], { type: true, name: "Lungo", name_key: "lungo" },
    { type: 24, name: "Freestyle", name_key: "freestyle" },
    { type: 255, name: "Unknown", name_key: "unknown" },
    { type: 2.5, name: "Lungo", name_key: "lungo" },
    { type: 2, name: "", name_key: "lungo" },
    { type: 2, name: "Lungo", name_key: 3 },
  ])("ignores malformed or unknown identity %j", (identity) => {
    const entities = machine({ 1: { espresso: identity } });
    const { result } = renderHook(() => useRecipeCache(entities, "melitta"));
    expect(result.current.directKey?.profiles[1].espresso.configured_recipe).toBeNull();
  });
});

describe("configured DirectKey titles and targets", () => {
  it("shows Lungo, arms that title, and brews the unchanged espresso slot", async () => {
    const { container } = renderWithProviders(<BrewSection conn={conn} entities={machine()} prefix="melitta" />);
    fireEvent.click(band(container).getByRole("button", { name: /(?:^| )Lungo$/ }));
    fireEvent.click(band(container).getByRole("button", { name: /(?:^| )Brew Lungo$/ }));
    await waitFor(() => expect(sendMessagePromise).toHaveBeenCalledWith({
      type: "call_service", domain: "melitta_barista", service: "brew_directkey",
      service_data: { entity_id: "button.melitta_brew", category: "espresso", two_cups: false },
    }));
    expect(brewOrigin()?.name).toBe("Lungo");
  });

  it("updates the same category across profiles and on metadata refresh/removal", () => {
    const drinks = { 1: { espresso: LUNGO }, 2: { espresso: RISTRETTO }, 3: { espresso: DOPPIO } };
    const renderSection = (entities: HassEntities) => <BrewSection conn={conn} entities={entities} prefix="melitta" />;
    const { container, rerender } = renderWithProviders(renderSection(machine(drinks)));
    expect(band(container).getByRole("button", { name: /(?:^| )Lungo$/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Profile 2" }));
    expect(sendMessagePromise).toHaveBeenCalledWith(expect.objectContaining({
      service: "select_option", service_data: { entity_id: "select.melitta_profile", option: "Profile 2" },
    }));
    rerender(renderSection(machine(drinks, 2)));
    expect(band(container).getByRole("button", { name: /(?:^| )Ristretto$/ })).toBeInTheDocument();
    rerender(renderSection(machine(drinks, 3)));
    expect(band(container).getByRole("button", { name: /(?:^| )Espresso Doppio$/ })).toBeInTheDocument();
    rerender(renderSection(machine({ 3: { espresso: LUNGO } }, 3)));
    expect(band(container).getByRole("button", { name: /(?:^| )Lungo$/ })).toBeInTheDocument();
    rerender(renderSection(machine({}, 3)));
    expect(band(container).getByRole("button", { name: /(?:^| )Espresso$/ })).toBeInTheDocument();
  });

  it("uses recipe localization, reacts to locale changes and falls back to server English", () => {
    setServerStrings({ "recipes.name.lungo": "Langer Kaffee" });
    const { container, rerender } = renderWithProviders(<><LocaleSwitch /><BrewSection conn={conn} entities={machine()} prefix="melitta" /></>);
    expect(band(container).getByRole("button", { name: /(?:^| )Langer Kaffee$/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Russian" }));
    expect(band(container).getByRole("button", { name: /(?:^| )Лунго$/ })).toBeInTheDocument();
    act(() => resetServerStrings());
    rerender(<><LocaleSwitch /><BrewSection conn={conn} entities={machine()} prefix="melitta" /></>);
    expect(band(container).getByRole("button", { name: /(?:^| )Lungo$/ })).toBeInTheDocument();
  });

  it("keeps category labels after metadata disappears from an older backend", () => {
    const entities = machine();
    delete entities["select.melitta_profile"].attributes.directkey_drinks;
    const { container } = renderWithProviders(<BrewSection conn={conn} entities={entities} prefix="melitta" />);
    expect(band(container).getByRole("button", { name: /(?:^| )Espresso$/ })).toBeInTheDocument();
  });

  it.each([null, {}, [[]], "bad", { 1: null }, { 1: { espresso: null } }, { 1: { espresso: { type: 24, name: "Freestyle", name_key: "freestyle" } } }])(
    "keeps category labels for unavailable metadata %j", (drinks) => {
      const { container } = renderWithProviders(<BrewSection conn={conn} entities={machine(drinks)} prefix="melitta" />);
      expect(band(container).getByRole("button", { name: /(?:^| )Espresso$/ })).toBeInTheDocument();
    },
  );

  it("updates pushed names while contract WS recipe details stay cached", async () => {
    const row = {
      id: 312, category: "espresso", name: "Espresso", type: 0,
      configured_recipe: RISTRETTO,
      components: [{ process: "coffee", intensity: "strong", aroma: "standard", temperature: "normal", shots: "one", portion_ml: 80 }],
    };
    sendMessagePromise.mockResolvedValue({ directkey: [{ profile_id: 1, recipes: [row] }] });
    const renderSection = (entities: HassEntities) => <BrewSection conn={conn} entities={entities} prefix="melitta" contract={MELITTA_CONTRACT_FULL} />;
    const { container, rerender } = renderWithProviders(renderSection(machine()));
    await waitFor(() => expect(sendMessagePromise).toHaveBeenCalledWith(expect.objectContaining({ type: "melitta_barista/recipes/list" })));
    expect(band(container).getByRole("button", { name: /(?:^| )Lungo$/ })).toBeInTheDocument();
    const count = sendMessagePromise.mock.calls.length;
    rerender(renderSection(machine({ 1: { espresso: DOPPIO } })));
    expect(band(container).getByRole("button", { name: /(?:^| )Espresso Doppio$/ })).toBeInTheDocument();
    rerender(renderSection(machine(null)));
    expect(band(container).getByRole("button", { name: /(?:^| )Espresso$/ })).toBeInTheDocument();
    expect(sendMessagePromise).toHaveBeenCalledTimes(count);
  });
});
