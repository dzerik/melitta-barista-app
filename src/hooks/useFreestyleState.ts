import { useState, useEffect, useRef } from "react";
import type { HassEntities } from "home-assistant-js-websocket";
import { getState, getOptions, type RecipeDetails } from "../lib/entities";

const STORAGE_KEY = "melitta_freestyle";

export interface FreestyleState {
  name: string;
  process1: string;
  intensity1: string;
  temperature1: string;
  shots1: string;
  portion1: number;
  process2: string;
  intensity2: string;
  temperature2: string;
  shots2: string;
  portion2: number;
}

export interface FreestyleOptions {
  processOpts1: string[];
  intensityOpts1: string[];
  tempOpts1: string[];
  shotsOpts1: string[];
  processOpts2: string[];
  intensityOpts2: string[];
  tempOpts2: string[];
  shotsOpts2: string[];
}

const DEFAULTS: FreestyleState = {
  name: "Custom",
  process1: "coffee",
  intensity1: "medium",
  temperature1: "normal",
  shots1: "one",
  portion1: 40,
  process2: "none",
  intensity2: "medium",
  temperature2: "normal",
  shots2: "one",
  portion2: 0,
};

const SHOTS_MAP: Record<number, string> = { 0: "none", 1: "one", 2: "two", 3: "three" };

function shotsToString(n: number): string {
  return SHOTS_MAP[n] ?? "one";
}

function loadFromStorage(): FreestyleState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as FreestyleState;
  } catch {
    return null;
  }
}

function saveToStorage(state: FreestyleState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/** Read current freestyle values from HA entities. */
function readFromBackend(entities: HassEntities, prefix: string): FreestyleState {
  return {
    name: getState(entities, prefix, "text", "freestyle_name") || DEFAULTS.name,
    process1: getState(entities, prefix, "select", "freestyle_process_1") || DEFAULTS.process1,
    intensity1: getState(entities, prefix, "select", "freestyle_intensity_1") || DEFAULTS.intensity1,
    temperature1: getState(entities, prefix, "select", "freestyle_temperature_1") || DEFAULTS.temperature1,
    shots1: getState(entities, prefix, "select", "freestyle_shots_1") || DEFAULTS.shots1,
    portion1: parseInt(getState(entities, prefix, "number", "freestyle_portion_1") || String(DEFAULTS.portion1)),
    process2: getState(entities, prefix, "select", "freestyle_process_2") || DEFAULTS.process2,
    intensity2: getState(entities, prefix, "select", "freestyle_intensity_2") || DEFAULTS.intensity2,
    temperature2: getState(entities, prefix, "select", "freestyle_temperature_2") || DEFAULTS.temperature2,
    shots2: getState(entities, prefix, "select", "freestyle_shots_2") || DEFAULTS.shots2,
    portion2: parseInt(getState(entities, prefix, "number", "freestyle_portion_2") || String(DEFAULTS.portion2)),
  };
}

function readOptions(entities: HassEntities, prefix: string): FreestyleOptions {
  return {
    processOpts1: getOptions(entities, prefix, "freestyle_process_1"),
    intensityOpts1: getOptions(entities, prefix, "freestyle_intensity_1"),
    tempOpts1: getOptions(entities, prefix, "freestyle_temperature_1"),
    shotsOpts1: getOptions(entities, prefix, "freestyle_shots_1"),
    processOpts2: getOptions(entities, prefix, "freestyle_process_2"),
    intensityOpts2: getOptions(entities, prefix, "freestyle_intensity_2"),
    tempOpts2: getOptions(entities, prefix, "freestyle_temperature_2"),
    shotsOpts2: getOptions(entities, prefix, "freestyle_shots_2"),
  };
}

/**
 * Manages freestyle recipe state locally.
 *
 * - On first mount: loads from localStorage, falls back to backend entities.
 * - All changes are instant (local state + localStorage).
 * - No API calls until brew.
 * - Backend entities are still used for options lists and as initial seed.
 */
export function useFreestyleState(entities: HassEntities, prefix: string) {
  const initializedRef = useRef(false);

  const [state, setState] = useState<FreestyleState>(() => {
    return loadFromStorage() || readFromBackend(entities, prefix);
  });

  // Seed from backend on first entity update if no localStorage data
  useEffect(() => {
    if (initializedRef.current) return;
    const stored = loadFromStorage();
    if (!stored) {
      const backend = readFromBackend(entities, prefix);
      setState(backend);
      saveToStorage(backend);
    }
    initializedRef.current = true;
  }, [entities, prefix]);

  const update = <K extends keyof FreestyleState>(key: K, value: FreestyleState[K]) => {
    setState((prev) => {
      const next = { ...prev, [key]: value };
      saveToStorage(next);
      return next;
    });
  };

  /** Reset local state to match current backend values. */
  const syncFromBackend = () => {
    const backend = readFromBackend(entities, prefix);
    setState(backend);
    saveToStorage(backend);
  };

  /** Load a recipe as freestyle base — maps RecipeDetails → FreestyleState. */
  const loadFromRecipe = (name: string, recipe: RecipeDetails) => {
    const next: FreestyleState = {
      name,
      process1: recipe.c1_process || DEFAULTS.process1,
      intensity1: recipe.c1_intensity || DEFAULTS.intensity1,
      temperature1: recipe.c1_temperature || DEFAULTS.temperature1,
      shots1: shotsToString(recipe.c1_shots),
      portion1: recipe.c1_portion_ml || DEFAULTS.portion1,
      process2: recipe.c2_process || DEFAULTS.process2,
      intensity2: recipe.c2_intensity || DEFAULTS.intensity2,
      temperature2: recipe.c2_temperature || DEFAULTS.temperature2,
      shots2: shotsToString(recipe.c2_shots),
      portion2: recipe.c2_portion_ml ?? DEFAULTS.portion2,
    };
    setState(next);
    saveToStorage(next);
  };

  const options = readOptions(entities, prefix);

  return { state, update, options, syncFromBackend, loadFromRecipe };
}
