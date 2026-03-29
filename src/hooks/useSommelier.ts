import { useState, useCallback, useEffect, useRef } from "react";
import type { Connection } from "home-assistant-js-websocket";

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

export function useSommelier(conn: Connection | null) {
  const [beans, setBeans] = useState<CoffeeBean[]>([]);
  const [hoppers, setHoppers] = useState<Hoppers>({ hopper1: null, hopper2: null });
  const [milkTypes, setMilkTypes] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [history, setHistory] = useState<GenerationSession[]>([]);
  const [presets, setPresets] = useState<CoffeePreset[]>([]);
  const [settings, setSettings] = useState<SommelierSettings>({});
  const [extras, setExtrasState] = useState<UserExtras>({ syrups: [], toppings: [], liqueurs: [] });
  const [preferences, setPreferencesState] = useState<UserPreferences>({});
  const [profiles, setProfiles] = useState<SommelierProfile[]>([]);
  const [currentSession, setCurrentSession] = useState<GenerationSession | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const initRef = useRef(false);

  // ── Load initial data ──────────────────────────────────────────

  const refresh = useCallback(async () => {
    if (!conn) return;
    try {
      const [beansRes, hoppersRes, milkRes, favsRes, histRes, presetsRes, settingsRes, extrasRes, prefsRes, profilesRes] = await Promise.all([
        wsCommand<{ beans: CoffeeBean[] }>(conn, "melitta_barista/sommelier/beans/list"),
        wsCommand<Hoppers>(conn, "melitta_barista/sommelier/hoppers/get"),
        wsCommand<{ milk_types: string[] }>(conn, "melitta_barista/sommelier/milk/get"),
        wsCommand<{ favorites: Favorite[] }>(conn, "melitta_barista/sommelier/favorites/list"),
        wsCommand<{ sessions: GenerationSession[] }>(conn, "melitta_barista/sommelier/history/list", { limit: 20 }),
        wsCommand<{ presets: CoffeePreset[] }>(conn, "melitta_barista/sommelier/presets/list"),
        wsCommand<{ settings: SommelierSettings }>(conn, "melitta_barista/sommelier/settings/get"),
        wsCommand<{ extras: UserExtras }>(conn, "melitta_barista/sommelier/extras/get"),
        wsCommand<{ preferences: UserPreferences }>(conn, "melitta_barista/sommelier/preferences/get"),
        wsCommand<{ profiles: SommelierProfile[] }>(conn, "melitta_barista/sommelier/profiles/list"),
      ]);
      setBeans(beansRes.beans);
      setHoppers(hoppersRes);
      setMilkTypes(milkRes.milk_types);
      setFavorites(favsRes.favorites);
      setHistory(histRes.sessions);
      setPresets(presetsRes.presets);
      setSettings(settingsRes.settings);
      setExtrasState(extrasRes.extras);
      setPreferencesState(prefsRes.preferences);
      setProfiles(profilesRes.profiles);
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

  const addBean = useCallback(async (data: CoffeeBeanInput) => {
    if (!conn) return null;
    const res = await wsCommand<{ bean: CoffeeBean }>(conn, "melitta_barista/sommelier/beans/add", data);
    setBeans((prev) => [res.bean, ...prev]);
    return res.bean;
  }, [conn]);

  const updateBean = useCallback(async (beanId: string, data: Partial<CoffeeBeanInput>) => {
    if (!conn) return;
    const res = await wsCommand<{ bean: CoffeeBean }>(conn, "melitta_barista/sommelier/beans/update", { bean_id: beanId, ...data });
    setBeans((prev) => prev.map((b) => (b.id === beanId ? res.bean : b)));
  }, [conn]);

  const deleteBean = useCallback(async (beanId: string) => {
    if (!conn) return;
    await wsCommand(conn, "melitta_barista/sommelier/beans/delete", { bean_id: beanId });
    setBeans((prev) => prev.filter((b) => b.id !== beanId));
    // Also clear hopper if this bean was assigned
    setHoppers((h) => ({
      hopper1: h.hopper1?.bean?.id === beanId ? { ...h.hopper1, bean: null } : h.hopper1,
      hopper2: h.hopper2?.bean?.id === beanId ? { ...h.hopper2, bean: null } : h.hopper2,
    }));
  }, [conn]);

  // ── Hoppers ────────────────────────────────────────────────────

  const assignHopper = useCallback(async (hopperId: 1 | 2, beanId: string | null) => {
    if (!conn) return;
    await wsCommand(conn, "melitta_barista/sommelier/hoppers/assign", { hopper_id: hopperId, bean_id: beanId });
    const bean = beanId ? beans.find((b) => b.id === beanId) ?? null : null;
    setHoppers((h) => ({
      ...h,
      [`hopper${hopperId}`]: { assigned_at: new Date().toISOString(), bean },
    }));
  }, [conn, beans]);

  // ── Milk ───────────────────────────────────────────────────────

  const setMilk = useCallback(async (types: string[]) => {
    if (!conn) return;
    await wsCommand(conn, "melitta_barista/sommelier/milk/set", { milk_types: types });
    setMilkTypes(types);
  }, [conn]);

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

  const setSetting = useCallback(async (key: string, value: string) => {
    if (!conn) return;
    await wsCommand(conn, "melitta_barista/sommelier/settings/set", { key, value });
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, [conn]);

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

  const setExtras = useCallback(async (category: string, items: string[]) => {
    if (!conn) return;
    await wsCommand(conn, "melitta_barista/sommelier/extras/set", { category, items });
    setExtrasState((prev) => ({ ...prev, [category]: items }));
  }, [conn]);

  // ── Preferences ───────────────────────────────────────────────

  const getPreferences = useCallback(async () => {
    if (!conn) return {};
    const res = await wsCommand<{ preferences: UserPreferences }>(conn, "melitta_barista/sommelier/preferences/get");
    setPreferencesState(res.preferences);
    return res.preferences;
  }, [conn]);

  const setPreference = useCallback(async (key: string, value: string) => {
    if (!conn) return;
    await wsCommand(conn, "melitta_barista/sommelier/preferences/set", { key, value });
    setPreferencesState((prev) => ({ ...prev, [key]: value }));
  }, [conn]);

  // ── Profiles ──────────────────────────────────────────────────

  const addProfile = useCallback(async (data: ProfileInput) => {
    if (!conn) return null;
    const res = await wsCommand<{ profile: SommelierProfile }>(conn, "melitta_barista/sommelier/profiles/add", data);
    setProfiles((prev) => [...prev, res.profile]);
    return res.profile;
  }, [conn]);

  const updateProfile = useCallback(async (profileId: string, data: Partial<ProfileInput>) => {
    if (!conn) return;
    const res = await wsCommand<{ profile: SommelierProfile }>(conn, "melitta_barista/sommelier/profiles/update", { profile_id: profileId, ...data });
    setProfiles((prev) => prev.map((p) => (p.id === profileId ? res.profile : p)));
  }, [conn]);

  const deleteProfile = useCallback(async (profileId: string) => {
    if (!conn) return;
    await wsCommand(conn, "melitta_barista/sommelier/profiles/delete", { profile_id: profileId });
    setProfiles((prev) => prev.filter((p) => p.id !== profileId));
  }, [conn]);

  const activateProfile = useCallback(async (profileId: string) => {
    if (!conn) return;
    await wsCommand(conn, "melitta_barista/sommelier/profiles/activate", { profile_id: profileId });
    setProfiles((prev) => prev.map((p) => ({ ...p, is_active: p.id === profileId })));
  }, [conn]);

  return {
    // Data
    beans, hoppers, milkTypes, favorites, history, presets, settings,
    extras, preferences, profiles,
    currentSession, generating, loading, error,
    // Actions
    addBean, updateBean, deleteBean,
    assignHopper, setMilk,
    generate, brewRecipe, brewFavorite,
    addFavorite, removeFavorite,
    setSetting, loadMoreHistory, refresh,
    setExtras, getPreferences, setPreference,
    addProfile, updateProfile, deleteProfile, activateProfile,
  };
}
