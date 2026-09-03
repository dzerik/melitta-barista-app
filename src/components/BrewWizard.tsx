import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Check, Coffee, Loader2 } from "lucide-react";
import { usePreferences } from "../lib/preferences";
import { displayNameFor } from "../lib/i18n";
import {
  buildBrewPlan,
  clearWizardPosition,
  fmt,
  loadWizardPosition,
  saveWizardPosition,
  type BrewPlanRecipe,
  type WizardStep,
} from "../lib/brew-plan";
import {
  BrewWizardContext,
  useBrewPhase,
  type PhaseTarget,
} from "../hooks/useBrewPhase";
import type { AiRecipe } from "../hooks/useSommelier";

interface Props {
  open: boolean;
  recipe: AiRecipe;
  /** Brew target kind; favorites route through favorites/brew. */
  source?: PhaseTarget["source"];
  /** Row id to brew when it differs from recipe.id (favorite rows). */
  sourceId?: string;
  onClose: () => void;
}

type MachineWizardStep = Extract<WizardStep, { kind: "machine" }>;

/**
 * Linear step-machine wizard for brewing a sommelier recipe (Zone P-H).
 *
 * Compiles the recipe into one numbered checklist (cup step + pre steps +
 * per-phase manual actions and machine pours + post steps — see
 * `buildBrewPlan`), advances manual steps on an explicit "Done" tap, brews
 * machine steps one phase at a time via `useBrewPhase`, surfaces machine
 * confirmation prompts inline, and persists the position per recipe id in
 * localStorage (2 h TTL) so closing mid-brew resumes where the user left off.
 */
export function BrewWizard({
  open,
  recipe,
  source = "generated",
  sourceId,
  onClose,
}: Props) {
  const env = useContext(BrewWizardContext);
  const { t, locale } = usePreferences();
  const phase = useBrewPhase(env, locale);
  const steps = useMemo(
    () => buildBrewPlan(locale, recipe as BrewPlanRecipe),
    [locale, recipe],
  );
  const [stepIndex, setStepIndex] = useState(0);
  const [resumed, setResumed] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);

  const stepsRef = useRef(steps);
  stepsRef.current = steps;
  const resetPhase = phase.reset;
  const stopPhase = phase.stop;

  // Rebuild position on open / recipe change; restore a saved one, if any.
  useEffect(() => {
    if (!open) {
      stopPhase();
      return;
    }
    resetPhase();
    setConfirmClose(false);
    const saved = loadWizardPosition(recipe.id);
    if (saved !== null && saved > 0 && saved <= stepsRef.current.length) {
      setStepIndex(saved);
      setResumed(true);
    } else {
      setStepIndex(0);
      setResumed(false);
    }
  }, [open, recipe.id, resetPhase, stopPhase]);

  const finished = steps.length > 0 && stepIndex >= steps.length;

  const advance = () => {
    resetPhase();
    setStepIndex((i) => {
      const next = Math.min(i + 1, stepsRef.current.length);
      if (next >= stepsRef.current.length) clearWizardPosition(recipe.id);
      else saveWizardPosition(recipe.id, next);
      return next;
    });
  };

  // A completed machine pour (observed brewing → not brewing) auto-advances.
  const machineState = phase.machine.state;
  useEffect(() => {
    if (open && machineState === "done") advance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, machineState]);

  if (!open) return null;

  const target: PhaseTarget = { source, id: sourceId ?? recipe.id };
  const m = phase.machine;

  const restart = () => {
    resetPhase();
    setStepIndex(0);
    setResumed(false);
    clearWizardPosition(recipe.id);
  };

  const close = () => {
    stopPhase();
    setConfirmClose(false);
    onClose();
  };

  const requestClose = () => {
    const started = stepIndex > 0 || m.state !== "idle";
    if (started && !finished) setConfirmClose(true);
    else close();
  };

  const badge = (text: string, key: string) => (
    <span
      key={key}
      className="text-[10px] px-2 py-0.5 rounded-full"
      style={{ background: "var(--surface)", color: "var(--text-tertiary)" }}
    >
      {text}
    </span>
  );

  const componentBadges = (step: MachineWizardStep) => {
    const c = step.component;
    const badges: [string, string][] = [];
    if (c.process) badges.push([displayNameFor(locale, "process", c.process), "process"]);
    if (c.portion_ml) badges.push([`${c.portion_ml} ml`, "ml"]);
    if (c.shots) badges.push([`×${c.shots}`, "shots"]);
    if (c.intensity) badges.push([displayNameFor(locale, "intensity", c.intensity), "intensity"]);
    if (badges.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-1 mt-1">
        {badges.map(([text, key]) => badge(text, key))}
      </div>
    );
  };

  const hints = (step: MachineWizardStep) =>
    step.hints.length > 0 && (
      <div
        className="mt-2 rounded-xl px-3 py-2 text-[11px]"
        style={{ background: "var(--surface)", color: "var(--text-secondary)" }}
      >
        <div className="font-medium text-tertiary">{t("wizard.machine.during_hint")}</div>
        <ul className="mt-1 list-disc pl-4 space-y-0.5">
          {step.hints.map((h, i) => (
            <li key={i}>{h}</li>
          ))}
        </ul>
      </div>
    );

  const primaryBtn =
    "rounded-xl px-4 py-2 text-xs font-semibold transition active:scale-95";
  const primaryStyle = {
    background: "var(--btn-primary-bg)",
    color: "var(--btn-primary-text)",
  } as const;
  const ghostBtn =
    "rounded-xl px-4 py-2 text-xs font-medium ring-1 ring-border transition active:scale-95";
  const ghostStyle = {
    background: "var(--surface-card)",
    color: "var(--text-secondary)",
  } as const;

  const promptCard = m.prompt !== null && (
    <div
      className="mt-2 rounded-xl px-3 py-2 text-[11px] ring-1 space-y-2"
      style={
        {
          // Uses the error surface as the app's one attention surface.
          background: "var(--error-bg)",
          color: "var(--error-text)",
          "--tw-ring-color": "var(--border)",
        } as React.CSSProperties
      }
    >
      <div>{fmt(t("wizard.machine.prompt"), { prompt: m.prompt })}</div>
      {env?.confirmEntityId ? (
        <button
          className={primaryBtn}
          style={primaryStyle}
          disabled={m.confirmBusy}
          onClick={() => void phase.confirmPrompt()}
        >
          {t("wizard.machine.confirm")}
        </button>
      ) : (
        <div>{t("wizard.machine.confirm_manual")}</div>
      )}
      {m.confirmError && <div>{m.confirmError}</div>}
    </div>
  );

  const machineCard = (step: MachineWizardStep) => {
    if (m.state === "idle") {
      return (
        <>
          {componentBadges(step)}
          {hints(step)}
          <div className="mt-2 flex justify-end">
            <button
              className={primaryBtn}
              style={primaryStyle}
              onClick={() => void phase.startPhase(step, recipe as BrewPlanRecipe, target)}
            >
              <span className="flex items-center gap-1.5">
                <Coffee size={14} />
                {step.legacyFull
                  ? t("wizard.machine.start_full")
                  : t("wizard.machine.start")}
              </span>
            </button>
          </div>
        </>
      );
    }
    if (m.state === "error") {
      return (
        <>
          <div
            role="alert"
            className="mt-1 rounded-xl px-3 py-2 text-[11px]"
            style={{ background: "var(--error-bg)", color: "var(--error-text)" }}
          >
            {t("wizard.machine.failed")}: {m.error}
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <button className={ghostBtn} style={ghostStyle} onClick={advance}>
              {t("wizard.machine.skip")}
            </button>
            <button
              className={primaryBtn}
              style={primaryStyle}
              onClick={() => void phase.startPhase(step, recipe as BrewPlanRecipe, target)}
            >
              {t("wizard.machine.retry")}
            </button>
          </div>
        </>
      );
    }
    // brewing (and the momentary "done" before auto-advance)
    return (
      <>
        <div className="mt-2 flex items-center gap-2">
          <div
            className="flex-1 h-2 rounded-full overflow-hidden"
            style={{ background: "var(--surface)" }}
          >
            <div
              className="h-full transition-all duration-200"
              style={{ width: `${m.progress}%`, background: "var(--btn-primary-bg)" }}
            />
          </div>
          <span className="text-[11px] text-tertiary tabular-nums">
            {Math.round(m.progress)}%
          </span>
        </div>
        <p className="mt-1 text-[11px] text-tertiary">
          {fmt(t("wizard.machine.estimated"), { sec: m.estimated })}
        </p>
        {hints(step)}
        {promptCard}
        <div className="mt-2 flex justify-end">
          {m.manualFinish ? (
            <button
              className={primaryBtn}
              style={primaryStyle}
              onClick={phase.finishManually}
            >
              {t("wizard.machine.im_done")}
            </button>
          ) : (
            <span className="flex items-center gap-1.5 text-[11px] text-tertiary">
              <Loader2 size={12} className="animate-spin" />
              {t("wizard.machine.waiting")}
            </span>
          )}
        </div>
      </>
    );
  };

  const stepTitle = (step: WizardStep) => {
    if (step.kind === "manual") return step.title;
    return step.pourCount > 1
      ? fmt(t("wizard.step.machine_n"), { n: step.pourN, m: step.pourCount })
      : t("wizard.step.machine");
  };

  const renderStep = (step: WizardStep, i: number) => {
    const state = i < stepIndex ? "done" : i === stepIndex ? "active" : "future";
    return (
      <li key={i} className="flex gap-3 py-2">
        <span
          className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] tabular-nums ring-1 ring-border mt-0.5"
          style={
            state === "active"
              ? { background: "var(--btn-primary-bg)", color: "var(--btn-primary-text)" }
              : state === "done"
                ? { background: "var(--success)", color: "#fff" }
                : { background: "var(--surface)", color: "var(--text-tertiary)" }
          }
        >
          {state === "done" ? <Check size={12} /> : i + 1}
        </span>
        <div className="flex-1 min-w-0">
          <div
            className={`text-xs ${state === "active" ? "font-semibold text-primary" : "text-tertiary"}`}
          >
            {stepTitle(step)}
          </div>
          {state === "active" && (
            <div className="mt-1">
              {step.kind === "manual" ? (
                <>
                  {step.notes && (
                    <div className="text-[11px] text-tertiary">{step.notes}</div>
                  )}
                  <div className="mt-2 flex justify-end">
                    <button className={primaryBtn} style={primaryStyle} onClick={advance}>
                      {t("wizard.step.done")}
                    </button>
                  </div>
                </>
              ) : (
                machineCard(step)
              )}
            </div>
          )}
        </div>
      </li>
    );
  };

  const finishView = (
    <div className="p-1">
      <h3 className="text-sm font-semibold text-primary">{t("wizard.finish.title")}</h3>
      {recipe.extras?.instruction && (
        <p className="mt-2 text-xs text-secondary italic">{recipe.extras.instruction}</p>
      )}
      <p className="mt-2 text-[11px] text-tertiary">{t("wizard.finish.message")}</p>
      <div className="mt-3 flex justify-end">
        <button
          className={primaryBtn}
          style={primaryStyle}
          onClick={() => {
            clearWizardPosition(recipe.id);
            close();
          }}
        >
          {t("wizard.finish.button")}
        </button>
      </div>
    </div>
  );

  const confirmCloseView = (
    <div
      className="absolute inset-0 flex items-center justify-center p-5"
      style={{ background: "var(--overlay-bg)" }}
    >
      <div
        className="rounded-2xl ring-1 ring-border p-4 max-w-xs surface"
        style={{ background: "var(--surface-card)" }}
      >
        <h3 className="text-sm font-semibold text-primary">{t("wizard.close.title")}</h3>
        <p className="mt-1 text-[11px] text-secondary">{t("wizard.close.message")}</p>
        <div className="mt-3 flex justify-end gap-2">
          <button
            className={ghostBtn}
            style={ghostStyle}
            onClick={() => setConfirmClose(false)}
          >
            {t("wizard.close.stay")}
          </button>
          <button
            className={primaryBtn}
            style={primaryStyle}
            onClick={() => {
              saveWizardPosition(recipe.id, stepIndex);
              close();
            }}
          >
            {t("wizard.close.leave")}
          </button>
        </div>
      </div>
    </div>
  );

  const total = steps.length;
  const current = Math.min(stepIndex + 1, Math.max(total, 1));

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm"
      style={{ background: "var(--overlay-bg)" }}
      onClick={requestClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-lg max-h-[85vh] mx-4 rounded-2xl ring-1 ring-border overflow-hidden flex flex-col surface"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 px-5 py-4 border-b border-border">
          <span className="text-sm font-semibold text-primary truncate">
            {recipe.name || t("wizard.title")}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            {total > 0 && !finished && (
              <span className="text-[11px] text-tertiary tabular-nums">
                {fmt(t("wizard.step_of"), { n: current, m: total })}
              </span>
            )}
            <button
              aria-label={t("wizard.close.title")}
              onClick={requestClose}
              className="text-tertiary hover:text-primary transition p-1"
            >
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {resumed && !finished && (
            <div
              className="mb-3 flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-[11px]"
              style={{ background: "var(--surface)", color: "var(--text-secondary)" }}
            >
              <span>{t("wizard.resumed")}</span>
              <button className={ghostBtn} style={ghostStyle} onClick={restart}>
                {t("wizard.restart")}
              </button>
            </div>
          )}
          {finished || total === 0 ? (
            finishView
          ) : (
            <ol className="space-y-1">{steps.map(renderStep)}</ol>
          )}
        </div>
        {confirmClose && confirmCloseView}
      </div>
    </div>,
    document.body,
  );
}
