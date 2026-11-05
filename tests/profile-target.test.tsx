import { beforeEach, expect, it, vi } from "vitest";
import type { Connection, HassEntities } from "home-assistant-js-websocket";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { BrewSection } from "../src/components/BrewSection";
import { renderWithProviders } from "./test-utils";
import { MELITTA_CONTRACT } from "./fixtures/contracts";

const RECIPE = {
  category: 0,
  c1_process: "coffee", c1_intensity: "strong", c1_aroma: "standard",
  c1_temperature: "normal", c1_shots: 1, c1_portion_ml: 80,
  c2_process: "none", c2_intensity: "medium", c2_aroma: "standard",
  c2_temperature: "normal", c2_shots: 0, c2_portion_ml: 0,
};
const ent = (state: string, attributes = {}) => ({
  entity_id: "", state, attributes, last_changed: "", last_updated: "",
  context: { id: "", parent_id: null, user_id: null },
});
function machine(active: number, prefix = "melitta"): HassEntities {
  return {
    [`sensor.${prefix}_connection`]: ent("Connected", { connected: true }),
    [`sensor.${prefix}_state`]: ent("Ready", {
      process_token: "READY", sub_process_token: null, manipulation_token: "NONE",
      is_brewing: false, awaiting_confirmation: false, info_messages: [],
    }),
    [`select.${prefix}_recipe`]: ent("Espresso", { options: ["Espresso"], recipes: { Espresso: RECIPE } }),
    [`select.${prefix}_profile`]: ent(`Profile ${active}`, {
      options: ["My Coffee", "Profile 1", "Profile 2"], active_profile: active,
      directkey_recipes: {
        1: { Espresso: RECIPE },
        2: { Espresso: { ...RECIPE, c1_portion_ml: 140 } },
      },
    }),
    [`switch.${prefix}_profile_1_active`]: ent("on"),
    [`switch.${prefix}_profile_2_active`]: ent("on"),
    [`button.${prefix}_brew`]: ent("unknown"),
  };
}
function espressoTile(container: HTMLElement) {
  return within(container.querySelector<HTMLElement>('[data-ui="directkey-mosaic"]')!)
    .getByRole("button", { name: /(?:^| )Espresso$/ });
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("melitta_locale", "en");
  localStorage.setItem("melitta_view_mode", "list");
});

it.each(["double click", "long press"])("keeps the original profile after an external switch (%s)", async (opening) => {
  const sendMessagePromise = vi.fn().mockResolvedValue({});
  const conn = { sendMessagePromise } as unknown as Connection;
  const section = (active: number) => <BrewSection conn={conn} entities={machine(active)} prefix="melitta" />;
  const { container, rerender } = renderWithProviders(section(1));
  if (opening === "double click") {
    fireEvent.doubleClick(espressoTile(container));
  } else {
    vi.useFakeTimers();
    try {
      fireEvent.pointerDown(espressoTile(container));
      act(() => vi.advanceTimersByTime(500));
      fireEvent.pointerUp(espressoTile(container));
    } finally {
      vi.useRealTimers();
    }
  }
  expect(screen.getByRole("button", { name: "Save" })).toBeDefined();
  rerender(section(2));
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(sendMessagePromise).toHaveBeenCalledWith(expect.objectContaining({
    service: "save_directkey",
    service_data: expect.objectContaining({ entity_id: "button.melitta_brew", profile_id: 1, portion1_ml: 80 }),
  })));
});

it.each(["machine", "entry"])("closes the editor when the selected %s changes", (scope) => {
  const conn = { sendMessagePromise: vi.fn().mockResolvedValue({}) } as unknown as Connection;
  const section = (changed: boolean) => {
    const prefix = changed && scope === "machine" ? "other" : "melitta";
    const contract = { ...MELITTA_CONTRACT, entry_id: changed && scope === "entry" ? "entry-b" : "entry-a" };
    return <BrewSection conn={conn} entities={machine(1, prefix)} prefix={prefix} contract={contract} />;
  };
  const { container, rerender } = renderWithProviders(section(false));
  fireEvent.doubleClick(espressoTile(container));
  expect(screen.getByRole("button", { name: "Save" })).toBeDefined();
  rerender(section(true));
  expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
  rerender(section(false));
  expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
});
