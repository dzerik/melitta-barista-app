/**
 * Zone P-H — brew-phase wizard + sommelier error codes.
 *
 * Pure step model (src/lib/brew-plan.ts): step synthesis (cup step from
 * cup_type + vocab volumes, pre/during/post ordering, interleaved
 * user_action_before, legacy full fallback), machine-step state transitions
 * (estimate ticks, the sawBrewing completion gate, prompt localization) and
 * the 2 h localStorage re-entry TTL. Error mapping (sommelier-errors.ts):
 * the five contract codes incl. unauthorized, and the connection wrapper.
 * Components: BrewWizard sequencing over mocked WS, SommelierRecipeCard
 * routing (wizard vs legacy one-shot), SommelierSection banner hints.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import type { Connection, HassEntities, HassEntity } from "home-assistant-js-websocket";
import { renderWithProviders } from "./test-utils";
import { MELITTA_VOCAB } from "./fixtures/contracts";
import {
  buildBrewPlan,
  recipeMachinePhases,
  hasPhasePlan,
  manualStepTitle,
  fmt,
  estimatePhaseSeconds,
  estimateStepSeconds,
  freshMachineState,
  tickMachine,
  applyStatusPoll,
  loadWizardPosition,
  saveWizardPosition,
  clearWizardPosition,
  WIZARD_RESUME_TTL_MS,
  PROGRESS_CAP_PERCENT,
  POLL_TIMEOUT_BUFFER_S,
  type BrewPlanRecipe,
  type WizardStep,
} from "../src/lib/brew-plan";
import {
  sommelierErrorHint,
  wsErrorCode,
  withSommelierErrorMapping,
  SommelierWsError,
} from "../src/lib/sommelier-errors";
import {
  setVocab,
  resetVocab,
  setServerStrings,
  resetServerStrings,
} from "../src/lib/server-strings";
import { BrewWizard } from "../src/components/BrewWizard";
import { SommelierRecipeCard } from "../src/components/SommelierRecipeCard";
import { SommelierFavorites } from "../src/components/SommelierFavorites";
import { SommelierSection } from "../src/components/SommelierSection";
import { BrewWizardContext, type BrewWizardEnv } from "../src/hooks/useBrewPhase";
import type { AiRecipe } from "../src/hooks/useSommelier";
import { assertHardRules } from "./hard-rules";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const COMPONENT_NONE = {
  process: "none",
  intensity: "none",
  aroma: "standard",
  temperature: "normal",
  shots: "one",
  portion_ml: 0,
};

/** A 0.89+ wire row: machine_phases + steps + cup_type on an AiRecipe. */
function phasedRecipe(): AiRecipe {
  return {
    id: "r1",
    name: "Iced Maple Latte",
    description: "Cold and sweet",
    blend: 1,
    component1: { ...COMPONENT_NONE, process: "coffee", intensity: "strong", portion_ml: 40 },
    component2: { ...COMPONENT_NONE, process: "milk", portion_ml: 110 },
    brewed: false,
    cup_type: "mug",
    extras: { ice: true, instruction: "Stir gently before serving" },
    ...({
      machine_phases: [
        {
          component: { process: "coffee", intensity: "strong", portion_ml: 40 },
          user_action_before: [],
        },
        {
          component: { process: "milk", portion_ml: 110 },
          user_action_before: [
            { order: 1, action: "Add ice cubes", amount: 3, unit: "cubes" },
          ],
        },
      ],
      steps: [
        { order: 1, phase: "pre", action: "Take a mug" },
        { order: 3, phase: "post", action: "Top with maple syrup", amount: 10, unit: "ml" },
        { order: 2, phase: "during", action: "Watch the crema" },
      ],
    } as Partial<AiRecipe>),
  };
}

/** A pre-0.89 legacy row: components only, no machine_phases/steps. */
function legacyRecipe(): AiRecipe {
  return {
    id: "r-legacy",
    name: "Plain Espresso",
    description: "Just coffee",
    blend: 1,
    component1: { ...COMPONENT_NONE, process: "coffee", portion_ml: 40 },
    component2: { ...COMPONENT_NONE },
    brewed: false,
  };
}

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

type WsMessage = { type: string } & Record<string, unknown>;

function makeConn(impl?: (msg: WsMessage) => Promise<unknown>) {
  const sendMessagePromise = vi.fn(impl ?? (async () => ({})));
  return {
    conn: { sendMessagePromise } as unknown as Connection,
    sendMessagePromise,
  };
}

function makeEnv(
  conn: Connection,
  overrides: Partial<BrewWizardEnv> = {},
): BrewWizardEnv {
  return {
    conn,
    entryId: "entry-1",
    confirmEntityId: "button.mel_confirm_prompt",
    ...overrides,
  };
}

function renderWizard(env: BrewWizardEnv, recipe: AiRecipe, onClose = vi.fn()) {
  return renderWithProviders(
    <BrewWizardContext.Provider value={env}>
      <BrewWizard open recipe={recipe} onClose={onClose} />
    </BrewWizardContext.Provider>,
  );
}

const machineSteps = (steps: WizardStep[]) =>
  steps.filter((s): s is Extract<WizardStep, { kind: "machine" }> => s.kind === "machine");

/**
 * jsdom ships no IntersectionObserver and the shared setup stubs only
 * ResizeObserver, so the paged sommelier grids (Embla) cannot mount without
 * one. Guarded, so it becomes a no-op the moment the shared setup grows its
 * own stub.
 */
if (!("IntersectionObserver" in globalThis)) {
  class IntersectionObserverStub {
    readonly root = null;
    readonly rootMargin = "";
    readonly thresholds: number[] = [];
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  globalThis.IntersectionObserver =
    IntersectionObserverStub as unknown as typeof IntersectionObserver;
}

beforeEach(() => {
  localStorage.clear();
  resetVocab();
  resetServerStrings();
});

// ---------------------------------------------------------------------------
// Step synthesis (pure)
// ---------------------------------------------------------------------------

describe("buildBrewPlan — step synthesis", () => {
  it("compiles cup + pre + interleaved phases + post in order", () => {
    const steps = buildBrewPlan("en", phasedRecipe() as BrewPlanRecipe);
    expect(steps.map((s) => s.kind)).toEqual([
      "manual", // cup (synthetic)
      "manual", // pre: take a mug
      "machine", // phase 0
      "manual", // user_action_before of phase 1
      "machine", // phase 1
      "manual", // post
    ]);
    expect(steps[0]).toMatchObject({ synthetic: true });
    expect(steps[1]).toMatchObject({ title: "Take a mug" });
    expect(steps[3]).toMatchObject({ title: "Add ice cubes (3 cubes)" });
    expect(steps[5]).toMatchObject({ title: "Top with maple syrup (10 ml)" });
    const machines = machineSteps(steps);
    expect(machines.map((s) => [s.phaseIndex, s.pourN, s.pourCount])).toEqual([
      [0, 1, 2],
      [1, 2, 2],
    ]);
    expect(machines.every((s) => !s.legacyFull)).toBe(true);
  });

  it("shows during-phase steps as hints on the FIRST machine step only", () => {
    const steps = buildBrewPlan("en", phasedRecipe() as BrewPlanRecipe);
    const [first, second] = machineSteps(steps);
    expect(first.hints).toEqual(["Watch the crema"]);
    expect(second.hints).toEqual([]);
  });

  it("synthesizes the cup step from the served volumes_ml hint (§9.2.6.3)", () => {
    setVocab(MELITTA_VOCAB);
    const steps = buildBrewPlan("en", phasedRecipe() as BrewPlanRecipe);
    expect(steps[0]).toMatchObject({
      title: "Place your Mug (250–350 ml) under the spout",
    });
  });

  it("falls back to the summed phase portion_ml when volumes are unserved", () => {
    const steps = buildBrewPlan("en", phasedRecipe() as BrewPlanRecipe);
    expect(steps[0]).toMatchObject({
      title: "Place your Mug (150 ml) under the spout",
    });
  });

  it("omits the cup step without cup_type and sorts steps by order", () => {
    const recipe = phasedRecipe() as BrewPlanRecipe;
    delete recipe.cup_type;
    (recipe.steps as { order?: number; phase?: string; action?: string }[]).push({
      order: 0,
      phase: "pre",
      action: "Rinse the mug",
    });
    const steps = buildBrewPlan("en", recipe);
    expect(steps[0]).toMatchObject({ kind: "manual", title: "Rinse the mug" });
    expect(steps[1]).toMatchObject({ title: "Take a mug" });
  });

  it("compiles a legacy row into one full-recipe machine step with during hints", () => {
    const recipe = legacyRecipe() as BrewPlanRecipe;
    recipe.steps = [{ order: 1, phase: "during", action: "Smell it" }];
    const steps = buildBrewPlan("en", recipe);
    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({
      kind: "machine",
      legacyFull: true,
      phaseIndex: null,
      pourN: 1,
      pourCount: 1,
      hints: ["Smell it"],
    });
  });

  it("tolerates malformed machine_phases/steps fields (§6.0.3)", () => {
    expect(recipeMachinePhases({ machine_phases: "nope" })).toEqual([]);
    expect(recipeMachinePhases({ machine_phases: [null, "x", { component: {} }] })).toHaveLength(1);
    expect(recipeMachinePhases(null)).toEqual([]);
    const steps = buildBrewPlan("en", {
      id: "x",
      steps: { not: "a list" },
    } as unknown as BrewPlanRecipe);
    expect(steps).toEqual([]);
  });

  it("hasPhasePlan gates on a non-empty machine_phases list only", () => {
    expect(hasPhasePlan(phasedRecipe())).toBe(true);
    expect(hasPhasePlan(legacyRecipe())).toBe(false);
    expect(hasPhasePlan({ machine_phases: [] })).toBe(false);
    expect(hasPhasePlan({ machine_phases: "yes" })).toBe(false);
    expect(hasPhasePlan(null)).toBe(false);
  });

  it("manual step titles compose action, quantity and ingredient", () => {
    expect(
      manualStepTitle({ action: "Add", amount: 2, unit: "tsp", ingredient: "cocoa" }),
    ).toBe("Add (2 tsp) — cocoa");
    expect(manualStepTitle({ action: "Stir" })).toBe("Stir");
    expect(manualStepTitle({})).toBe("");
  });

  it("fmt interpolates named params and leaves unknown ones verbatim", () => {
    expect(fmt("Step {n} of {m}", { n: 2, m: 6 })).toBe("Step 2 of 6");
    expect(fmt("{a} {b}", { a: "x" })).toBe("x {b}");
  });
});

// ---------------------------------------------------------------------------
// Machine-step state machine (pure)
// ---------------------------------------------------------------------------

describe("machine-step state", () => {
  it("estimates phase seconds from portion volume with a floor", () => {
    expect(estimatePhaseSeconds({ portion_ml: 0 })).toBe(10);
    expect(estimatePhaseSeconds(undefined)).toBe(10);
    expect(estimatePhaseSeconds({ portion_ml: 200 })).toBe(28);
  });

  it("legacy full steps estimate the sum of all phases", () => {
    const recipe = phasedRecipe() as BrewPlanRecipe;
    const steps = machineSteps(buildBrewPlan("en", recipe));
    expect(estimateStepSeconds(steps[0], recipe)).toBe(estimatePhaseSeconds({ portion_ml: 40 }));
    const legacy = buildBrewPlan("en", legacyRecipe() as BrewPlanRecipe);
    expect(estimateStepSeconds(machineSteps(legacy)[0], legacyRecipe() as BrewPlanRecipe)).toBe(
      estimatePhaseSeconds({ portion_ml: 40 }),
    );
  });

  it("ticks estimate-based progress capped below completion, then arms manualFinish", () => {
    const m = { ...freshMachineState(), state: "brewing" as const, startedAt: 0, estimated: 100 };
    expect(tickMachine(m, 50_000)?.progress).toBe(50);
    expect(tickMachine(m, 400_000)?.progress).toBe(PROGRESS_CAP_PERCENT);
    expect(tickMachine(m, (100 + POLL_TIMEOUT_BUFFER_S + 1) * 1000)?.manualFinish).toBe(true);
    expect(tickMachine(m, 20_000)?.manualFinish).toBeUndefined();
    expect(tickMachine({ ...m, state: "idle" }, 50_000)).toBeNull();
  });

  it("live progress stands the estimate down", () => {
    const m = {
      ...freshMachineState(),
      state: "brewing" as const,
      startedAt: 0,
      estimated: 100,
      liveProgress: true,
      progress: 42,
    };
    expect(tickMachine(m, 50_000)).toBeNull();
  });

  it("adopts real progress and marks sawBrewing while is_brewing", () => {
    const m = { ...freshMachineState(), state: "brewing" as const };
    const { patch, completed } = applyStatusPoll("en", m, {
      is_brewing: true,
      progress: 37,
      awaiting_confirmation: false,
    });
    expect(completed).toBe(false);
    expect(patch).toMatchObject({ sawBrewing: true, liveProgress: true, progress: 37, prompt: null });
  });

  it("does NOT complete on not-brewing before brewing was observed (warm-up)", () => {
    const m = { ...freshMachineState(), state: "brewing" as const };
    const { completed } = applyStatusPoll("en", m, { is_brewing: false });
    expect(completed).toBe(false);
  });

  it("completes on the observed true→false transition", () => {
    const m = { ...freshMachineState(), state: "brewing" as const, sawBrewing: true };
    const { completed } = applyStatusPoll("en", m, { is_brewing: false });
    expect(completed).toBe(true);
  });

  it("localizes the confirmation prompt: server string → humanized token → generic", () => {
    const m = { ...freshMachineState(), state: "brewing" as const };
    setServerStrings({ "status.manipulation.CONFIRM_MILK": "Confirm the milk step" });
    expect(
      applyStatusPoll("en", m, { awaiting_confirmation: true, manipulation: "CONFIRM_MILK" })
        .patch.prompt,
    ).toBe("Confirm the milk step");
    resetServerStrings();
    expect(
      applyStatusPoll("en", m, { awaiting_confirmation: true, manipulation: "CONFIRM_MILK" })
        .patch.prompt,
    ).toBe("Confirm milk");
    expect(
      applyStatusPoll("en", m, { awaiting_confirmation: true }).patch.prompt,
    ).toBe("The machine is waiting for confirmation");
  });
});

// ---------------------------------------------------------------------------
// Re-entry TTL (pure)
// ---------------------------------------------------------------------------

describe("wizard re-entry position", () => {
  it("round-trips a saved position within the TTL", () => {
    saveWizardPosition("r1", 3, 1000);
    expect(loadWizardPosition("r1", 1000 + WIZARD_RESUME_TTL_MS)).toBe(3);
  });

  it("expires after 2 h and clears on demand", () => {
    saveWizardPosition("r1", 3, 1000);
    expect(loadWizardPosition("r1", 1000 + WIZARD_RESUME_TTL_MS + 1)).toBeNull();
    saveWizardPosition("r1", 2);
    clearWizardPosition("r1");
    expect(loadWizardPosition("r1")).toBeNull();
  });

  it("ignores malformed or foreign stored values", () => {
    localStorage.setItem("melitta_barista.wizard.r1", "not json");
    expect(loadWizardPosition("r1")).toBeNull();
    localStorage.setItem("melitta_barista.wizard.r1", JSON.stringify({ stepIndex: "x", ts: Date.now() }));
    expect(loadWizardPosition("r1")).toBeNull();
    expect(loadWizardPosition("never-saved")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Error-code mapping
// ---------------------------------------------------------------------------

describe("sommelier error codes", () => {
  it("extracts WS codes from plain rejections and Errors", () => {
    expect(wsErrorCode({ code: "no_llm_agent", message: "x" })).toBe("no_llm_agent");
    expect(wsErrorCode(new SommelierWsError("x", "timeout"))).toBe("timeout");
    expect(wsErrorCode(new Error("x"))).toBeNull();
    expect(wsErrorCode("boom")).toBeNull();
  });

  it("maps the five contract codes to localized hints (incl. unauthorized)", () => {
    const hint = sommelierErrorHint("en", { code: "no_llm_agent" });
    expect(hint).toContain("No AI conversation agent is installed");
    expect(hint).toContain("Configure a conversation agent in HA"); // configure_llm earns its keep
    expect(sommelierErrorHint("en", { code: "no_llm_agent_selected" })).toContain(
      "No AI agent is selected",
    );
    expect(sommelierErrorHint("en", { code: "llm_agent_missing" })).toContain(
      "no longer exists",
    );
    expect(sommelierErrorHint("en", { code: "timeout" })).toContain("timed out");
    expect(sommelierErrorHint("en", { code: "unauthorized" })).toBe(
      "Sommelier generation requires a Home Assistant admin user.",
    );
    expect(sommelierErrorHint("ru", { code: "unauthorized" })).toContain("администратора");
  });

  it("returns null for unmapped codes so callers keep legacy behavior", () => {
    expect(sommelierErrorHint("en", { code: "brew_failed", message: "busy" })).toBeNull();
    expect(sommelierErrorHint("en", { message: "no code" })).toBeNull();
  });

  it("connection wrapper rejects mapped codes as localized Errors, code preserved", async () => {
    const { conn } = makeConn(async () => {
      throw { code: "unauthorized", message: "Unauthorized" };
    });
    const wrapped = withSommelierErrorMapping(conn, () => "en");
    const err = await wrapped
      .sendMessagePromise({ type: "melitta_barista/sommelier/generate" })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toBe(
      "Sommelier generation requires a Home Assistant admin user.",
    );
    expect((err as SommelierWsError).code).toBe("unauthorized");
  });

  it("connection wrapper passes unmapped rejections and successes through verbatim", async () => {
    const original = { code: "brew_failed", message: "busy" };
    const { conn } = makeConn(async (msg) => {
      if (msg.type === "melitta_barista/sommelier/brew") throw original;
      return { ok: true };
    });
    const wrapped = withSommelierErrorMapping(conn, () => "en");
    const err = await wrapped
      .sendMessagePromise({ type: "melitta_barista/sommelier/brew" })
      .catch((e: unknown) => e);
    expect(err).toBe(original);
    await expect(
      wrapped.sendMessagePromise({ type: "melitta_barista/vocab/get" }),
    ).resolves.toEqual({ ok: true });
  });

  it("connection wrapper leaves non-integration message types unmapped", async () => {
    const original = { code: "unauthorized", message: "Unauthorized" };
    const { conn } = makeConn(async () => {
      throw original;
    });
    const wrapped = withSommelierErrorMapping(conn, () => "en");
    const err = await wrapped
      .sendMessagePromise({ type: "call_service" })
      .catch((e: unknown) => e);
    expect(err).toBe(original);
  });
});

// ---------------------------------------------------------------------------
// BrewWizard component — phase sequencing
// ---------------------------------------------------------------------------

describe("BrewWizard", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the numbered plan and advances manual steps on Done", () => {
    const { conn } = makeConn();
    renderWizard(makeEnv(conn), phasedRecipe());
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Step 1 of 6")).toBeInTheDocument();
    expect(screen.getByText("Take a mug")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.getByText("Step 2 of 6")).toBeInTheDocument();
  });

  it("brews one phase at a time: brew_phase carries phase_index + entry_id and NEVER one-shots", async () => {
    const { conn, sendMessagePromise } = makeConn();
    renderWizard(makeEnv(conn), phasedRecipe());
    fireEvent.click(screen.getByRole("button", { name: "Done" })); // cup
    fireEvent.click(screen.getByRole("button", { name: "Done" })); // pre
    expect(screen.getByText("Machine pour 1 of 2")).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Start this pour/ }));
    });
    expect(sendMessagePromise).toHaveBeenCalledWith({
      type: "melitta_barista/sommelier/brew_phase",
      recipe_id: "r1",
      entry_id: "entry-1",
      phase_index: 0,
    });
    expect(sendMessagePromise).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "melitta_barista/sommelier/brew" }),
    );
  });

  it("auto-advances on the polled is_brewing true→false transition", async () => {
    vi.useFakeTimers();
    const statuses = [
      { is_brewing: true, progress: 40 },
      { is_brewing: false },
    ];
    const { conn } = makeConn(async (msg) => {
      if (msg.type === "melitta_barista/status") {
        return { status: statuses.length > 1 ? statuses.shift() : statuses[0] };
      }
      return {};
    });
    renderWizard(makeEnv(conn), phasedRecipe());
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Start this pour/ }));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2100); // poll 1: brewing observed
    });
    // C18: a progress meter carries no percentage, so the polled figure is
    // read off the paint — round(0.40 × 12) segments.
    expect(document.querySelector('[data-ui="meter"]')).toHaveAttribute(
      "data-filled",
      "5",
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2100); // poll 2: done
    });
    // Advanced past the pour to the next manual step.
    expect(screen.getByText("Step 4 of 6")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
  });

  it("shows the localized admin hint when brew_phase is unauthorized, with Retry/Skip", async () => {
    const { conn } = makeConn(async (msg) => {
      if (msg.type === "melitta_barista/sommelier/brew_phase") {
        throw { code: "unauthorized", message: "Unauthorized" };
      }
      return {};
    });
    renderWizard(makeEnv(conn), phasedRecipe());
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Start this pour/ }));
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Sommelier generation requires a Home Assistant admin user.",
    );
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Skip" })).toBeInTheDocument();
  });

  it("surfaces machine prompts and confirms via the confirm_prompt button entity", async () => {
    vi.useFakeTimers();
    const { conn, sendMessagePromise } = makeConn(async (msg) => {
      if (msg.type === "melitta_barista/status") {
        return {
          status: { is_brewing: true, awaiting_confirmation: true, manipulation: "CONFIRM_MILK" },
        };
      }
      return {};
    });
    renderWizard(makeEnv(conn), phasedRecipe());
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Start this pour/ }));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2100);
    });
    expect(screen.getByText("The machine asks: Confirm milk")).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    });
    expect(sendMessagePromise).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "call_service",
        domain: "button",
        service: "press",
        service_data: expect.objectContaining({ entity_id: "button.mel_confirm_prompt" }),
      }),
    );
  });

  it("resumes a saved position (2 h TTL) and can restart", () => {
    saveWizardPosition("r1", 3);
    const { conn } = makeConn();
    renderWizard(makeEnv(conn), phasedRecipe());
    expect(screen.getByText("Resumed where you left off")).toBeInTheDocument();
    expect(screen.getByText("Step 4 of 6")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Start over" }));
    expect(screen.getByText("Step 1 of 6")).toBeInTheDocument();
    expect(loadWizardPosition("r1")).toBeNull();
  });

  it("confirms before closing mid-run and saves the position on Leave", () => {
    const onClose = vi.fn();
    const { conn } = makeConn();
    renderWizard(makeEnv(conn), phasedRecipe(), onClose);
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    fireEvent.click(screen.getByRole("button", { name: "Leave the brew guide?" }));
    expect(screen.getByText("Leave the brew guide?")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Leave" }));
    expect(onClose).toHaveBeenCalled();
    expect(loadWizardPosition("r1")).toBe(1);
  });

  it("shows the finish view with the extras instruction after the last step", () => {
    saveWizardPosition("r1", 6); // == steps.length → finished
    const { conn } = makeConn();
    renderWizard(makeEnv(conn), phasedRecipe());
    expect(screen.getByText("Enjoy!")).toBeInTheDocument();
    expect(screen.getByText("Stir gently before serving")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// BrewWizard component — the rebuilt visual contract
// ---------------------------------------------------------------------------



const commits = () => document.querySelectorAll('[data-ui="commit"]');

describe("BrewWizard — the rebuilt visual contract", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("is one flat §5.B panel — radius 0, no ring, no shadow, no stray fill", () => {
    const { conn } = makeConn();
    renderWizard(makeEnv(conn), phasedRecipe());

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("data-fill", "panel");
    expect(dialog.style.backgroundColor).toBe("var(--surface)");
    expect(dialog.style.borderRadius).toBe("0px");
    // The panel and the scrim behind it are the only fills in the tree.
    expect(document.querySelectorAll('[data-fill="panel"]')).toHaveLength(1);
    assertHardRules(document.body);
  });

  it("renders exactly one commit rectangle per step, in --accent at radius 0", () => {
    const { conn } = makeConn();
    renderWizard(makeEnv(conn), phasedRecipe());

    expect(commits()).toHaveLength(1);
    const done = screen.getByRole("button", { name: "Done" });
    expect(done).toHaveAttribute("data-ui", "commit");
    expect(done.style.backgroundColor).toBe("var(--accent)");
    expect(done.style.borderRadius).toBe("0px");
    expect(done.style.minHeight).toBe("var(--tap-lg)");

    fireEvent.click(done); // cup → pre
    fireEvent.click(screen.getByRole("button", { name: "Done" })); // pre → pour
    expect(commits()).toHaveLength(1);
    expect(screen.getByRole("button", { name: /Start this pour/ })).toHaveAttribute(
      "data-ui",
      "commit",
    );
    assertHardRules(document.body);
  });

  it("keeps a failed pour's Retry as the commit and Skip as a bare word", async () => {
    const { conn } = makeConn(async (msg) => {
      if (msg.type === "melitta_barista/sommelier/brew_phase") {
        throw { code: "brew_failed", message: "busy" };
      }
      return {};
    });
    renderWizard(makeEnv(conn), phasedRecipe());
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Start this pour/ }));
    });

    expect(commits()).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Retry" })).toHaveAttribute(
      "data-ui",
      "commit",
    );
    const skip = screen.getByRole("button", { name: "Skip" });
    expect(skip).toHaveAttribute("data-ui", "word");
    expect(skip).not.toHaveAttribute("data-ui", "commit");
    expect(skip.style.backgroundColor).toBe("");
    // C5: an action wears NO rule. An underline means "chosen" in this
    // language, and Skip is not a choice among Skip and something else.
    expect(skip.style.borderBottomWidth).toBe("");
    expect(skip.style.borderBottomColor).toBe("");
    expect(skip.className).toContain("tap");
    // §10 error: type between two 1px --error-border rules, no box, no fill.
    const alert = screen.getByRole("alert");
    expect(alert.style.backgroundColor).toBe("");
    expect(alert.style.borderTopColor).toBe("var(--error-border)");
    expect(alert.style.borderBottomColor).toBe("var(--error-border)");
    assertHardRules(document.body);
  });

  it("draws a pour's progress as the segmented meter, never a ring or a bar", async () => {
    vi.useFakeTimers();
    const { conn } = makeConn(async (msg) => {
      if (msg.type === "melitta_barista/status") {
        return { status: { is_brewing: true, progress: 25 } };
      }
      return {};
    });
    renderWizard(makeEnv(conn), phasedRecipe());
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Start this pour/ }));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2100);
    });

    const meter = document.querySelector('[data-ui="meter"]')!;
    expect(meter).toBeTruthy();
    expect(meter.getAttribute("data-filled")).toBe("3"); // round(0.25 × 12)
    expect(document.querySelector('[data-ui="tick-ring"]')).toBeNull();
    // C18: a PROGRESS meter carries no numeric readout at all — not on the
    // track and not in a label row beside it. The estimate, which is the one
    // figure we honestly have, stays.
    expect(meter.textContent).toBe("");
    expect(screen.queryByText("25%")).toBeNull();
    expect(screen.queryByText(/^\d+%$/)).toBeNull();
    expect(screen.getByText(/^Estimated ~\d+ s$/)).toBeInTheDocument();
    // §9.3: no spinner survives anywhere.
    expect(document.querySelector(".animate-spin")).toBeNull();
    assertHardRules(document.body);
  });

  it("sets a phase's composition as the value strip: accent label, white value", () => {
    const { conn } = makeConn();
    renderWizard(makeEnv(conn), phasedRecipe());
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    fireEvent.click(screen.getByRole("button", { name: "Done" }));

    const strip = document.querySelector<HTMLElement>('[data-ui="value-strip"]')!;
    expect(strip).toBeTruthy();
    expect(strip.textContent).toContain("Coffee");
    expect(strip.textContent).toContain("40 ml");
    // The label half is the only accent ink; the value half stays white.
    const label = strip.querySelector<HTMLElement>('span[style*="--accent"]')!;
    expect(label.textContent).toContain("Portion");
    const value = strip.querySelector<HTMLElement>('span[style*="--text-primary"]')!;
    expect(value).toBeTruthy();
    // No pill, no badge, no fill: the groups are divided by hairlines only.
    expect(strip.innerHTML).not.toMatch(/rounded|background/);
    expect(strip.querySelector(".border-l")).toBeTruthy();

    // C22: the figure and its unit are two elements, so they can be inked
    // apart — 40 is `--text-primary` at 600 and tabular, "ml" is
    // `--text-tertiary` at the SAME type step (§7.6), never an off-scale size.
    // The portion group is the strip's second: process, portion, intensity.
    const portion = strip.children[1] as HTMLElement;
    expect(portion.textContent).toBe("Portion 40 ml");
    const [portionLabel, portionValue, portionUnit] = Array.from(
      portion.querySelectorAll<HTMLElement>("span"),
    );
    expect(portionLabel.style.color).toBe("var(--accent)");
    expect(portionValue.textContent).toBe("40");
    expect(portionValue.style.color).toBe("var(--text-primary)");
    expect(portionValue.className).toContain("num");
    expect(portionValue.style.fontWeight).toBe("600");
    expect(portionUnit.textContent).toBe(" ml");
    expect(portionUnit.style.color).toBe("var(--text-tertiary)");
    // §7.6: the unit drops a VALUE STEP, never a type step — no size class.
    expect(portionUnit.className).toBe("");
    // Nothing bakes the two halves back into one string.
    expect(
      Array.from(strip.querySelectorAll("span")).some(
        (s) => s.textContent === "40 ml",
      ),
    ).toBe(false);
  });

  it("draws step markers as bare ordinals — no disc, no ring, no fill", () => {
    saveWizardPosition("r1", 2);
    const { conn } = makeConn();
    renderWizard(makeEnv(conn), phasedRecipe());

    const items = document.querySelectorAll<HTMLElement>("ol > li");
    expect(items.length).toBe(6);
    items.forEach((li) => {
      const marker = li.firstElementChild as HTMLElement;
      expect(marker.style.backgroundColor).toBe("");
      expect(marker.style.borderRadius).toBe("");
      expect(String(marker.className)).not.toMatch(/rounded|ring-/);
      // Each row is opened by a 1px hairline and nothing else.
      expect(li.style.borderTopColor).toBe("var(--border)");
    });
    assertHardRules(document.body);
  });

  it("puts the leave-confirmation on a scrim with one commit and one word", () => {
    const { conn } = makeConn();
    renderWizard(makeEnv(conn), phasedRecipe());
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    fireEvent.click(screen.getByRole("button", { name: "Leave the brew guide?" }));

    expect(screen.getByRole("button", { name: "Leave" })).toHaveAttribute(
      "data-ui",
      "commit",
    );
    const stay = screen.getByRole("button", { name: "Stay" });
    expect(stay).toHaveAttribute("data-ui", "word");
    expect(stay.style.backgroundColor).toBe("");
    // C5 again: no rule under an action, here or anywhere.
    expect(stay.style.borderBottomWidth).toBe("");
    expect(stay.style.borderBottomColor).toBe("");
    // The confirm step removes the panel beneath it rather than stacking a
    // second filled card on top of it.
    expect(document.querySelectorAll('[data-fill="panel"]')).toHaveLength(1);
    assertHardRules(document.body);
  });
});

// ---------------------------------------------------------------------------
// SommelierRecipeCard routing
// ---------------------------------------------------------------------------

describe("SommelierFavorites brew routing", () => {
  function favSommelier(overrides: Record<string, unknown> = {}) {
    return {
      favorites: [{
        ...phasedRecipe(),
        id: "fav-1",
        brew_count: 0,
        created_at: "",
      }],
      brewFavorite: vi.fn(async () => {}),
      removeFavorite: vi.fn(),
      ...overrides,
    } as unknown as Parameters<typeof SommelierFavorites>[0]["sommelier"];
  }

  it("opens the wizard for a phase-carrying favorite when a host provides the env", () => {
    const { conn } = makeConn();
    const sommelier = favSommelier();
    renderWithProviders(
      <BrewWizardContext.Provider value={makeEnv(conn)}>
        <SommelierFavorites sommelier={sommelier} />
      </BrewWizardContext.Provider>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Brew/ }));
    expect(sommelier.brewFavorite).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("keeps the legacy one-shot path without a wizard host", () => {
    const sommelier = favSommelier();
    renderWithProviders(<SommelierFavorites sommelier={sommelier} />);
    fireEvent.click(screen.getByRole("button", { name: /Brew/ }));
    expect(sommelier.brewFavorite).toHaveBeenCalledWith("fav-1");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps the legacy one-shot path for favorites without machine_phases", () => {
    const { conn } = makeConn();
    const sommelier = favSommelier({
      favorites: [{ ...legacyRecipe(), id: "fav-legacy", brew_count: 0, created_at: "" }],
    });
    renderWithProviders(
      <BrewWizardContext.Provider value={makeEnv(conn)}>
        <SommelierFavorites sommelier={sommelier} />
      </BrewWizardContext.Provider>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Brew/ }));
    expect(sommelier.brewFavorite).toHaveBeenCalledWith("fav-legacy");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("SommelierRecipeCard brew routing", () => {
  it("opens the wizard for phase-carrying recipes when a host provides the env", () => {
    const onBrew = vi.fn();
    const { conn } = makeConn();
    renderWithProviders(
      <BrewWizardContext.Provider value={makeEnv(conn)}>
        <SommelierRecipeCard
          recipe={phasedRecipe()}
          onBrew={onBrew}
          onFavorite={vi.fn()}
        />
      </BrewWizardContext.Provider>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Brew/ }));
    expect(onBrew).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Step 1 of 6")).toBeInTheDocument();
  });

  it("keeps the legacy one-shot path without a wizard host (byte-identical degradation)", () => {
    const onBrew = vi.fn();
    renderWithProviders(
      <SommelierRecipeCard recipe={phasedRecipe()} onBrew={onBrew} onFavorite={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Brew/ }));
    expect(onBrew).toHaveBeenCalledWith("r1");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps the legacy one-shot path for pre-contract rows without machine_phases", () => {
    const onBrew = vi.fn();
    const { conn } = makeConn();
    renderWithProviders(
      <BrewWizardContext.Provider value={makeEnv(conn)}>
        <SommelierRecipeCard recipe={legacyRecipe()} onBrew={onBrew} onFavorite={vi.fn()} />
      </BrewWizardContext.Provider>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Brew/ }));
    expect(onBrew).toHaveBeenCalledWith("r-legacy");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// SommelierSection — generation errors reach the banner as localized hints
// ---------------------------------------------------------------------------

function sommelierWsImpl(overrides: Record<string, () => Promise<unknown>> = {}) {
  return async (msg: WsMessage): Promise<unknown> => {
    const override = overrides[msg.type];
    if (override) return override();
    switch (msg.type) {
      case "melitta_barista/sommelier/beans/list":
        return { beans: [] };
      case "melitta_barista/sommelier/hoppers/get":
        return { hopper1: null, hopper2: null };
      case "melitta_barista/sommelier/milk/get":
        return { milk_types: [] };
      case "melitta_barista/sommelier/favorites/list":
        return { favorites: [] };
      case "melitta_barista/sommelier/history/list":
        return { sessions: [] };
      case "melitta_barista/sommelier/presets/list":
        return { presets: [] };
      case "melitta_barista/sommelier/settings/get":
        return { settings: {} };
      case "melitta_barista/sommelier/extras/get":
        return { extras: { syrups: [], toppings: [], liqueurs: [] } };
      case "melitta_barista/sommelier/preferences/get":
        return { preferences: {} };
      case "melitta_barista/sommelier/profiles/list":
        return { profiles: [] };
      default:
        return {};
    }
  };
}

describe("SommelierSection generate error banner", () => {
  it("shows the localized no_llm_agent hint (configure_llm) instead of a generic failure", async () => {
    const { conn } = makeConn(
      sommelierWsImpl({
        "melitta_barista/sommelier/generate": async () => {
          throw { code: "no_llm_agent", message: "server text" };
        },
      }),
    );
    const entities: HassEntities = {
      "sensor.mel_connection": ent("Connected", {
        entry_id: "entry-1",
        contract_version: 1,
        connected: true,
      }),
    };
    renderWithProviders(
      <SommelierSection conn={conn} entities={entities} prefix="mel" />,
    );
    const generateBtn = await screen.findByRole("button", { name: /Surprise me/ });
    await act(async () => {
      fireEvent.click(generateBtn);
    });
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("No AI conversation agent is installed");
    expect(alert).toHaveTextContent("Configure a conversation agent in HA");
  });

  it("shows the unauthorized admin hint on generate (§9.2.6.6)", async () => {
    const { conn } = makeConn(
      sommelierWsImpl({
        "melitta_barista/sommelier/generate": async () => {
          throw { code: "unauthorized", message: "Unauthorized" };
        },
      }),
    );
    renderWithProviders(
      <SommelierSection conn={conn} entities={{}} prefix="mel" />,
    );
    const generateBtn = await screen.findByRole("button", { name: /Surprise me/ });
    await act(async () => {
      fireEvent.click(generateBtn);
    });
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Sommelier generation requires a Home Assistant admin user.",
      ),
    );
  });
});

// ---------------------------------------------------------------------------
// §6.3.7 — machine-domain strings served over i18n/get
// ---------------------------------------------------------------------------

describe("wizard vocabulary from the server (§6.3.7 domain `wizard`)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("prefers the served string per key; unserved keys keep the bundle tier", () => {
    setServerStrings({ "wizard.step_of": "Schritt {n} von {m}" });
    const { conn } = makeConn();
    renderWizard(makeEnv(conn), phasedRecipe());
    expect(screen.getByText("Schritt 1 von 6")).toBeInTheDocument();
    // wizard.step.done is unserved → the client bundle still supplies it.
    expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
  });

  it("substitutes {n}/{m} into the served step titles (fmt() still runs)", () => {
    setServerStrings({
      "wizard.step.machine_n": "Guss {n}/{m}",
      "wizard.step_of": "{n}/{m}",
    });
    const { conn } = makeConn();
    renderWizard(makeEnv(conn), phasedRecipe());
    expect(screen.getByText("1/6")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Done" })); // cup
    fireEvent.click(screen.getByRole("button", { name: "Done" })); // pre
    expect(screen.getByText("Guss 1/2")).toBeInTheDocument();
  });

  it("buildBrewPlan takes the served cup step with {cup} and {ml} filled in", () => {
    setServerStrings({
      "wizard.step.cup": "Stelle deine {cup} ({ml}) unter den Auslauf",
      "sommelier.cup_size.mug": "Becher",
    });
    const steps = buildBrewPlan("en", phasedRecipe() as BrewPlanRecipe);
    expect(steps[0]).toMatchObject({
      title: "Stelle deine Becher (150 ml) unter den Auslauf",
    });
  });

  it("applyStatusPoll takes the served generic prompt", () => {
    setServerStrings({ "wizard.machine.prompt_generic": "Die Maschine wartet" });
    const m = { ...freshMachineState(), state: "brewing" as const };
    expect(applyStatusPoll("en", m, { awaiting_confirmation: true }).patch.prompt).toBe(
      "Die Maschine wartet",
    );
  });

  it("uses the served failure copy on a machine step, Retry/Skip included", async () => {
    setServerStrings({
      "wizard.machine.failed": "Brühen fehlgeschlagen",
      "wizard.machine.retry": "Nochmal",
      "wizard.machine.skip": "Überspringen",
    });
    const { conn } = makeConn(async (msg) => {
      if (msg.type === "melitta_barista/sommelier/brew_phase") {
        throw { code: "brew_failed", message: "busy" };
      }
      return {};
    });
    renderWizard(makeEnv(conn), phasedRecipe());
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Start this pour/ }));
    });
    expect(screen.getByRole("alert")).toHaveTextContent("Brühen fehlgeschlagen: busy");
    expect(screen.getByRole("button", { name: "Nochmal" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Überspringen" })).toBeInTheDocument();
  });

  it("passes machine text through the served {prompt} line verbatim", async () => {
    vi.useFakeTimers();
    setServerStrings({
      "wizard.machine.prompt": "Die Maschine fragt: {prompt}",
      "wizard.machine.confirm_manual": "Am Display der Maschine bestätigen.",
    });
    const { conn } = makeConn(async (msg) => {
      if (msg.type === "melitta_barista/status") {
        return {
          status: { is_brewing: true, awaiting_confirmation: true, manipulation: "CONFIRM_MILK" },
        };
      }
      return {};
    });
    // No confirm-button entity → the manual-confirm line stands in for it.
    renderWizard(makeEnv(conn, { confirmEntityId: null }), phasedRecipe());
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Start this pour/ }));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2100);
    });
    expect(screen.getByText("Die Maschine fragt: Confirm milk")).toBeInTheDocument();
    expect(screen.getByText("Am Display der Maschine bestätigen.")).toBeInTheDocument();
  });
});

describe("sommelier error hints from the server (§6.3.7 `sommelier.error.<code>`)", () => {
  it("prefers the served sentence, without the bundle-tier configure_llm tail", () => {
    const served =
      "No AI conversation agent is installed in Home Assistant. Add an LLM integration to use the sommelier.";
    setServerStrings({ "sommelier.error.no_llm_agent": served });
    const hint = sommelierErrorHint("en", { code: "no_llm_agent" });
    expect(hint).toBe(served);
    expect(hint).not.toContain("Configure a conversation agent in HA");
  });

  it("falls back to the bundle per key — an unserved code is unaffected", () => {
    setServerStrings({ "sommelier.error.timeout": "Zeitüberschreitung der KI" });
    expect(sommelierErrorHint("de", { code: "timeout" })).toBe("Zeitüberschreitung der KI");
    expect(sommelierErrorHint("en", { code: "unauthorized" })).toBe(
      "Sommelier generation requires a Home Assistant admin user.",
    );
  });

  it("renders a code the server serves but the client bundle has never heard of", () => {
    // A sixth served code must reach the user without a PWA release: the
    // client key map guards the bundle tier only, never the server probe.
    setServerStrings({ "sommelier.error.brew_failed": "Brühen fehlgeschlagen" });
    expect(sommelierErrorHint("en", { code: "brew_failed", message: "busy" })).toBe(
      "Brühen fehlgeschlagen",
    );
  });

  it("still invents nothing for an unmapped code the server does not serve", () => {
    expect(sommelierErrorHint("en", { code: "brew_failed", message: "busy" })).toBeNull();
  });
});