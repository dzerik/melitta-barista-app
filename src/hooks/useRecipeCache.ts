import { useEffect, useRef } from "react";
import type { HassEntities } from "home-assistant-js-websocket";
import { getEntity, getOptions, type RecipeDetails } from "../lib/entities";

const STORAGE_KEY = "melitta_recipes";

export interface RecipeCache {
  profileOptions: string[];
  recipeOptions: string[];
  allRecipes: Record<string, RecipeDetails>;
}

function loadCache(): RecipeCache | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RecipeCache;
    if (parsed.recipeOptions?.length > 0) return parsed;
    return null;
  } catch {
    return null;
  }
}

function saveCache(data: RecipeCache): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/**
 * Caches recipe metadata (options lists + details) in localStorage.
 *
 * Recipe data is hardcoded in the HA integration config and never changes
 * at runtime, so we cache it on first successful load and serve from cache
 * on subsequent app starts — instant recipe grid without waiting for WebSocket.
 */
export function useRecipeCache(entities: HassEntities, prefix: string | null): RecipeCache {
  const cachedRef = useRef<RecipeCache | null>(loadCache());

  useEffect(() => {
    if (!prefix) return;

    const recipeOpts = getOptions(entities, prefix, "recipe");
    if (recipeOpts.length === 0) return;

    const recipeEntity = getEntity(entities, prefix, "select", "recipe");
    const recipes = (recipeEntity?.attributes?.recipes || {}) as Record<string, RecipeDetails>;
    const profileOpts = getOptions(entities, prefix, "profile");

    const fresh: RecipeCache = {
      profileOptions: profileOpts,
      recipeOptions: recipeOpts,
      allRecipes: recipes,
    };

    cachedRef.current = fresh;
    saveCache(fresh);
  }, [entities, prefix]);

  if (cachedRef.current) return cachedRef.current;

  return { profileOptions: [], recipeOptions: [], allRecipes: {} };
}
