import { useContext, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Check, Coffee } from "lucide-react";
import { usePreferences } from "../lib/preferences";
import { displayNameFor, tServer, type TranslationKey } from "../lib/i18n";
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
import { ActionBand, Commit, Meter, Panel, Rule, Word } from "./ui";

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
 * §10 error: `--error-text` type between two 1px `--error-border` rules — no
 * fill, no box, no radius. Every side is a longhand on purpose: declaring
 * `borderStyle` alone would give the untouched left/right sides the initial
 * `medium` width and quietly draw a box.
 */
const ERROR_RULES: CSSProperties = {
  borderTopWidth: "1px",
  borderTopStyle: "solid",
  borderTopColor: "var(--error-border)",
  borderBottomWidth: "1px",
  borderBottomStyle: "solid",
  borderBottomColor: "var(--error-border)",
  borderRadius: 0,
  color: "var(--error-text)",
};

/**
 * Linear step-machine wizard for brewing a sommelier recipe (Zone P-H).
 *
 * Compiles the recipe into one numbered checklist (cup step + pre steps +
 * per-phase manual actions and machine pours + post steps — see
 * `buildBrewPlan`), advances manual steps on an explicit "Done" tap, brews
 * machine steps one phase at a time via `useBrewPhase`, surfaces machine
 * confirmation prompts inline, and persists the position per recipe id in
 * localStorage (2 h TTL) so closing mid-brew resumes where the user left off.
 *
 * VISUAL CONTRACT. The wizard is drawn by the shared `Panel` — the app's one
 * §5.B shape (C7, C8, C9). It used to hand-roll its own scrim, its own
 * `max-w-lg` measure, its own `px-5 py-4 border-b` header and its own `X` at
 * 18px, which is three of the five rival header treatments and one of the five
 * rival panel widths the audit found; all of that now lives in one place and
 * the wizard only says which measure it is (`sm`) and what its header carries.
 * Nothing inside the panel paints.
 *
 * The step list is hairline rows; a pour's progress is the segmented Meter
 * (owner decision 4 — the tick ring is a full-screen takeover only) and it
 * carries NO percentage (C18: a progress meter's end is estimated, so a figure
 * on it is false precision); the composition of a phase is the §C7 value strip,
 * which is the earlier fix that puts the phase's make-up on the step rather
 * than a bare "phase 1/2", now drawn as hairline-divided label/value pairs
 * instead of capsule pills. Exactly ONE commit rectangle is rendered per step
 * view, it sits in an `ActionBand`, and every other action is a `Word`.
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
  /**
   * Brew-guide vocabulary (§6.3.7 domain `wizard`): served string → the
   * identically-named bundle entry → humanized token. The bundle keys are
   * byte-equal to the served ones, so `tServer` needs no alias map; results
   * still flow through `fmt()` wherever the string carries placeholders.
   */
  const tw = (key: string) => tServer(locale, key);
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

  /**
   * The phase's composition as the §C7 value strip: one line of `t-label`
   * groups divided by short 1px hairlines, the LABEL half in `--accent` and
   * the VALUE half in `--text-primary`. The process itself is pure identity
   * and carries no label half, so it spends no accent.
   *
   * C22 — A NUMBER AND ITS UNIT ARE TWO THINGS. "120 ml" used to be baked into
   * one string and rendered wholly in `--text-primary`, which means the unit
   * could never be re-inked: §7.6 drops a unit to `--text-tertiary` at the SAME
   * size (never to an off-scale 9px or 11px), and a string cannot be given two
   * colours. So a fact carries `value` and `unit` separately and the strip
   * inks each half itself — the shape `RecipeInfo` already draws in
   * BrewSection, where the figure is `--text-primary` at 600 and "ml" sits
   * beside it in `--text-tertiary`.
   *
   * `numeric` is what earns the `.num` tabular utility (§R1.8): a machine
   * FIGURE gets it so digits line up down a column; a token name like "strong"
   * is a word and would only be given false alignment by it.
   */
  const componentStrip = (step: MachineWizardStep) => {
    const c = step.component;
    const facts: {
      label?: string;
      value: string;
      unit?: string;
      numeric?: boolean;
      key: string;
    }[] = [];
    if (c.process)
      facts.push({ value: displayNameFor(locale, "process", c.process), key: "process" });
    if (c.portion_ml)
      facts.push({
        label: t("freestyle.portion" as TranslationKey),
        value: String(c.portion_ml),
        // The SI symbol, not a translatable word — it is spelled the same way
        // in every one of the 29 bundles and in every other strip in the app.
        unit: "ml",
        numeric: true,
        key: "ml",
      });
    if (c.shots)
      facts.push({
        label: t("freestyle.shots" as TranslationKey),
        value:
          typeof c.shots === "number"
            ? String(c.shots)
            : displayNameFor(locale, "shots", c.shots),
        numeric: typeof c.shots === "number",
        key: "shots",
      });
    if (c.intensity)
      facts.push({
        label: t("freestyle.intensity" as TranslationKey),
        value: displayNameFor(locale, "intensity", c.intensity),
        key: "intensity",
      });
    if (facts.length === 0) return null;
    return (
      <div
        data-ui="value-strip"
        className="mt-1 flex min-w-0 items-baseline overflow-hidden"
      >
        {facts.map((fact, i) => (
          <span
            key={fact.key}
            className={`t-label whitespace-nowrap truncate ${i > 0 ? "border-l pl-3 ml-3" : ""}`}
            style={i > 0 ? { borderColor: "var(--border)" } : undefined}
          >
            {fact.label === undefined ? null : (
              <span style={{ color: "var(--accent)" }}>{fact.label} </span>
            )}
            <span
              className={fact.numeric ? "num" : undefined}
              style={{
                // The value half of a labelled pair carries the weight; a bare
                // identity word (the process) is not a value and does not.
                fontWeight: fact.label === undefined ? undefined : 600,
                color: "var(--text-primary)",
              }}
            >
              {fact.value}
            </span>
            {fact.unit === undefined ? null : (
              <span style={{ color: "var(--text-tertiary)" }}>{` ${fact.unit}`}</span>
            )}
          </span>
        ))}
      </div>
    );
  };

  const hints = (step: MachineWizardStep) =>
    step.hints.length > 0 && (
      <div className="mt-3">
        <Rule />
        <div className="pt-2 t-label" style={{ color: "var(--text-secondary)" }}>
          {/* §7.3/C31: weight comes from `.t-label`'s own 500 and is never
              restated — a caption is ranked by ink, not by boldness. */}
          <div className="text-tertiary">{tw("wizard.machine.during_hint")}</div>
          <ul className="mt-1 list-disc pl-4 space-y-0.5">
            {step.hints.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ul>
        </div>
      </div>
    );

  // A machine prompt outranks everything else on the step: while one is
  // showing, Confirm IS the step's single commit rectangle.
  const hasPromptCommit = m.prompt !== null && !!env?.confirmEntityId;

  const promptCard = m.prompt !== null && (
    <div className="mt-3 py-2 space-y-2 t-label" style={ERROR_RULES}>
      <div>{fmt(tw("wizard.machine.prompt"), { prompt: m.prompt })}</div>
      {env?.confirmEntityId ? (
        <ActionBand
          rule={false}
          inset="none"
          commit={
            <Commit
              label={tw("wizard.machine.confirm")}
              scale="panel"
              busy={m.confirmBusy}
              onCommit={() => void phase.confirmPrompt()}
            />
          }
        />
      ) : (
        <div>{tw("wizard.machine.confirm_manual")}</div>
      )}
      {m.confirmError && <div>{m.confirmError}</div>}
    </div>
  );

  const stepTitle = (step: WizardStep) => {
    if (step.kind === "manual") return step.title;
    return step.pourCount > 1
      ? fmt(tw("wizard.step.machine_n"), { n: step.pourN, m: step.pourCount })
      : tw("wizard.step.machine");
  };

  const machineCard = (step: MachineWizardStep) => {
    if (m.state === "idle") {
      return (
        <>
          {componentStrip(step)}
          {hints(step)}
          <ActionBand
            rule={false}
            inset="none"
            commit={
              <Commit
                label={
                  step.legacyFull
                    ? tw("wizard.machine.start_full")
                    : tw("wizard.machine.start")
                }
                scale="panel"
                icon={<Coffee size={18} />}
                onCommit={() =>
                  void phase.startPhase(step, recipe as BrewPlanRecipe, target)
                }
              />
            }
          />
        </>
      );
    }
    if (m.state === "error") {
      return (
        <>
          <div role="alert" className="mt-2 py-2 t-label" style={ERROR_RULES}>
            {tw("wizard.machine.failed")}: {m.error}
          </div>
          {/* C10: one arrangement — the word first at its own width, the
              commit taking the rest of the row. Not a word right-aligned on
              its own line ABOVE a full-width commit, which is what this was. */}
          <ActionBand
            rule={false}
            inset="none"
            secondary={<Word label={tw("wizard.machine.skip")} onClick={advance} />}
            commit={
              <Commit
                label={tw("wizard.machine.retry")}
                scale="panel"
                onCommit={() =>
                  void phase.startPhase(step, recipe as BrewPlanRecipe, target)
                }
              />
            }
          />
        </>
      );
    }
    // brewing (and the momentary "done" before auto-advance)
    return (
      <>
        {/*
          C18, settled: a PROGRESS meter carries no numeric readout — not on
          the track and not in a label row beside it. This wait's end is only
          ever estimated (that is precisely why it is a linear meter and not
          the §9.1 ring), so a percentage derived from the estimate is false
          precision, and every other progress meter in the app already omits
          it. The estimate itself stays, because it is the honest figure. A
          VALUE meter still prints its number: the user chose that one.
        */}
        <div className="mt-2 space-y-1.5">
          <div className="t-label text-tertiary">
            {fmt(tw("wizard.machine.estimated"), { sec: m.estimated })}
          </div>
          <Meter
            value={m.progress}
            max={100}
            segments={12}
            role="progressbar"
            ariaLabel={stepTitle(step)}
          />
        </div>
        {hints(step)}
        {promptCard}
        {m.manualFinish ? (
          <ActionBand
            rule={false}
            inset="none"
            // While a machine prompt is showing, Confirm IS the step's commit,
            // so "I'm done" steps back to being a word.
            secondary={
              hasPromptCommit ? (
                <Word
                  label={tw("wizard.machine.im_done")}
                  onClick={phase.finishManually}
                />
              ) : undefined
            }
            commit={
              hasPromptCommit ? undefined : (
                <Commit
                  label={tw("wizard.machine.im_done")}
                  scale="panel"
                  onCommit={phase.finishManually}
                />
              )
            }
          />
        ) : (
          // §9.3: busy with no measure breathes on the subject glyph. No
          // spinner anywhere in the app any more.
          <div className="mt-3">
            <span className="flex items-center justify-end gap-2 t-label text-tertiary">
              <Coffee size={16} className="status-icon-pulse" />
              {tw("wizard.machine.waiting")}
            </span>
          </div>
        )}
      </>
    );
  };

  const renderStep = (step: WizardStep, i: number) => {
    const state = i < stepIndex ? "done" : i === stepIndex ? "active" : "future";
    return (
      <li
        key={i}
        className="flex gap-3 py-3"
        style={{
          borderTopWidth: "1px",
          borderTopStyle: "solid",
          borderTopColor: "var(--border)",
          borderRadius: 0,
        }}
      >
        {/* A bare ordinal — no disc, no ring, no fill (§9.1 step markers). */}
        <span
          className="shrink-0 w-6 flex items-center justify-center t-label num mt-0.5"
          style={{
            color:
              state === "active" ? "var(--text-primary)" : "var(--text-tertiary)",
          }}
        >
          {state === "done" ? (
            <Check size={16} style={{ color: "var(--success)" }} />
          ) : (
            i + 1
          )}
        </span>
        <div className="flex-1 min-w-0">
          <div
            className="t-label"
            style={{
              color:
                state === "active"
                  ? "var(--text-primary)"
                  : "var(--text-tertiary)",
              fontWeight: state === "active" ? 600 : 400,
            }}
          >
            {stepTitle(step)}
          </div>
          {state === "active" && (
            <div className="mt-1">
              {step.kind === "manual" ? (
                <>
                  {step.notes && (
                    <div className="t-label text-tertiary">{step.notes}</div>
                  )}
                  <ActionBand
                    rule={false}
                    inset="none"
                    commit={
                      <Commit
                        label={tw("wizard.step.done")}
                        scale="panel"
                        onCommit={advance}
                      />
                    }
                  />
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
    <div>
      <h3 className="t-title text-primary">{tw("wizard.finish.title")}</h3>
      {recipe.extras?.instruction && (
        <p className="mt-2 t-body text-secondary italic">{recipe.extras.instruction}</p>
      )}
      <p className="mt-2 t-label text-tertiary">{tw("wizard.finish.message")}</p>
      <ActionBand
        rule={false}
        inset="none"
        commit={
          <Commit
            label={tw("wizard.finish.button")}
            scale="panel"
            onCommit={() => {
              clearWizardPosition(recipe.id);
              close();
            }}
          />
        }
      />
    </div>
  );

  const confirmCloseView = (
    <div
      className="absolute inset-0 flex items-center justify-center p-6"
      /** §5.A: the confirm step removes the panel beneath it; it adds no box. */
      data-fill="scrim"
      style={{ backgroundColor: "var(--overlay-bg)" }}
    >
      <div className="w-full max-w-xs">
        <h3 className="t-title text-primary">{tw("wizard.close.title")}</h3>
        <p className="mt-2 t-body text-secondary">{tw("wizard.close.message")}</p>
        <ActionBand
          rule={false}
          inset="none"
          secondary={
            <Word
              label={tw("wizard.close.stay")}
              onClick={() => setConfirmClose(false)}
            />
          }
          commit={
            <Commit
              label={tw("wizard.close.leave")}
              scale="panel"
              onCommit={() => {
                saveWizardPosition(recipe.id, stepIndex);
                close();
              }}
            />
          }
        />
      </div>
    </div>
  );

  const total = steps.length;
  const current = Math.min(stepIndex + 1, Math.max(total, 1));

  return (
    <Panel
      title={recipe.name || tw("wizard.title")}
      onClose={requestClose}
      closeLabel={tw("wizard.close.title")}
      /** §5.B measure: a linear checklist is a short list, not an editor. */
      measure="sm"
      bodyClassName="p-5"
      headerExtra={
        total > 0 && !finished ? (
          <span className="t-label num text-tertiary">
            {fmt(tw("wizard.step_of"), { n: current, m: total })}
          </span>
        ) : null
      }
    >
      {resumed && !finished && (
        <div className="mb-4">
          <Rule />
          <div className="flex items-center justify-between gap-3 py-2 t-label text-secondary">
            <span>{tw("wizard.resumed")}</span>
            <Word label={tw("wizard.restart")} onClick={restart} />
          </div>
          <Rule />
        </div>
      )}
      {finished || total === 0 ? finishView : <ol>{steps.map(renderStep)}</ol>}
      {/*
        The leave-confirmation covers the whole panel rather than stacking a
        second filled card on it. It is `absolute inset-0` against the panel —
        the body it sits in is `position: static`, so the body's own scrolling
        neither moves nor clips it.
      */}
      {confirmClose && confirmCloseView}
    </Panel>
  );
}
