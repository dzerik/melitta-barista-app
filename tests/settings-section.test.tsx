/**
 * Zone P-E — v3 settings (UI Contract §9.1).
 *
 * Pure resolution logic (src/lib/settings.ts) + SettingsSection rendering:
 * catalog mode from `contract.settings` (groups, control kinds, level tokens,
 * server-string labels, Nivona selects via select.select_option), the §9.1.6
 * entity-absence gate, and the legacy SWITCHES/NUMBERS/LEVEL_LABELS tables as
 * the permanent tier-2 fallback.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import type {
  Connection,
  HassEntities,
  HassEntity,
} from "home-assistant-js-websocket";
import { renderWithProviders } from "./test-utils";
import { SettingsSection } from "../src/components/SettingsSection";
import {
  MELITTA_CONTRACT,
  MELITTA_CONTRACT_FULL,
  MELITTA_SETTINGS,
  NIVONA_CONTRACT_FULL,
} from "./fixtures/contracts";
import type { SettingDescriptor, UiContract } from "../src/lib/contract";
import { setServerStrings, resetServerStrings } from "../src/lib/server-strings";
import {
  resolveSettingsCatalog,
  settingsGroups,
  settingEntityId,
  settingControlKind,
  settingIconName,
  settingLabel,
  settingDescription,
  settingGroupLabel,
  settingLevelLabel,
  settingOptionLabel,
  levelTokenForValue,
  formatSettingValue,
  numberBounds,
  DEFAULT_SETTING_ICON,
} from "../src/lib/settings";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function ent(
  state: string,
  attributes: Record<string, unknown> = {},
): HassEntity {
  return {
    entity_id: "",
    state,
    attributes,
    last_changed: "",
    last_updated: "",
    context: { id: "", user_id: null, parent_id: null },
  } as unknown as HassEntity;
}

function melittaEntities(): HassEntities {
  return {
    "switch.mel_auto_bean_select": ent("on"),
    "number.mel_brew_temperature": ent("1", { min: 0, max: 2, step: 1 }),
    "number.mel_water_hardness": ent("2", { min: 1, max: 4, step: 1 }),
    "number.mel_auto_off_after": ent("30", { min: 15, max: 240, step: 15 }),
  };
}

function nivonaEntities(): HassEntities {
  return {
    "select.niv_temperature": ent("normal"),
    "select.niv_profile": ent("dynamic"),
    "select.niv_water_hardness": ent("medium"),
    "select.niv_off_rinse": ent("off"),
    "select.niv_auto_off": ent("10 min"),
  };
}

function legacyEntities(): HassEntities {
  return {
    "switch.mel_energy_saving": ent("on"),
    "switch.mel_auto_bean_select": ent("off"),
    "switch.mel_rinsing_disabled": ent("off"),
    "number.mel_water_hardness": ent("2", { min: 1, max: 4, step: 1 }),
    "number.mel_auto_off_after": ent("30", { min: 15, max: 240, step: 15 }),
    "number.mel_brew_temperature": ent("1", { min: 0, max: 2, step: 1 }),
  };
}

function makeConn() {
  const sendMessagePromise = vi.fn((msg: { type: string }) =>
    msg.type === "custom_components"
      ? new Promise(() => {})
      : Promise.resolve(undefined),
  );
  return {
    conn: { sendMessagePromise } as unknown as Connection,
    sendMessagePromise,
  };
}

function contractWith(settings: SettingDescriptor[]): UiContract {
  return { ...MELITTA_CONTRACT, settings };
}

const WATER_HARDNESS_NUMBER = MELITTA_SETTINGS[2] as SettingDescriptor;
const AUTO_OFF_AFTER = MELITTA_SETTINGS[3] as SettingDescriptor;
const AUTO_BEAN_SWITCH = MELITTA_SETTINGS[0] as SettingDescriptor;

function headers(container: HTMLElement): string[] {
  return Array.from(
    container.querySelectorAll(".settings-header-enter"),
  ).map((el) => el.textContent ?? "");
}

beforeEach(() => {
  localStorage.clear();
  resetServerStrings();
});

// ---------------------------------------------------------------------------
// Pure logic — catalog resolution & grouping
// ---------------------------------------------------------------------------

describe("resolveSettingsCatalog", () => {
  it("returns null without a contract (tier-2 fallback trigger)", () => {
    expect(resolveSettingsCatalog(null)).toBeNull();
  });

  it("returns null when the contract has no settings block (pre-0.93 server)", () => {
    expect(resolveSettingsCatalog(MELITTA_CONTRACT)).toBeNull();
  });

  it("returns the served entries for a v3 contract", () => {
    const catalog = resolveSettingsCatalog(MELITTA_CONTRACT_FULL);
    expect(catalog?.map((e) => e.setting)).toEqual([
      "auto_bean_select",
      "brew_temperature",
      "water_hardness",
      "auto_off_after",
    ]);
  });

  it("drops malformed entries (missing entity domain / setting token)", () => {
    const catalog = resolveSettingsCatalog(
      contractWith([
        AUTO_BEAN_SWITCH,
        { setting: "broken", control: "switch", group: "brew", entity: { entity_suffix: "broken" }, writable: true },
        { control: "switch", group: "brew", entity: { domain: "switch", entity_suffix: "x" }, writable: true },
      ] as unknown as SettingDescriptor[]),
    );
    expect(catalog?.map((e) => e.setting)).toEqual(["auto_bean_select"]);
  });
});

describe("settingsGroups", () => {
  it("orders known groups brew, water, power, system", () => {
    const catalog = resolveSettingsCatalog(MELITTA_CONTRACT_FULL)!;
    expect(settingsGroups(catalog).map((g) => g.group)).toEqual([
      "brew",
      "water",
      "power",
    ]);
  });

  it("keeps served entry order inside a group", () => {
    const catalog = resolveSettingsCatalog(NIVONA_CONTRACT_FULL)!;
    const brew = settingsGroups(catalog).find((g) => g.group === "brew")!;
    expect(brew.entries.map((e) => e.setting)).toEqual(["temperature", "profile"]);
  });

  it("places unknown groups after known ones in served order", () => {
    const groups = settingsGroups([
      { ...AUTO_BEAN_SWITCH, group: "experimental" },
      { ...WATER_HARDNESS_NUMBER },
      { ...AUTO_OFF_AFTER, group: "lab" },
    ]);
    expect(groups.map((g) => g.group)).toEqual(["water", "experimental", "lab"]);
  });
});

// ---------------------------------------------------------------------------
// Pure logic — entity binding, control kinds, icons
// ---------------------------------------------------------------------------

describe("settingEntityId / numberBounds / settingControlKind / settingIconName", () => {
  it("assembles <domain>.<prefix>_<entity_suffix> (§9.1.1 anchor)", () => {
    expect(settingEntityId("mel", WATER_HARDNESS_NUMBER)).toBe(
      "number.mel_water_hardness",
    );
  });

  it("numberBounds: the live entity is authoritative over the contract (§9.1.6 rule 5)", () => {
    const entity = ent("2", { min: 1, max: 5, step: 2 });
    expect(numberBounds(WATER_HARDNESS_NUMBER, entity)).toEqual({
      min: 1,
      max: 5,
      step: 2,
    });
  });

  it("numberBounds: contract values render before the entity loads, then defaults", () => {
    expect(numberBounds(WATER_HARDNESS_NUMBER, undefined)).toEqual({
      min: 1,
      max: 4,
      step: 1,
    });
    expect(
      numberBounds(
        { ...WATER_HARDNESS_NUMBER, min: undefined, max: undefined, step: undefined },
        undefined,
      ),
    ).toEqual({ min: 0, max: 100, step: 1 });
  });

  it("settingControlKind: known controls pass; writable:false and unknown kinds degrade to readonly", () => {
    expect(settingControlKind(AUTO_BEAN_SWITCH)).toBe("switch");
    expect(settingControlKind(WATER_HARDNESS_NUMBER)).toBe("number");
    expect(settingControlKind({ ...AUTO_BEAN_SWITCH, writable: false })).toBe("readonly");
    expect(settingControlKind({ ...AUTO_BEAN_SWITCH, control: "dial" })).toBe("readonly");
  });

  it("settingIconName: served mdi names pass; absent/malformed default to mdi:tune (§9.1.1)", () => {
    expect(settingIconName(AUTO_BEAN_SWITCH)).toBe("mdi:grain");
    expect(settingIconName({ ...AUTO_BEAN_SWITCH, icon: undefined })).toBe(DEFAULT_SETTING_ICON);
    expect(settingIconName({ ...AUTO_BEAN_SWITCH, icon: "lucide:bean" })).toBe(DEFAULT_SETTING_ICON);
  });
});

// ---------------------------------------------------------------------------
// Pure logic — display chains (§9.1.4 / §9.1.6 rule 3)
// ---------------------------------------------------------------------------

describe("settings display chains", () => {
  it("settingLabel: server string wins over the bundle", () => {
    setServerStrings({ "settings.water_hardness.label": "Härtegrad" });
    expect(settingLabel("en", "water_hardness")).toBe("Härtegrad");
  });

  it("settingLabel: legacy bundle key next, humanized token last", () => {
    expect(settingLabel("en", "water_hardness")).toBe("Water Hardness");
    expect(settingLabel("en", "auto_bean_select")).toBe("Auto Bean Select");
    expect(settingLabel("en", "cup_heater")).toBe("Cup heater");
  });

  it("settingDescription: server → legacy *_desc key → null (omit)", () => {
    setServerStrings({ "settings.energy_saving.description": "Served desc" });
    expect(settingDescription("en", "energy_saving")).toBe("Served desc");
    resetServerStrings();
    expect(settingDescription("en", "energy_saving")).toBe(
      "Reduce power consumption when idle",
    );
    expect(settingDescription("en", "cup_heater")).toBeNull();
  });

  it("settingGroupLabel: server _groups key → bundle → humanized", () => {
    setServerStrings({ "settings._groups.water": "Wasser (served)" });
    expect(settingGroupLabel("en", "water")).toBe("Wasser (served)");
    resetServerStrings();
    expect(settingGroupLabel("en", "water")).toBe("Water");
    expect(settingGroupLabel("en", "experimental")).toBe("Experimental");
  });

  it("settingLevelLabel: per-setting server key → shared _levels tier → bundle → humanized", () => {
    setServerStrings({
      "settings.water_hardness.levels.soft": "Weich",
      "settings._levels.soft": "Soft (shared)",
      "settings._levels.on": "On (shared)",
    });
    expect(settingLevelLabel("en", "water_hardness", "soft")).toBe("Weich");
    expect(settingLevelLabel("en", "off_rinse", "on")).toBe("On (shared)");
    resetServerStrings();
    expect(settingLevelLabel("en", "water_hardness", "soft")).toBe("Soft");
    expect(settingLevelLabel("en", "off_rinse", "on")).toBe("On");
  });

  it("settingOptionLabel: tokenized options localize; token-less render the served label verbatim", () => {
    expect(
      settingOptionLabel("en", "water_hardness", { value: 3, token: "very_hard", label: "very hard" }),
    ).toBe("Very Hard");
    expect(
      settingOptionLabel("en", "profile", { value: 0, token: null, label: "dynamic" }),
    ).toBe("dynamic");
  });

  it("levelTokenForValue / formatSettingValue: ladder label, unit, raw number — no invented levels", () => {
    expect(levelTokenForValue(WATER_HARDNESS_NUMBER, 2)).toBe("medium");
    expect(levelTokenForValue(WATER_HARDNESS_NUMBER, 7)).toBeNull();
    expect(levelTokenForValue(AUTO_OFF_AFTER, 30)).toBeNull();
    expect(formatSettingValue("en", WATER_HARDNESS_NUMBER, 2)).toBe("Medium");
    expect(formatSettingValue("en", AUTO_OFF_AFTER, 30)).toBe("30 min");
    expect(
      formatSettingValue("en", { ...AUTO_OFF_AFTER, unit: undefined }, 30),
    ).toBe("30");
  });
});

// ---------------------------------------------------------------------------
// Component — catalog mode (tier 1)
// ---------------------------------------------------------------------------

describe("SettingsSection catalog mode", () => {
  it("renders §9.1.3 group headers in order, not the legacy headers", () => {
    const { conn } = makeConn();
    const { container } = renderWithProviders(
      <SettingsSection
        conn={conn}
        entities={melittaEntities()}
        prefix="mel"
        contract={MELITTA_CONTRACT_FULL}
      />,
    );
    expect(headers(container)).toEqual(["Brew", "Water", "Power"]);
    expect(screen.queryByText("Toggles")).toBeNull();
    expect(screen.queryByText("Adjustments")).toBeNull();
  });

  it("labels resolve through the chain (bundle fallback without server strings)", () => {
    const { conn } = makeConn();
    renderWithProviders(
      <SettingsSection
        conn={conn}
        entities={melittaEntities()}
        prefix="mel"
        contract={MELITTA_CONTRACT_FULL}
      />,
    );
    expect(screen.getByText("Auto Bean Select")).toBeInTheDocument();
    expect(screen.getByText("Water Hardness")).toBeInTheDocument();
    expect(screen.getByText("Brew Temperature")).toBeInTheDocument();
    expect(screen.getByText("Auto Off")).toBeInTheDocument();
  });

  it("server strings override labels and group headers when loaded", () => {
    setServerStrings({
      "settings.water_hardness.label": "Härtegrad",
      "settings._groups.water": "Wasser",
    });
    const { conn } = makeConn();
    const { container } = renderWithProviders(
      <SettingsSection
        conn={conn}
        entities={melittaEntities()}
        prefix="mel"
        contract={MELITTA_CONTRACT_FULL}
      />,
    );
    expect(screen.getByText("Härtegrad")).toBeInTheDocument();
    expect(headers(container)).toContain("Wasser");
  });

  it("level tokens render server-chain labels for the current value", () => {
    const { conn } = makeConn();
    renderWithProviders(
      <SettingsSection
        conn={conn}
        entities={melittaEntities()}
        prefix="mel"
        contract={MELITTA_CONTRACT_FULL}
      />,
    );
    // water_hardness state 2 → token "medium" → bundle "Medium";
    // brew_temperature state 1 → "Normal"; auto_off_after has no levels → "30 min".
    expect(screen.getByText("Medium")).toBeInTheDocument();
    expect(screen.getByText("Normal")).toBeInTheDocument();
    expect(screen.getByText("30 min")).toBeInTheDocument();
  });

  it("display hints: slider entries render range inputs, box entries a number input", () => {
    const { conn } = makeConn();
    renderWithProviders(
      <SettingsSection
        conn={conn}
        entities={melittaEntities()}
        prefix="mel"
        contract={MELITTA_CONTRACT_FULL}
      />,
    );
    expect(screen.getByRole("slider", { name: "Water Hardness" })).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "Brew Temperature" })).toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: "Auto Off" })).toBeInTheDocument();
  });

  it("hides an entry whose bound entity has no state object (§9.1.6 rule 2)", () => {
    const entities = melittaEntities();
    delete entities["number.mel_water_hardness"];
    const { conn } = makeConn();
    const { container } = renderWithProviders(
      <SettingsSection
        conn={conn}
        entities={entities}
        prefix="mel"
        contract={MELITTA_CONTRACT_FULL}
      />,
    );
    expect(screen.queryByText("Water Hardness")).toBeNull();
    // water_hardness was the water group's only member with a live entity, so
    // the whole group header disappears with it.
    expect(headers(container)).toEqual(["Brew", "Power"]);
  });

  it("switch toggle + Apply writes switch.turn_off through the bound entity", async () => {
    const { conn, sendMessagePromise } = makeConn();
    renderWithProviders(
      <SettingsSection
        conn={conn}
        entities={melittaEntities()}
        prefix="mel"
        contract={MELITTA_CONTRACT_FULL}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Auto Bean Select" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply Changes" }));
    expect(sendMessagePromise).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "call_service",
        domain: "switch",
        service: "turn_off",
        service_data: expect.objectContaining({
          entity_id: "switch.mel_auto_bean_select",
        }),
      }),
    );
  });

  it("number change + Apply writes number.set_value with the new value", () => {
    const { conn, sendMessagePromise } = makeConn();
    renderWithProviders(
      <SettingsSection
        conn={conn}
        entities={melittaEntities()}
        prefix="mel"
        contract={MELITTA_CONTRACT_FULL}
      />,
    );
    fireEvent.change(screen.getByRole("slider", { name: "Water Hardness" }), {
      target: { value: "3" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply Changes" }));
    expect(sendMessagePromise).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "call_service",
        domain: "number",
        service: "set_value",
        service_data: expect.objectContaining({
          entity_id: "number.mel_water_hardness",
          value: 3,
        }),
      }),
    );
  });

  it("writable:false renders a read-only row, never a disabled control (§9.1.6 rule 6)", () => {
    const { conn } = makeConn();
    renderWithProviders(
      <SettingsSection
        conn={conn}
        entities={melittaEntities()}
        prefix="mel"
        contract={contractWith([{ ...AUTO_BEAN_SWITCH, writable: false }])}
      />,
    );
    expect(screen.getByText("Auto Bean Select")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Auto Bean Select" })).toBeNull();
    // Boolean state localizes via the shared _levels chain (humanized "On").
    expect(screen.getByText("On")).toBeInTheDocument();
  });

  it("an unknown control kind degrades to a read-only value row (§5.3.2)", () => {
    const { conn } = makeConn();
    renderWithProviders(
      <SettingsSection
        conn={conn}
        entities={melittaEntities()}
        prefix="mel"
        contract={contractWith([{ ...WATER_HARDNESS_NUMBER, control: "dial" }])}
      />,
    );
    expect(screen.getByText("Water Hardness")).toBeInTheDocument();
    expect(screen.queryByRole("slider")).toBeNull();
    expect(screen.queryByRole("spinbutton")).toBeNull();
  });

  it("settings: [] is catalog mode with nothing to render, not legacy fallback", () => {
    const { conn } = makeConn();
    const { container } = renderWithProviders(
      <SettingsSection
        conn={conn}
        entities={legacyEntities()}
        prefix="mel"
        contract={contractWith([])}
      />,
    );
    expect(headers(container)).toEqual([]);
    expect(screen.queryByText("Toggles")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Component — Nivona selects (select.select_option arrives free via P-A)
// ---------------------------------------------------------------------------

describe("SettingsSection Nivona selects", () => {
  it("renders one combobox per served select entry with chain-localized options", () => {
    const { conn } = makeConn();
    renderWithProviders(
      <SettingsSection
        conn={conn}
        entities={nivonaEntities()}
        prefix="niv"
        contract={NIVONA_CONTRACT_FULL}
      />,
    );
    const hardness = screen.getByRole("combobox", { name: "Water Hardness" });
    const optionTexts = Array.from(hardness.querySelectorAll("option")).map(
      (o) => o.textContent,
    );
    // Tokenized options localize (bundle level.* tier); values stay the served labels.
    expect(optionTexts).toEqual(["Soft", "Medium", "Hard", "Very Hard"]);
    const profile = screen.getByRole("combobox", { name: "Profile" });
    // Token-less options render the served label verbatim.
    expect(
      Array.from(profile.querySelectorAll("option")).map((o) => o.textContent),
    ).toEqual(["dynamic", "constant", "intense", "individual"]);
  });

  it("select change + Apply writes select.select_option with the served label string (§9.1.6 rule 4)", () => {
    const { conn, sendMessagePromise } = makeConn();
    renderWithProviders(
      <SettingsSection
        conn={conn}
        entities={nivonaEntities()}
        prefix="niv"
        contract={NIVONA_CONTRACT_FULL}
      />,
    );
    fireEvent.change(screen.getByRole("combobox", { name: "Temperature" }), {
      target: { value: "high" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply Changes" }));
    expect(sendMessagePromise).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "call_service",
        domain: "select",
        service: "select_option",
        service_data: expect.objectContaining({
          entity_id: "select.niv_temperature",
          option: "high",
        }),
      }),
    );
  });

  it("hides a select whose entity is absent (NICR 758 omits profile — §9.1.2.5 lag class)", () => {
    const entities = nivonaEntities();
    delete entities["select.niv_profile"];
    const { conn } = makeConn();
    renderWithProviders(
      <SettingsSection
        conn={conn}
        entities={entities}
        prefix="niv"
        contract={NIVONA_CONTRACT_FULL}
      />,
    );
    expect(screen.queryByRole("combobox", { name: "Profile" })).toBeNull();
    expect(screen.getByRole("combobox", { name: "Temperature" })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Component — legacy fallback (tier 2, byte-identical behavior)
// ---------------------------------------------------------------------------

describe("SettingsSection legacy fallback", () => {
  it("renders the legacy tables when no contract is wired", () => {
    const { conn } = makeConn();
    renderWithProviders(
      <SettingsSection conn={conn} entities={legacyEntities()} prefix="mel" />,
    );
    expect(screen.getByText("Toggles")).toBeInTheDocument();
    expect(screen.getByText("Adjustments")).toBeInTheDocument();
    expect(screen.getByText("Energy Saving")).toBeInTheDocument();
    expect(screen.getByText("Rinsing Disabled")).toBeInTheDocument();
    // Legacy level labels for the current values.
    expect(screen.getByText("Medium")).toBeInTheDocument();
    expect(screen.getByText("30 min")).toBeInTheDocument();
  });

  it("renders the legacy tables when the contract has no settings block (pre-0.93 server)", () => {
    const { conn } = makeConn();
    renderWithProviders(
      <SettingsSection
        conn={conn}
        entities={legacyEntities()}
        prefix="mel"
        contract={MELITTA_CONTRACT}
      />,
    );
    expect(screen.getByText("Toggles")).toBeInTheDocument();
    expect(screen.getByText("Adjustments")).toBeInTheDocument();
  });

  it("legacy mode hides rows for missing entities (unchanged behavior)", () => {
    const entities = legacyEntities();
    delete entities["switch.mel_auto_bean_select"];
    const { conn } = makeConn();
    renderWithProviders(
      <SettingsSection conn={conn} entities={entities} prefix="mel" />,
    );
    expect(screen.queryByText("Auto Bean Select")).toBeNull();
    expect(screen.getByText("Energy Saving")).toBeInTheDocument();
  });

  it("legacy apply still writes through the hardcoded suffix tables", () => {
    const { conn, sendMessagePromise } = makeConn();
    renderWithProviders(
      <SettingsSection conn={conn} entities={legacyEntities()} prefix="mel" />,
    );
    fireEvent.click(
      screen.getAllByRole("button").find((b) => b.textContent === "")!,
    );
    fireEvent.click(screen.getByRole("button", { name: "Apply Changes" }));
    expect(sendMessagePromise).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "call_service",
        domain: "switch",
        service_data: expect.objectContaining({
          entity_id: "switch.mel_energy_saving",
        }),
      }),
    );
  });
});
