/**
 * Brew-phase wizard step model (UI Contract §10.2 Zone P-H).
 *
 * Pure port of the panel step-machine semantics: a sommelier recipe compiles
 * into ONE flat, numbered checklist —
 *
 *   [cup step (synthesized from cup_type + vocab.cup_size.volumes_ml, §9.2.6.3)]
 *   + steps with phase "pre" (sorted by order)
 *   + for each machine_phases[i]:
 *       its user_action_before entries as manual steps,
 *       then a machine step that fires ONE per-phase brew
 *       (WS melitta_barista/sommelier/brew_phase { phase_index: i })
 *   + steps with phase "post".
 *
 * Exactly one step is active at a time. Manual steps advance on an explicit
 * "Done" tap; machine steps poll extended status and auto-complete on the
 * is_brewing true→false transition — a completion is only trusted after
 * is_brewing was OBSERVED true, so the warm-up window can't be mistaken for
 * "done". Steps with phase "during" are shown as hints on the first machine
 * step. Legacy rows without machine_phases compile to a single full-recipe
 * brew step (the pre-0.89 one-shot), preserving today's behavior.
 *
 * All state transitions live here as pure functions; `useBrewPhase` wraps
 * them with timers and the WS calls, and `BrewWizard.tsx` stays thin.
 */
import { tServer, type Locale } from "./i18n";
import { sommelierLabel, cupVolumesHint } from "./sommelier-vocab";

// ---------------------------------------------------------------------------
// Wire shapes (loose — server-authored JSON, validated field by field)
// ---------------------------------------------------------------------------

/** One manual step of a recipe's `steps` / `user_action_before` lists. */
export interface BrewStepWire {
  order?: number;
  phase?: string;
  action?: string;
  amount?: number | string;
  unit?: string;
  ingredient?: string;
  notes?: string;
}

/** A machine-phase component (freestyle-token fields, portion in ml). */
export interface PhaseComponent {
  process?: string;
  intensity?: string;
  shots?: string | number;
  portion_ml?: number;
}

/** One entry of a recipe's `machine_phases` list. */
export interface MachinePhaseWire {
  component?: PhaseComponent | null;
  user_action_before?: BrewStepWire[];
}

/**
 * The recipe fields the wizard reads. Deliberately loose: the sommelier wire
 * rows carry more (and the client type `AiRecipe` predates `machine_phases`),
 * so everything here is optional and re-validated.
 */
export interface BrewPlanRecipe {
  id: string;
  name?: string;
  cup_type?: string | null;
  machine_phases?: unknown;
  steps?: unknown;
  component1?: PhaseComponent | null;
  component2?: PhaseComponent | null;
  extras?: { instruction?: string | null } | null;
}

// ---------------------------------------------------------------------------
// Recipe field narrowing
// ---------------------------------------------------------------------------

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Validated `machine_phases` list of a recipe row; `[]` when absent/malformed. */
export function recipeMachinePhases(recipe: unknown): MachinePhaseWire[] {
  if (!isObject(recipe) || !Array.isArray(recipe.machine_phases)) return [];
  return recipe.machine_phases.filter(isObject) as MachinePhaseWire[];
}

/** Validated manual `steps` list of a recipe row; `[]` when absent/malformed. */
export function recipeManualSteps(recipe: unknown): BrewStepWire[] {
  if (!isObject(recipe) || !Array.isArray(recipe.steps)) return [];
  return recipe.steps.filter(isObject) as BrewStepWire[];
}

/**
 * The wizard gate: true only when the row carries at least one machine phase.
 *
 * `machine_phases` first appeared on 0.89 servers — the same release as the
 * `brew_phase` WS command — so its presence is the signal that per-phase
 * brewing exists. Rows without it (pre-contract servers) keep the current
 * legacy one-shot brew path, byte-identically.
 */
export function hasPhasePlan(recipe: unknown): boolean {
  return recipeMachinePhases(recipe).length > 0;
}

// ---------------------------------------------------------------------------
// Interpolation (the app bundles have no params support)
// ---------------------------------------------------------------------------

/** Replace `{name}` placeholders; unknown placeholders stay verbatim. */
export function fmt(
  template: string,
  params: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in params ? String(params[key]) : match,
  );
}

// ---------------------------------------------------------------------------
// Step list
// ---------------------------------------------------------------------------

/** One compiled wizard step. */
export type WizardStep =
  | {
      kind: "manual";
      /** Synthesized steps (the cup step) are localized client-side. */
      synthetic: boolean;
      title: string;
      notes: string | null;
    }
  | {
      kind: "machine";
      /** Index into machine_phases; null on the legacy full-recipe step. */
      phaseIndex: number | null;
      /** Legacy row: one full-recipe brew via the original brew commands. */
      legacyFull: boolean;
      /** 1-based pour number and the total pour count. */
      pourN: number;
      pourCount: number;
      component: PhaseComponent;
      /** "during"-phase manual steps, shown as hints (first machine step only). */
      hints: string[];
    };

const byOrder = (a: BrewStepWire, b: BrewStepWire) =>
  (a.order ?? 0) - (b.order ?? 0);

/** Title line for one manual wire step: action (amount unit) — ingredient. */
export function manualStepTitle(step: BrewStepWire): string {
  const qty =
    step.amount !== undefined && step.unit
      ? ` (${step.amount} ${step.unit})`
      : "";
  const ingredient = step.ingredient ? ` — ${step.ingredient}` : "";
  return `${step.action ?? ""}${qty}${ingredient}`;
}

function manualStep(step: BrewStepWire): WizardStep {
  return {
    kind: "manual",
    synthetic: false,
    title: manualStepTitle(step),
    notes: typeof step.notes === "string" && step.notes ? step.notes : null,
  };
}

/**
 * Compile a recipe into the flat ordered wizard step list.
 *
 * The cup step is synthesized from `cup_type`: its label goes through the
 * §9.2.6.2 chain (`sommelier.cup_size.<token>`) and its volume hint prefers
 * the served `vocab.cup_size.volumes_ml` range (§9.2.6.3), falling back to
 * the summed phase portion_ml.
 */
export function buildBrewPlan(
  locale: Locale,
  recipe: BrewPlanRecipe,
): WizardStep[] {
  const all = recipeManualSteps(recipe);
  const phaseOf = (s: BrewStepWire) => s.phase ?? "during";
  const pre = all.filter((s) => phaseOf(s) === "pre").sort(byOrder);
  const during = all.filter((s) => phaseOf(s) === "during").sort(byOrder);
  const post = all.filter((s) => phaseOf(s) === "post").sort(byOrder);
  const phases = recipeMachinePhases(recipe);
  const duringHints = during.map(manualStepTitle);

  const steps: WizardStep[] = [];

  if (recipe.cup_type) {
    const totalMl =
      phases.reduce((acc, p) => acc + (Number(p.component?.portion_ml) || 0), 0) ||
      (Number(recipe.component1?.portion_ml) || 0) +
        (Number(recipe.component2?.portion_ml) || 0);
    const ml = cupVolumesHint(recipe.cup_type) ?? `${totalMl} ml`;
    steps.push({
      kind: "manual",
      synthetic: true,
      title: fmt(tServer(locale, "wizard.step.cup"), {
        cup: sommelierLabel(locale, "cup_size", recipe.cup_type),
        ml,
      }),
      notes: null,
    });
  }

  for (const s of pre) steps.push(manualStep(s));

  let pourN = 0;
  const machineSteps: Extract<WizardStep, { kind: "machine" }>[] = [];
  if (phases.length > 0) {
    phases.forEach((p, i) => {
      const actions = Array.isArray(p.user_action_before)
        ? [...p.user_action_before].filter(isObject).sort(byOrder)
        : [];
      for (const s of actions) steps.push(manualStep(s));
      pourN += 1;
      const step: Extract<WizardStep, { kind: "machine" }> = {
        kind: "machine",
        phaseIndex: i,
        legacyFull: false,
        pourN,
        pourCount: 0,
        component: p.component ?? {},
        hints: i === 0 ? duringHints : [],
      };
      machineSteps.push(step);
      steps.push(step);
    });
  } else if (recipe.component1) {
    // Legacy row without machine_phases: one full-recipe brew.
    pourN = 1;
    const step: Extract<WizardStep, { kind: "machine" }> = {
      kind: "machine",
      phaseIndex: null,
      legacyFull: true,
      pourN,
      pourCount: 0,
      component: recipe.component1 ?? {},
      hints: duringHints,
    };
    machineSteps.push(step);
    steps.push(step);
  }
  for (const step of machineSteps) step.pourCount = pourN;

  for (const s of post) steps.push(manualStep(s));
  return steps;
}

// ---------------------------------------------------------------------------
// Machine-step state (one brew attempt lifecycle)
// ---------------------------------------------------------------------------

export const POLL_INTERVAL_MS = 2000;
export const TICK_INTERVAL_MS = 250;
export const POLL_TIMEOUT_BUFFER_S = 30;
export const PROGRESS_CAP_PERCENT = 95;

/** State of the active machine step's brew attempt. */
export interface MachineState {
  state: "idle" | "brewing" | "error" | "done";
  error: string;
  progress: number;
  /** True once the server reported a usable percentage — estimates stand down. */
  liveProgress: boolean;
  /** True once is_brewing was OBSERVED true (the completion-trust gate). */
  sawBrewing: boolean;
  /** Time-based escape hatch: polling lost or overtime — offer "I'm done". */
  manualFinish: boolean;
  /** Localized machine confirmation prompt, or null. */
  prompt: string | null;
  confirmBusy: boolean;
  confirmError: string;
  startedAt: number;
  /** Estimated seconds for this brew (progress fallback + overtime bound). */
  estimated: number;
}

/** Fresh idle machine-step state. */
export function freshMachineState(): MachineState {
  return {
    state: "idle",
    error: "",
    progress: 0,
    liveProgress: false,
    sawBrewing: false,
    manualFinish: false,
    prompt: null,
    confirmBusy: false,
    confirmError: "",
    startedAt: 0,
    estimated: 0,
  };
}

/** Estimated seconds for one machine phase: warmup + pump time by volume. */
export function estimatePhaseSeconds(component: PhaseComponent | null | undefined): number {
  const ml = Number(component?.portion_ml) || 0;
  return Math.max(10, Math.round(8 + (ml / 50) * 5));
}

/** Estimated seconds for a machine step (legacy full steps sum all phases). */
export function estimateStepSeconds(
  step: Extract<WizardStep, { kind: "machine" }>,
  recipe: BrewPlanRecipe,
): number {
  if (!step.legacyFull) return estimatePhaseSeconds(step.component);
  const phases = recipeMachinePhases(recipe);
  if (phases.length > 0) {
    return phases.reduce((acc, p) => acc + estimatePhaseSeconds(p.component), 0);
  }
  return (
    estimatePhaseSeconds(recipe.component1) +
    (recipe.component2?.process && recipe.component2.process !== "none"
      ? estimatePhaseSeconds(recipe.component2)
      : 0)
  );
}

/**
 * Time-driven fallback tick: estimate-based progress (capped so it never
 * fakes completion) plus the manual-finish escape once well past the
 * estimate. Returns a state patch, or null when nothing changes.
 */
export function tickMachine(
  m: MachineState,
  now: number,
): Partial<MachineState> | null {
  if (m.state !== "brewing") return null;
  const elapsed = (now - m.startedAt) / 1000;
  const patch: Partial<MachineState> = {};
  if (!m.liveProgress && m.estimated > 0) {
    patch.progress = Math.min(
      PROGRESS_CAP_PERCENT,
      (elapsed / m.estimated) * 100,
    );
  }
  if (elapsed > m.estimated + POLL_TIMEOUT_BUFFER_S) patch.manualFinish = true;
  return Object.keys(patch).length > 0 ? patch : null;
}

/** The `status` object of a `melitta_barista/status` reply (loose). */
export interface StatusSnapshot {
  is_brewing?: unknown;
  awaiting_confirmation?: unknown;
  manipulation?: unknown;
  progress?: unknown;
}

/**
 * Fold one extended-status poll into the machine state.
 *
 * `completed` is true only on the is_brewing true→false transition AFTER
 * is_brewing was observed true — the first polls land during warm-up, before
 * PRODUCT, and must not be mistaken for "done". Manipulation prompts localize
 * per §6.3.5: server string `status.manipulation.<TOKEN>` → humanized token.
 */
export function applyStatusPoll(
  locale: Locale,
  m: MachineState,
  status: StatusSnapshot,
): { patch: Partial<MachineState>; completed: boolean } {
  const patch: Partial<MachineState> = {
    prompt:
      status.awaiting_confirmation === true
        ? typeof status.manipulation === "string" && status.manipulation
          ? tServer(locale, `status.manipulation.${status.manipulation}`)
          : tServer(locale, "wizard.machine.prompt_generic")
        : null,
  };
  if (status.is_brewing === true) {
    patch.sawBrewing = true;
    const p = Number(status.progress);
    if (Number.isFinite(p) && p > 0 && p <= 100) {
      patch.liveProgress = true;
      patch.progress = p;
    }
  }
  const completed = m.sawBrewing && status.is_brewing === false;
  return { patch, completed };
}

// ---------------------------------------------------------------------------
// Re-entry — per-recipe position in localStorage, 2 h TTL
// ---------------------------------------------------------------------------

export const WIZARD_RESUME_TTL_MS = 2 * 60 * 60 * 1000;
const STORAGE_PREFIX = "melitta_barista.wizard.";

/** Saved step position for a recipe, or null (absent, stale, malformed). */
export function loadWizardPosition(
  recipeId: string,
  now: number = Date.now(),
): number | null {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + recipeId);
    if (!raw) return null;
    const saved: unknown = JSON.parse(raw);
    if (!isObject(saved) || typeof saved.stepIndex !== "number") return null;
    const ts = typeof saved.ts === "number" ? saved.ts : 0;
    if (now - ts > WIZARD_RESUME_TTL_MS) return null;
    return saved.stepIndex;
  } catch {
    return null;
  }
}

/** Persist the current step position (best-effort — private mode / quota). */
export function saveWizardPosition(
  recipeId: string,
  stepIndex: number,
  now: number = Date.now(),
): void {
  try {
    localStorage.setItem(
      STORAGE_PREFIX + recipeId,
      JSON.stringify({ stepIndex, ts: now }),
    );
  } catch {
    // best-effort
  }
}

/** Drop the saved position (finished or restarted). */
export function clearWizardPosition(recipeId: string): void {
  try {
    localStorage.removeItem(STORAGE_PREFIX + recipeId);
  } catch {
    // best-effort
  }
}
