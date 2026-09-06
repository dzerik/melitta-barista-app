import { useState, useCallback, useEffect, useRef } from "react";
import type { Connection } from "home-assistant-js-websocket";
import { getVocab, syncVocab, type ServerVocab } from "../lib/server-strings";
import type { IconSpec } from "../lib/contract";

// ── Types ────────────────────────────────────────────────────────────

export interface CoffeeBean {
  id: string;
  brand: string;
  product: string;
  roast: string;
  bean_type: string;
  origin: string;
  origin_country?: string | null;
  flavor_notes: string[];
  composition?: string | null;
  preset_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CoffeeBeanInput {
  brand: string;
  product: string;
  roast: string;
  bean_type: string;
  origin: string;
  origin_country?: string;
  flavor_notes?: string[];
  composition?: string;
  preset_id?: string;
}

export interface Hopper {
  assigned_at: string;
  bean: CoffeeBean | null;
}

export interface Hoppers {
  hopper1: Hopper | null;
  hopper2: Hopper | null;
}

export interface RecipeComponent {
  process: string;
  intensity: string;
  aroma: string;
  temperature: string;
  shots: string;
  portion_ml: number;
}

export interface RecipeExtras {
  ice?: boolean;
  syrup?: string | null;
  topping?: string | null;
  liqueur?: string | null;
  instruction?: string | null;
}

export interface AiRecipe {
  id: string;
  name: string;
  description: string;
  /** Served drink icon (§3.9) — the same spec the recipe catalog carries. */
  icon?: IconSpec | null;
  /** Why the sommelier suggested this drink (served since 0.91). */
  reasoning?: string;
  blend: number;
  component1: RecipeComponent;
  component2: RecipeComponent;
  brewed: boolean;
  extras?: RecipeExtras | null;
  cup_type?: string;
  estimated_caffeine?: string;
  calories_approx?: number | null;
}

export interface UserExtras {
  syrups: string[];
  toppings: string[];
  liqueurs: string[];
}

export interface UserPreferences {
  [key: string]: string;
}

export interface SommelierProfile {
  id: string;
  name: string;
  cup_size: string;
  temperature_pref: string;
  dietary: string[];
  caffeine_pref: string;
  is_active: boolean;
  machine_profile: number | null;
  created_at: string;
  updated_at: string;
}

export interface ProfileInput {
  name: string;
  cup_size?: string;
  temperature_pref?: string;
  dietary?: string[];
  caffeine_pref?: string;
  machine_profile?: number;
}

export interface GenerationSession {
  id: string;
  mode: string;
  preference: string | null;
  created_at: string;
  recipes: AiRecipe[];
}

export interface Favorite {
  id: string;
  name: string;
  description: string;
  /** Served drink icon (§3.9). */
  icon?: IconSpec | null;
  /** Kept with the favourite since integration 0.94 (schema v12). */
  reasoning?: string;
  blend: number;
  component1: RecipeComponent;
  component2: RecipeComponent;
  source_recipe_id?: string | null;
  source_bean_id?: string | null;
  brew_count: number;
  created_at: string;
  last_brewed_at?: string | null;
}

export interface CoffeePreset {
  id: string;
  brand: string;
  product: string;
  roast: string;
  bean_type: string;
  origin: string;
  flavor_notes: string[];
}

export interface SommelierSettings {
  [key: string]: string;
}

// ── WS helper ────────────────────────────────────────────────────────

async function wsCommand<T>(conn: Connection, type: string, data?: object): Promise<T> {
  return conn.sendMessagePromise<T>({ type, ...(data as Record<string, unknown>) });
}

// ── Hook ─────────────────────────────────────────────────────────────

/**
 * Sommelier data + actions over the `melitta_barista/sommelier/*` WS surface.
 *
 * Also owns the §9.2 vocabulary fetch: one `vocab/get` per session through
 * `syncVocab` (cache axis `strings_version`, revalidated for free when the
 * caller passes the contract document's `contractStringsVersion` — Zone P-I
 * wiring; omitted, one fetch runs). The resolved vocabulary lands in the
 * shared registry (`src/lib/server-strings.ts`) that the picker resolvers in
 * `src/lib/sommelier-vocab.ts` read; the returned `vocab` value exists to
 * re-render consumers when it arrives. Any failure degrades to `null` and the
 * pickers fall back to their hardcoded lists (§9.2.6.1).
 */
export function useSommelier(conn: Connection | null, contractStringsVersion?: string | null) {
  const [hoppers, setHoppers] = useState<Hoppers>({ hopper1: null, hopper2: null });
  const [milkTypes, setMilkTypes] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [history, setHistory] = useState<GenerationSession[]>([]);
  const [extras, setExtrasState] = useState<UserExtras>({ syrups: [], toppings: [], liqueurs: [] });
  const [currentSession, setCurrentSession] = useState<GenerationSession | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vocab, setVocabState] = useState<ServerVocab | null>(() => getVocab());
  const initRef = useRef(false);
  const vocabInitRef = useRef(false);

  // ── Vocabulary (§9.2) — once per session, feeds the shared registry ─

  useEffect(() => {
    if (conn && !vocabInitRef.current) {
      vocabInitRef.current = true;
      syncVocab(conn, contractStringsVersion).then(setVocabState);
    }
  }, [conn, contractStringsVersion]);

  // ── Load initial data ──────────────────────────────────────────

  const refresh = useCallback(async () => {
    if (!conn) return;
    try {
      const [hoppersRes, milkRes, favsRes, histRes, extrasRes] = await Promise.all([
        wsCommand<Hoppers>(conn, "melitta_barista/sommelier/hoppers/get"),
        wsCommand<{ milk_types: string[] }>(conn, "melitta_barista/sommelier/milk/get"),
        wsCommand<{ favorites: Favorite[] }>(conn, "melitta_barista/sommelier/favorites/list"),
        wsCommand<{ sessions: GenerationSession[] }>(conn, "melitta_barista/sommelier/history/list", { limit: 20 }),
        wsCommand<{ extras: UserExtras }>(conn, "melitta_barista/sommelier/extras/get"),
      ]);
      // Every response is treated as possibly absent: a backend that answers
      // some commands and not others (demo transport, partial rollout) must
      // leave the state at its safe defaults instead of poisoning it with
      // `undefined` — the sommelier views read these fields unguarded.
      if (hoppersRes?.hopper1 !== undefined || hoppersRes?.hopper2 !== undefined) {
        setHoppers(hoppersRes);
      }
      if (Array.isArray(milkRes?.milk_types)) setMilkTypes(milkRes.milk_types);
      if (Array.isArray(favsRes?.favorites)) setFavorites(favsRes.favorites);
      if (Array.isArray(histRes?.sessions)) setHistory(histRes.sessions);
      const ex = extrasRes?.extras ?? {} as Partial<UserExtras>;
      setExtrasState({
        syrups: ex.syrups ?? [],
        toppings: ex.toppings ?? [],
        liqueurs: ex.liqueurs ?? [],
      });
      setError(null);
    } catch (e) {
      console.warn("[sommelier] Failed to load data:", e);
      setError(e instanceof Error ? e.message : "Failed to load sommelier data");
    } finally {
      setLoading(false);
    }
  }, [conn]);

  useEffect(() => {
    if (conn && !initRef.current) {
      initRef.current = true;
      refresh();
    }
  }, [conn, refresh]);

  // ── Beans CRUD ─────────────────────────────────────────────────

  // ── Hoppers ────────────────────────────────────────────────────

  // ── Milk ───────────────────────────────────────────────────────

  // ── Generate ───────────────────────────────────────────────────

  const generate = useCallback(async (
    mode: string = "surprise_me",
    preference?: string,
    count: number = 3,
    opts?: { mood?: string; occasion?: string; temperature?: string; servings?: number },
  ) => {
    if (!conn) return null;
    setGenerating(true);
    setError(null);
    try {
      const res = await wsCommand<{ session: GenerationSession }>(
        conn, "melitta_barista/sommelier/generate",
        { mode, preference, count, ...opts },
      );
      setCurrentSession(res.session);
      setHistory((prev) => [res.session, ...prev]);
      return res.session;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Generation failed";
      setError(msg);
      return null;
    } finally {
      setGenerating(false);
    }
  }, [conn]);

  // ── Brew ───────────────────────────────────────────────────────

  const brewRecipe = useCallback(async (recipeId: string) => {
    if (!conn) return;
    await wsCommand(conn, "melitta_barista/sommelier/brew", { recipe_id: recipeId });
    // Mark as brewed in local state
    setCurrentSession((s) => s ? {
      ...s,
      recipes: s.recipes.map((r) => r.id === recipeId ? { ...r, brewed: true } : r),
    } : null);
  }, [conn]);

  const brewFavorite = useCallback(async (favoriteId: string) => {
    if (!conn) return;
    await wsCommand(conn, "melitta_barista/sommelier/favorites/brew", { favorite_id: favoriteId });
    setFavorites((prev) => prev.map((f) =>
      f.id === favoriteId ? { ...f, brew_count: f.brew_count + 1, last_brewed_at: new Date().toISOString() } : f
    ));
  }, [conn]);

  // ── Favorites ──────────────────────────────────────────────────

  const addFavorite = useCallback(async (recipeId: string) => {
    if (!conn) return;
    const res = await wsCommand<{ favorite: Favorite }>(conn, "melitta_barista/sommelier/favorites/add", { recipe_id: recipeId });
    setFavorites((prev) => [res.favorite, ...prev]);
  }, [conn]);

  const removeFavorite = useCallback(async (favoriteId: string) => {
    if (!conn) return;
    await wsCommand(conn, "melitta_barista/sommelier/favorites/remove", { favorite_id: favoriteId });
    setFavorites((prev) => prev.filter((f) => f.id !== favoriteId));
  }, [conn]);

  // ── Settings ───────────────────────────────────────────────────

  // ── History ────────────────────────────────────────────────────

  const loadMoreHistory = useCallback(async () => {
    if (!conn) return;
    const res = await wsCommand<{ sessions: GenerationSession[] }>(
      conn, "melitta_barista/sommelier/history/list",
      { limit: 20, offset: history.length },
    );
    setHistory((prev) => [...prev, ...res.sessions]);
  }, [conn, history.length]);

  // ── Extras ─────────────────────────────────────────────────────

  // ── Preferences ───────────────────────────────────────────────

  // ── Profiles ──────────────────────────────────────────────────

  return {
    // Data
    hoppers, milkTypes, favorites, history, extras, vocab,
    currentSession, generating, loading, error,
    // Actions
    generate, brewRecipe, brewFavorite,
    addFavorite, removeFavorite,
    loadMoreHistory, refresh,
  };
}
