import {
  createContext,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { Connection } from "home-assistant-js-websocket";
import { t, type Locale } from "../lib/i18n";
import { pressButton } from "../lib/ha";
import {
  applyStatusPoll,
  estimateStepSeconds,
  freshMachineState,
  tickMachine,
  POLL_INTERVAL_MS,
  TICK_INTERVAL_MS,
  type BrewPlanRecipe,
  type MachineState,
  type StatusSnapshot,
  type WizardStep,
} from "../lib/brew-plan";
import { sommelierErrorHint, wsErrorMessage } from "../lib/sommelier-errors";

// ---------------------------------------------------------------------------
// Context — the wizard environment a section provides to recipe cards
// ---------------------------------------------------------------------------

/** What the brew-phase wizard needs from its hosting section. */
export interface BrewWizardEnv {
  conn: Connection;
  /**
   * Config entry id from the §3.4 bridge attributes; null when unknown
   * (extended-status polling is then skipped — estimates carry the bar).
   */
  entryId: string | null;
  /** `button.<prefix>_confirm_prompt` when that entity exists, else null. */
  confirmEntityId: string | null;
}

/**
 * Wizard environment context. Null (the default) means no host provides a
 * connection — recipe cards then keep the legacy one-shot brew path.
 */
export const BrewWizardContext = createContext<BrewWizardEnv | null>(null);

/** Brew target: a generated recipe row or a favorite row. */
export interface PhaseTarget {
  source: "generated" | "favorite";
  id: string;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

type MachineWizardStep = Extract<WizardStep, { kind: "machine" }>;

/**
 * Per-phase brewing + extended-status polling for the brew wizard
 * (Zone P-H; separate from `useSommelier`, which it never touches).
 *
 * `startPhase` fires ONE `melitta_barista/sommelier/brew_phase` for the
 * step's phase (legacy full steps fall back to the original
 * `sommelier/brew` / `sommelier/favorites/brew` commands), then polls
 * `melitta_barista/status` for real `progress`/`is_brewing` — completion is
 * the observed-brewing → not-brewing transition, folded in by the pure
 * `applyStatusPoll`. Reaching `state: "done"` is the caller's advance
 * signal. A poll failure or overtime arms `manualFinish` instead of lying.
 */
export function useBrewPhase(env: BrewWizardEnv | null, locale: Locale) {
  const [machine, setMachine] = useState<MachineState>(freshMachineState);
  const machineRef = useRef(machine);
  machineRef.current = machine;
  const timersRef = useRef<{
    tick: ReturnType<typeof setInterval> | null;
    poll: ReturnType<typeof setInterval> | null;
  }>({ tick: null, poll: null });

  const patch = useCallback((p: Partial<MachineState>) => {
    setMachine((m) => ({ ...m, ...p }));
  }, []);

  /** Stop both polling intervals (idempotent). */
  const stop = useCallback(() => {
    const timers = timersRef.current;
    if (timers.tick !== null) {
      clearInterval(timers.tick);
      timers.tick = null;
    }
    if (timers.poll !== null) {
      clearInterval(timers.poll);
      timers.poll = null;
    }
  }, []);

  /** Stop polling and return to a fresh idle state. */
  const reset = useCallback(() => {
    stop();
    setMachine(freshMachineState());
  }, [stop]);

  const pollStatus = useCallback(async () => {
    if (env === null || env.entryId === null) return;
    let payload: { status?: StatusSnapshot | null } | null = null;
    try {
      payload = await env.conn.sendMessagePromise<{
        status?: StatusSnapshot | null;
      }>({ type: "melitta_barista/status", entry_id: env.entryId });
    } catch {
      patch({ manualFinish: true });
      return;
    }
    const status = payload?.status;
    const m = machineRef.current;
    if (!status || m.state !== "brewing") return;
    const { patch: p, completed } = applyStatusPoll(locale, m, status);
    if (completed) {
      stop();
      setMachine((mm) => ({
        ...mm,
        ...p,
        progress: 100,
        prompt: null,
        state: "done",
      }));
      return;
    }
    patch(p);
  }, [env, locale, patch, stop]);

  const tick = useCallback(() => {
    const p = tickMachine(machineRef.current, Date.now());
    if (p !== null) patch(p);
  }, [patch]);

  const startPolling = useCallback(() => {
    stop();
    timersRef.current.tick = setInterval(tick, TICK_INTERVAL_MS);
    timersRef.current.poll = setInterval(() => {
      void pollStatus();
    }, POLL_INTERVAL_MS);
  }, [stop, tick, pollStatus]);

  /** Start one machine step's brew; polling begins on WS success. */
  const startPhase = useCallback(
    async (
      step: MachineWizardStep,
      recipe: BrewPlanRecipe,
      target: PhaseTarget,
    ) => {
      stop();
      setMachine({
        ...freshMachineState(),
        state: "brewing",
        startedAt: Date.now(),
        estimated: estimateStepSeconds(step, recipe),
      });
      // Scope the brew to this section's machine — without entry_id the
      // backend falls back to the FIRST config entry, the wrong machine on
      // multi-machine installs.
      const scope = env?.entryId !== null && env?.entryId !== undefined
        ? { entry_id: env.entryId }
        : {};
      const idField =
        target.source === "favorite"
          ? { favorite_id: target.id }
          : { recipe_id: target.id };
      try {
        if (env === null) throw new Error("No connection");
        if (step.legacyFull) {
          await env.conn.sendMessagePromise({
            type:
              target.source === "favorite"
                ? "melitta_barista/sommelier/favorites/brew"
                : "melitta_barista/sommelier/brew",
            ...idField,
            ...scope,
          });
        } else {
          await env.conn.sendMessagePromise({
            type: "melitta_barista/sommelier/brew_phase",
            ...idField,
            ...scope,
            phase_index: step.phaseIndex,
          });
        }
      } catch (e) {
        setMachine((m) => ({
          ...m,
          state: "error",
          error: sommelierErrorHint(locale, e) ?? wsErrorMessage(e),
        }));
        return;
      }
      startPolling();
    },
    [env, locale, stop, startPolling],
  );

  /** Press the machine's Confirm Prompt button on the user's behalf. */
  const confirmPrompt = useCallback(async () => {
    if (env === null || env.confirmEntityId === null) {
      patch({ confirmError: t(locale, "wizard.machine.confirm_manual") });
      return;
    }
    patch({ confirmBusy: true, confirmError: "" });
    try {
      await pressButton(env.conn, env.confirmEntityId);
      patch({ prompt: null, confirmBusy: false });
    } catch (e) {
      patch({
        confirmBusy: false,
        confirmError: `${t(locale, "wizard.machine.confirm_failed")}: ${wsErrorMessage(e)}`,
      });
    }
  }, [env, locale, patch]);

  /** The user confirmed completion manually (polling lost / overtime). */
  const finishManually = useCallback(() => {
    stop();
    setMachine((m) => ({ ...m, progress: 100, prompt: null, state: "done" }));
  }, [stop]);

  // Never leak intervals past unmount.
  useEffect(() => stop, [stop]);

  return { machine, startPhase, confirmPrompt, finishManually, stop, reset };
}
