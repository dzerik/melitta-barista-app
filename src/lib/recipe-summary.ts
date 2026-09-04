// How a sommelier recipe reads to a person.
//
// The model writes a name, a description, a justification and an ordered set
// of instructions; the machine part is a list of pours. This module turns
// those into sentences a user can act on, instead of the token dump the card
// used to print ("coffee / medium / standard / normal / two / 40ml").
//
// Pure: no React, no HA imports.

import { displayNameFor, type Locale } from "./i18n";
import {
  buildBrewPlan,
  recipeMachinePhases,
  type BrewPlanRecipe,
  type PhaseComponent,
} from "./brew-plan";

/** One pour, described in words: "Coffee · 40 ml · Strong · 2 shots". */
export function pourSummary(
  locale: Locale,
  component: PhaseComponent | null | undefined,
): string | null {
  if (!component) return null;
  const process = typeof component.process === "string" ? component.process : "";
  if (!process || process === "none") return null;

  const parts: string[] = [displayNameFor(locale, "process", process)];
  const ml = Number(component.portion_ml);
  if (Number.isFinite(ml) && ml > 0) parts.push(`${ml} ml`);
  if (process === "coffee") {
    if (typeof component.intensity === "string" && component.intensity) {
      parts.push(displayNameFor(locale, "intensity", component.intensity));
    }
    const shots = component.shots;
    if (typeof shots === "string" && shots !== "none") {
      parts.push(displayNameFor(locale, "shots", shots));
    }
  }
  // Temperature is optional in the wire type; mention it only when it
  // departs from the default, so the line stays about what differs.
  const temperature = (component as { temperature?: unknown }).temperature;
  if (typeof temperature === "string" && temperature && temperature !== "normal") {
    parts.push(displayNameFor(locale, "temperature", temperature));
  }
  return parts.join(" · ");
}

/** Every pour of a recipe, in dispensing order. */
export function pourSummaries(locale: Locale, recipe: BrewPlanRecipe): string[] {
  const phases = recipeMachinePhases(recipe);
  const components: (PhaseComponent | null | undefined)[] = phases.length
    ? phases.map((p) => p.component)
    : [recipe.component1, recipe.component2];
  return components
    .map((c) => pourSummary(locale, c))
    .filter((s): s is string => s !== null);
}

/**
 * The hopper a recipe grinds from, in the LLM's own encoding
 * (1 = hopper 1, 0 = hopper 2 — never a percentage, which is how this used
 * to be rendered).
 */
export function hopperNumber(recipe: { blend?: unknown }): 1 | 2 | null {
  if (recipe.blend === 1) return 1;
  if (recipe.blend === 0) return 2;
  return null;
}

/**
 * The recipe's instructions as written, in order, with each machine pour
 * named by what it dispenses — the same plan the wizard walks, flattened
 * for reading. Sentences the model wrote for "while it brews" follow the
 * pour they belong to.
 */
export function readableSteps(locale: Locale, recipe: BrewPlanRecipe): string[] {
  const lines: string[] = [];
  for (const step of buildBrewPlan(locale, recipe)) {
    if (step.kind === "manual") {
      lines.push(step.notes ? `${step.title} — ${step.notes}` : step.title);
      continue;
    }
    const pour = pourSummary(locale, step.component);
    const label = step.pourCount > 1
      ? `${step.pourN}/${step.pourCount}${pour ? ` — ${pour}` : ""}`
      : pour ?? "";
    lines.push(label.trim() || String(step.pourN));
    lines.push(...step.hints);
  }
  return lines;
}
