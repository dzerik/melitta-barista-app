import { useState, useEffect } from "react";
import type { HassEntities } from "home-assistant-js-websocket";
import { getEntity, getOptions, type RecipeDetails, type DirectKeyData, type DirectKeyRecipe, DIRECTKEY_DISPLAY_TO_KEY } from "../lib/entities";

const STORAGE_KEY = "melitta_recipes";

export interface RecipeCache {
  profileOptions: string[];
  recipeOptions: string[];
  allRecipes: Record<string, RecipeDetails>;
  directKey: DirectKeyData | null;
}

const EMPTY: RecipeCache = { profileOptions: [], recipeOptions: [], allRecipes: {}, directKey: null };

function loadCache(): RecipeCache {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as RecipeCache;
    if (parsed.recipeOptions?.length > 0) return parsed;
    return EMPTY;
  } catch {
    return EMPTY;
  }
}

function saveCache(data: RecipeCache): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function buildFromEntities(entities: HassEntities, prefix: string): RecipeCache | null {
  const recipeOpts = getOptions(entities, prefix, "recipe");
  if (recipeOpts.length === 0) return null;

  const recipeEntity = getEntity(entities, prefix, "select", "recipe");
  let recipes = (recipeEntity?.attributes?.recipes || {}) as Record<string, RecipeDetails>;

  // Fallback: if integration doesn't expose "recipes" dict, build from flat attributes
  if (Object.keys(recipes).length === 0 && recipeEntity?.attributes?.c1_process) {
    const selected = recipeEntity.state;
    if (selected) {
      const a = recipeEntity.attributes;
      recipes = {
        [selected]: {
          c1_process: a.c1_process, c1_intensity: a.c1_intensity, c1_aroma: a.c1_aroma,
          c1_temperature: a.c1_temperature, c1_shots: a.c1_shots, c1_portion_ml: a.c1_portion_ml,
          c2_process: a.c2_process, c2_intensity: a.c2_intensity, c2_aroma: a.c2_aroma,
          c2_temperature: a.c2_temperature, c2_shots: a.c2_shots, c2_portion_ml: a.c2_portion_ml,
        } as RecipeDetails,
      };
    }
  }
  const profileOpts = getOptions(entities, prefix, "profile");

  // Read DirectKey data from profile select entity attributes
  const profileEntity = getEntity(entities, prefix, "select", "profile");
  let directKey: DirectKeyData | null = null;
  if (profileEntity?.attributes) {
    const rawDk = profileEntity.attributes.directkey_recipes as
      Record<number, Record<string, DirectKeyRecipe>> | undefined;
    const activeProfile = (profileEntity.attributes.active_profile as number) ?? 0;
    if (rawDk) {
      const profiles: DirectKeyData["profiles"] = {};
      for (const [pidStr, categories] of Object.entries(rawDk)) {
        const pid = Number(pidStr);
        profiles[pid] = {};
        for (const [displayName, recipe] of Object.entries(categories)) {
          const key = DIRECTKEY_DISPLAY_TO_KEY[displayName] || displayName;
          profiles[pid][key] = recipe;
        }
      }
      directKey = { activeProfile, profiles };
    }
  }

  return { profileOptions: profileOpts, recipeOptions: recipeOpts, allRecipes: recipes, directKey };
}

/**
 * Caches recipe metadata in localStorage for instant startup.
 * Uses useState so profile/DirectKey changes trigger re-renders immediately.
 */
export function useRecipeCache(entities: HassEntities, prefix: string | null): RecipeCache {
  const [cache, setCache] = useState<RecipeCache>(loadCache);

  useEffect(() => {
    if (!prefix) return;

    const fresh = buildFromEntities(entities, prefix);
    if (!fresh) return;

    setCache(fresh);
    saveCache(fresh);
  }, [entities, prefix]);

  return cache;
}
