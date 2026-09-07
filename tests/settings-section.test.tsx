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
import { fireEvent, screen, within } from "@testing-library/react";
import type {
  Connection,
  HassEntities,
  HassEntity,
} from "home-assistant-js-websocket";
import { renderWithProviders } from "./test-utils";
import { SettingsSection } from "../src/components/SettingsSection";
import { MaintenanceSection } from "../src/components/MaintenanceSection";
import {
  MELITTA_CONTRACT,
  MELITTA_CONTRACT_FULL,
  MELITTA_SETTINGS,
  NIVONA_CONTRACT_FULL,
} from "./fixtures/contracts";
import type { SettingDescriptor, UiContract } from "../src/lib/contract";
import { setServerStrings, resetServerStrings } from "../src/lib/server-strings";
import { ROW_GUTTER, ROW_LABEL_CLASS } from "../src/components/SettingsRow";
import { CARVE_OUTS } from "./hard-rules";
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

  // Sentence case, §7.5 and C33. Note that the humanizer at the end of the
  // chain has always produced sentence case ("Cup heater"), so a Title-Cased
  // bundle made an unlisted setting look different from a listed one for no
  // reason the user could see.
  it("settingLabel: legacy bundle key next, humanized token last", () => {
    expect(settingLabel("en", "water_hardness")).toBe("Water hardness");
    expect(settingLabel("en", "auto_bean_select")).toBe("Auto bean select");
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
    ).toBe("Very hard");
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
    expect(screen.getByText("Auto bean select")).toBeInTheDocument();
    expect(screen.getByText("Water hardness")).toBeInTheDocument();
    expect(screen.getByText("Brew temperature")).toBeInTheDocument();
    expect(screen.getByText("Auto off")).toBeInTheDocument();
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
    expect(screen.getByRole("slider", { name: "Water hardness" })).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "Brew temperature" })).toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: "Auto off" })).toBeInTheDocument();
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
    expect(screen.queryByText("Water hardness")).toBeNull();
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
    // A boolean is two words in a radiogroup named for the setting — there is
    // no switch in this language. Selection is the lit `--accent` underline,
    // and the unchosen word already holds a transparent slot of the same
    // width, so picking it shifts nothing.
    const group = screen.getByRole("radiogroup", { name: "Auto bean select" });
    const on = within(group).getByRole("radio", { name: "On" });
    const off = within(group).getByRole("radio", { name: "Off" });
    expect(on).toHaveAttribute("data-underline", "lit");
    expect(off).toHaveAttribute("data-underline", "reserved");
    expect(on.style.backgroundColor).toBe("");
    expect(off.style.borderBottomWidth).toBe(on.style.borderBottomWidth);

    fireEvent.click(off);
    expect(
      within(group).getByRole("radio", { name: "Off" }),
    ).toHaveAttribute("data-underline", "lit");
    fireEvent.click(screen.getByRole("button", { name: "Apply changes" }));
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
    fireEvent.change(screen.getByRole("slider", { name: "Water hardness" }), {
      target: { value: "3" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply changes" }));
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
    expect(screen.getByText("Auto bean select")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Auto bean select" })).toBeNull();
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
    expect(screen.getByText("Water hardness")).toBeInTheDocument();
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
  it("renders one word row per served select entry with chain-localized options", () => {
    const { conn } = makeConn();
    renderWithProviders(
      <SettingsSection
        conn={conn}
        entities={nivonaEntities()}
        prefix="niv"
        contract={NIVONA_CONTRACT_FULL}
      />,
    );
    // At or under the five-choice cap a select is drawn as words, not as a
    // filled `<select>` box (§C1) — one radiogroup per setting.
    const hardness = screen.getByRole("radiogroup", { name: "Water hardness" });
    const optionTexts = within(hardness)
      .getAllByRole("radio")
      .map((o) => o.textContent);
    // Tokenized options localize (bundle level.* tier); values stay the served labels.
    expect(optionTexts).toEqual(["Soft", "Medium", "Hard", "Very hard"]);
    // The chosen word is the only lit underline in its row, and it paints no fill.
    const chosen = within(hardness).getByRole("radio", { name: "Medium" });
    expect(chosen).toHaveAttribute("data-underline", "lit");
    expect(chosen).toHaveAttribute("aria-checked", "true");
    expect(chosen.style.backgroundColor).toBe("");
    expect(
      within(hardness)
        .getAllByRole("radio")
        .filter((o) => o.getAttribute("data-underline") === "lit"),
    ).toHaveLength(1);

    const profile = screen.getByRole("radiogroup", { name: "Profile" });
    // Token-less options render the served label verbatim.
    expect(
      within(profile)
        .getAllByRole("radio")
        .map((o) => o.textContent),
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
    const temperature = screen.getByRole("radiogroup", { name: "Temperature" });
    fireEvent.click(within(temperature).getByRole("radio", { name: "high" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply changes" }));
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
    expect(screen.queryByRole("radiogroup", { name: "Profile" })).toBeNull();
    expect(
      screen.getByRole("radiogroup", { name: "Temperature" }),
    ).toBeInTheDocument();
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
    expect(screen.getByText("Energy saving")).toBeInTheDocument();
    expect(screen.getByText("Rinsing disabled")).toBeInTheDocument();
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
    expect(screen.queryByText("Auto bean select")).toBeNull();
    expect(screen.getByText("Energy saving")).toBeInTheDocument();
  });

  it("legacy apply still writes through the hardcoded suffix tables", () => {
    const { conn, sendMessagePromise } = makeConn();
    renderWithProviders(
      <SettingsSection conn={conn} entities={legacyEntities()} prefix="mel" />,
    );
    // The legacy tier draws the same two-word row as the catalog tier: the
    // hand-rolled pill switch (a token-filled `rounded-full` track and knob)
    // is gone from both.
    const group = screen.getByRole("radiogroup", { name: "Energy saving" });
    fireEvent.click(within(group).getByRole("radio", { name: "Off" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply changes" }));
    expect(sendMessagePromise).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "call_service",
        domain: "switch",
        service: "turn_off",
        service_data: expect.objectContaining({
          entity_id: "switch.mel_energy_saving",
        }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// The two hard rules, enforced on the rendered screen
// ---------------------------------------------------------------------------

describe("SettingsSection visual contract", () => {
  
  function renderCatalog() {
    const { conn } = makeConn();
    return renderWithProviders(
      <SettingsSection
        conn={conn}
        entities={melittaEntities()}
        prefix="mel"
        contract={MELITTA_CONTRACT_FULL}
      />,
    );
  }

  it("draws no rounded frame, ring, shadow or tracked-out caps", () => {
    const { container } = renderCatalog();
    container.querySelectorAll<HTMLElement>("*").forEach((el) => {
      const radius = el.style?.borderRadius ?? "";
      if (radius !== "") expect(radius).toBe("0px");
      const shadow = el.style?.boxShadow ?? "";
      if (shadow !== "") expect(shadow).toBe("none");
      const cls = String(el.className);
      expect(cls).not.toMatch(/(^|\s)rounded/);
      expect(cls).not.toMatch(/(^|\s)ring-/);
      expect(cls).not.toMatch(/shadow-/);
      expect(cls).not.toMatch(/tracking-|uppercase/);
      expect(el.style?.letterSpacing ?? "").toBe("");
    });
  });

  it("paints no fill anywhere until the commit band appears, and then only there", () => {
    const { container } = renderCatalog();
    // `background-color: transparent` is a DECLARATION that the element does
    // not paint — the underline input states it explicitly so no user-agent
    // field background can leak in. It is the opposite of a fill, so it must
    // not be counted as one.
    const paints = (el: HTMLElement) => {
      const bg = el.style?.backgroundColor ?? "";
      return (
        (bg !== "" && bg !== "transparent") ||
        (el.style?.backgroundImage ?? "") !== ""
      );
    };
    const painted = () =>
      Array.from(container.querySelectorAll<HTMLElement>("*")).filter(paints);

    // At rest: only meter segments and their empty ground.
    painted().forEach((el) => {
      const declared = el.getAttribute("data-fill");
      expect(
        declared !== null && CARVE_OUTS.has(declared),
        `${el.tagName} paints without declaring a carve-out (data-fill=${declared})`,
      ).toBe(true);
    });

    const group = screen.getByRole("radiogroup", { name: "Auto bean select" });
    fireEvent.click(within(group).getByRole("radio", { name: "Off" }));

    // With changes pending the action band arrives — still one commit only.
    const commits = painted().filter(
      (el) => el.getAttribute("data-fill") === "commit",
    );
    expect(commits).toHaveLength(1);
    expect(commits[0]).toHaveAccessibleName("Apply changes");
    painted().forEach((el) => {
      expect(CARVE_OUTS.has(el.getAttribute("data-fill") ?? "")).toBe(true);
    });
  });

  it("separates rows with a single hairline at a fixed 80px pitch — no card, no zebra", () => {
    const { container } = renderCatalog();
    const rows = container.querySelectorAll<HTMLElement>(".settings-card-enter");
    expect(rows.length).toBe(4);
    rows.forEach((row) => {
      expect(row.style.borderTopWidth).toBe("1px");
      expect(row.style.borderTopColor).toBe("var(--border)");
      expect(row.style.minHeight).toBe("80px");
      // C4/C23: one gutter and one spelling of the 10px hang, both from the
      // shared row module — never a private ROW_INSET, never a `px-2.5`.
      expect(row.className).toContain(ROW_GUTTER);
      expect(row.style.paddingLeft).toBe("var(--hang)");
      expect(row.style.paddingRight).toBe("var(--hang)");
      // The changed/unchanged two-axis fill+ring state model is gone.
      expect(row.style.backgroundColor).toBe("");
      expect(row.style.getPropertyValue("--tw-ring-color")).toBe("");
    });
  });

  it("draws the row label at one type step and the row mark at one size", () => {
    const { container } = renderCatalog();
    // C4/H5: `t-body`, one of the four steps — never the raw 14px `text-sm`
    // that made this role a fifth size, and the same class the maintenance
    // list now imports rather than re-deciding.
    const label = screen.getByText("Auto bean select");
    expect(label.className).toBe(ROW_LABEL_CLASS);
    expect(label.className).toContain("t-body");
    expect(label.className).not.toContain("text-sm");

    // C28: one row rung, 20px, whichever family drew the mark.
    const marks = container.querySelectorAll<HTMLElement>('[data-ui="glyph"]');
    expect(marks.length).toBe(4);
    marks.forEach((m) => {
      expect(m.dataset.size).toBe("row");
      expect(m.style.width).toBe("20px");
      expect(m.style.height).toBe("20px");
      expect(m.style.opacity).toBe("1");
    });
  });

  it("gives the group headers the one shared heading treatment", () => {
    const { container } = renderCatalog();
    const headings = container.querySelectorAll<HTMLElement>('[data-ui="heading"]');
    expect(Array.from(headings).map((h) => h.textContent)).toEqual([
      "Brew",
      "Water",
      "Power",
    ]);
    headings.forEach((h) => {
      // C31: `t-label` tertiary at the weight `.t-label` carries, 16px below,
      // and the 10px hang spelled as the token — not `mb-2` plus a literal.
      expect(h.className).toContain("t-label");
      expect(h.className).toContain("text-tertiary");
      expect(h.className).toContain("settings-header-enter");
      expect(h.className).not.toMatch(/font-medium|font-semibold|text-primary/);
      expect(h.style.marginBottom).toBe("1rem");
      expect(h.style.paddingLeft).toBe("var(--hang)");
    });
  });

  it("writes the box number on the one input rule, not on --border", () => {
    renderCatalog();
    // C6: three hairline colours used to sit under the same underline-input
    // role. `--input-border` is the survivor, at the shared `--underline-w`.
    const box = screen.getByRole("spinbutton", { name: "Auto off" });
    expect(box.dataset.ui).toBe("field-input");
    expect(box.style.backgroundColor).toBe("transparent");
    expect(box.style.borderRadius).toBe("0px");
    expect(box.style.borderBottomWidth).toBe("var(--underline-w)");
    expect(box.style.borderBottomColor).toBe("var(--input-border)");
    expect(box.style.minHeight).toBe("var(--tap)");
    expect(box.className).toContain("num");
  });

  it("gives every numeric row a localized discrete step (C34)", () => {
    renderCatalog();
    // The branch was never dead — it was unreachable because the two strings
    // it needs did not exist in any of the 29 bundles.
    const field = screen
      .getByRole("slider", { name: "Water hardness" })
      .closest('[data-ui="meter-field"]') as HTMLElement;
    const minus = within(field).getByRole("button", { name: "Decrease" });
    const plus = within(field).getByRole("button", { name: "Increase" });
    expect(minus.className).toContain("tap");
    expect(plus.className).toContain("tap");
    fireEvent.click(plus);
    expect(
      field.querySelector<HTMLElement>('[data-ui="meter-field-value"]')!
        .textContent,
    ).toBe("Hard");
  });

  it("gives Reset a bare word with NO rule and keeps every control's 48px reach", () => {
    renderCatalog();
    const group = screen.getByRole("radiogroup", { name: "Auto bean select" });
    const off = within(group).getByRole("radio", { name: "Off" });
    expect(off.className).toContain("tap");
    expect(off.className).toContain("press");
    fireEvent.click(off);

    // An underline means CHOSEN in this language (owner decision 1), so an
    // action never wears one. Reset used to carry a `--border` rule — one of
    // eight hand-rolled copies of the same word that disagreed on its colour
    // precisely because none of them could say what the line meant (C5).
    const reset = screen.getByRole("button", { name: /Reset/ });
    expect(reset.dataset.ui).toBe("word");
    expect(reset.style.backgroundColor).toBe("");
    expect(reset.style.borderBottomWidth).toBe("");
    expect(reset.style.borderBottomColor).toBe("");
    expect(reset.style.color).toBe("var(--text-secondary)");
    expect(reset.className).toContain("tap");
    expect(reset.className).toContain("press");

    const commit = screen.getByRole("button", { name: "Apply changes" });
    expect(commit.className).toContain("tap-lg");
    expect(commit.style.borderRadius).toBe("0px");

    // C10: both live in the ONE action band, opened by the 2px accent rule.
    const band = reset.closest('[data-ui="action-band"]') as HTMLElement;
    expect(band).not.toBeNull();
    expect(band.contains(commit)).toBe(true);
    const rule = band.querySelector<HTMLElement>('[data-ui="rule"]')!;
    expect(rule.style.height).toBe("2px");
    expect(rule.style.backgroundColor).toBe("var(--accent)");
  });

  it("scrolls in one box, and the commit band is not inside it (C32)", () => {
    const { container } = renderCatalog();
    const root = container.firstElementChild as HTMLElement;

    // The root is the rail, never the scroller: exactly one scrolling box per
    // tab, and it is a `flex-1 min-h-0` child of that root.
    expect(root.className).not.toMatch(/overflow-y-auto|custom-scroll/);
    const scrollers = container.querySelectorAll<HTMLElement>(".custom-scroll");
    expect(scrollers).toHaveLength(1);
    expect(scrollers[0].className).toContain("flex-1");
    expect(scrollers[0].className).toContain("min-h-0");
    expect(scrollers[0].className).toContain("overflow-y-auto");
    // Left at the browser default, like the other two scrolling tabs: `body`
    // is `overflow: hidden`, so there is nothing for a scroll to chain into.
    expect(scrollers[0].style.overscrollBehavior).toBe("");

    // An unsaved change must not be scrollable off its own screen.
    const group = screen.getByRole("radiogroup", { name: "Auto bean select" });
    fireEvent.click(within(group).getByRole("radio", { name: "Off" }));
    const band = container.querySelector<HTMLElement>('[data-ui="action-band"]')!;
    expect(band).not.toBeNull();
    expect(scrollers[0].contains(band)).toBe(false);
  });

  it("keeps the changed value's accent ink as the only unsaved signal", () => {
    renderCatalog();
    fireEvent.change(screen.getByRole("slider", { name: "Water hardness" }), {
      target: { value: "3" },
    });
    const field = screen
      .getByRole("slider", { name: "Water hardness" })
      .closest('[data-ui="meter-field"]') as HTMLElement;
    expect(field).toHaveAttribute("data-changed", "true");
    const value = field.querySelector<HTMLElement>(
      '[data-ui="meter-field-value"]',
    )!;
    expect(value.style.color).toBe("var(--accent)");
    expect(value.textContent).toBe("Hard");
  });
});

// ---------------------------------------------------------------------------
// C4 / C32 — the settings tab and the maintenance tab are one list, twice
// ---------------------------------------------------------------------------

/**
 * These two tabs draw the same role — a leading 20px mark, a label with quiet
 * lines under it, a control on the right, on a fixed 80px pitch — and the
 * audit found them disagreeing on the label's type step, the gutter and the
 * spelling of the 10px hang. The invariant belongs to neither file alone, so
 * it is asserted here, against both rendered trees, rather than described in
 * two places and checked in none.
 */
describe("the settings row and the maintenance row are one shape (C4)", () => {
  const CTX = { id: "", user_id: null, parent_id: null };
  const plain = (state: string) =>
    ({
      entity_id: "",
      state,
      attributes: {},
      last_changed: "",
      last_updated: "",
      context: CTX,
    }) as unknown as HassEntity;

  /** Legacy maintenance mode: connected, ready, with one anchor button. */
  function maintenanceEntities(): HassEntities {
    return {
      "sensor.mel_connection": plain("Connected"),
      "sensor.mel_state": plain("Ready"),
      "button.mel_easy_clean": plain("unknown"),
    } as unknown as HassEntities;
  }

  function renderBoth() {
    const { conn } = makeConn();
    const settings = renderWithProviders(
      <SettingsSection
        conn={conn}
        entities={melittaEntities()}
        prefix="mel"
        contract={MELITTA_CONTRACT_FULL}
      />,
    ).container;
    const maintenance = renderWithProviders(
      <MaintenanceSection conn={conn} entities={maintenanceEntities()} prefix="mel" />,
    ).container;
    const row = (c: HTMLElement) =>
      c.querySelector<HTMLElement>(".settings-card-enter")!;
    return { settings, maintenance, settingsRow: row(settings), maintenanceRow: row(maintenance) };
  }

  it("draws both rows at one pitch, one gutter and one spelling of the hang", () => {
    const { settingsRow, maintenanceRow } = renderBoth();

    [settingsRow, maintenanceRow].forEach((row) => {
      expect(row.className).toContain(ROW_GUTTER);
      expect(row.style.minHeight).toBe("80px");
      expect(row.style.paddingLeft).toBe("var(--hang)");
      expect(row.style.paddingRight).toBe("var(--hang)");
      expect(row.style.borderTopWidth).toBe("1px");
      expect(row.style.borderTopColor).toBe("var(--border)");
      expect(row.style.borderRadius).toBe("0px");
      // Neither list paints: §G2.7 separates rows with a hairline and nothing.
      expect(row.style.backgroundColor).toBe("");
    });
    // The gutter is one class, not `gap-3` here and `gap-4` there.
    expect(maintenanceRow.className).not.toContain("gap-4");
    expect(settingsRow.className).toBe(maintenanceRow.className);
  });

  it("gives both row labels the one type step and both marks the one rung", () => {
    const { settings, maintenance, settingsRow, maintenanceRow } = renderBoth();

    // The label is found by POSITION, not by its words: a sentence-case pass
    // over the 29 bundles must not be able to break a test about type.
    const labelOf = (row: HTMLElement) =>
      row.querySelector<HTMLElement>(".flex-1.min-w-0")!
        .firstElementChild as HTMLElement;

    // C4/H5: `t-body` at 500 in both — never the raw 14px `text-sm` that made
    // this role a fifth size, and never a bare `t-body` on one side only.
    [settingsRow, maintenanceRow].forEach((row) => {
      const label = labelOf(row);
      expect(label.className).toBe(ROW_LABEL_CLASS);
      expect(label.className).toContain("t-body");
      expect(label.className).not.toContain("text-sm");
      expect(label.textContent).not.toBe("");
    });

    // C27/C28: one 20px rung, whichever family drew the mark — the raster one
    // in the maintenance list, the resolved lucide one in the settings list.
    [settings, maintenance].forEach((c) => {
      const marks = c.querySelectorAll<HTMLElement>('[data-ui="glyph"]');
      expect(marks.length).toBeGreaterThan(0);
      marks.forEach((m) => {
        expect(m.dataset.size).toBe("row");
        expect(m.style.width).toBe("20px");
        expect(m.style.height).toBe("20px");
      });
    });
  });

  it("scrolls both tabs through the identical single box (C32)", () => {
    const { settings, maintenance } = renderBoth();

    [settings, maintenance].forEach((c) => {
      const root = c.firstElementChild as HTMLElement;
      expect(root.className).toBe("flex h-full flex-col");
      expect(root.style.paddingLeft).toBe("var(--rail)");
      expect(c.querySelectorAll(".custom-scroll")).toHaveLength(1);
    });
    const scroller = (c: HTMLElement) =>
      c.querySelector<HTMLElement>(".custom-scroll")!;
    expect(scroller(settings).className).toBe(scroller(maintenance).className);
  });
});
