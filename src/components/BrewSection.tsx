import { useState, useRef, useCallback, useMemo } from "react";
import type { Connection, HassEntities } from "home-assistant-js-websocket";
import { getState, getEntity, getCupCounts, type RecipeDetails, type DirectKeyRecipe, type DirectKeyCategory, DIRECTKEY_CATEGORIES } from "../lib/entities";
import { selectOption, pressButton, brewDirectkey, setTextValue, safeCall } from "../lib/ha";
import { useRecipeCache } from "../hooks/useRecipeCache";
import { usePreferences } from "../lib/preferences";
import { CoffeeIcon } from "./CoffeeIcon";
import { RecipeEditModal } from "./RecipeEditModal";
import { RecipeCarousel } from "./RecipeCarousel";
import { RecipeCard } from "./RecipeCard";
import { RecipeGrid } from "./RecipeGrid";
import { ViewModeToggle } from "./ViewModeToggle";
import { Snowflake, Flame } from "lucide-react";
import type { TranslationKey } from "../lib/i18n";
import iconBean from "../assets/icons/bean.png";
import iconMilk from "../assets/icons/milk.png";
import iconWater from "../assets/icons/water.png";
import iconNotConnected from "../assets/icons/not_connected.png";
import iconService from "../assets/icons/service.png";
import iconTwoCups from "../assets/icons/two_cups.png";
import iconTwoCupsWhite from "../assets/icons/two_cups_white.png";
import iconAroma from "../assets/icons/aroma.png";

interface Props {
  conn: Connection;
  entities: HassEntities;
  prefix: string;
}

const PROCESS_IMG: Record<string, string> = {
  coffee: iconBean,
  milk: iconMilk,
  water: iconWater,
};

function ProcessIcon({ process, className }: { process: string; className?: string }) {
  const src = PROCESS_IMG[process];
  if (!src) return null;
  const size = className?.includes("w-5") ? "w-5 h-5" : "w-4 h-4";
  return <img src={src} alt={process} className={`${size} object-contain ${className || ""}`} draggable={false} />;
}

const INTENSITY_DOTS: Record<string, number> = {
  very_mild: 1,
  mild: 2,
  medium: 3,
  strong: 4,
  very_strong: 5,
};

function TempIcon({ temp, className }: { temp: string; className?: string }) {
  const size = className?.includes("w-4") ? 16 : 14;
  if (temp === "low") {
    return <Snowflake size={size} className={className} />;
  }
  if (temp === "high") {
    return <Flame size={size} className={className} />;
  }
  return null;
}

function IntensityDots({ level }: { level: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className="inline-block w-2 h-2 rounded-full"
          style={{ background: n <= level ? "var(--text-primary)" : "var(--text-tertiary)" }}
        />
      ))}
    </span>
  );
}

function RecipeInfo({ details, vertical, animated, compact, t }: {
  details: RecipeDetails;
  vertical?: boolean;
  animated?: boolean;
  compact?: boolean;
  t: (key: TranslationKey) => string;
}) {
  const components: { process: string; intensity: string; temp: string; shots: number; ml: number }[] = [];
  if (details.c1_process && details.c1_process !== "none") {
    components.push({
      process: details.c1_process,
      intensity: details.c1_intensity,
      temp: details.c1_temperature,
      shots: details.c1_shots,
      ml: details.c1_portion_ml,
    });
  }
  if (details.c2_process && details.c2_process !== "none") {
    components.push({
      process: details.c2_process,
      intensity: details.c2_intensity,
      temp: details.c2_temperature,
      shots: details.c2_shots,
      ml: details.c2_portion_ml,
    });
  }
  if (components.length === 0) return null;

  if (compact) {
    return (
      <div className="flex flex-col gap-1 items-center">
        {components.map((c, i) => (
          <div
            key={i}
            className={`flex items-center gap-1.5 text-[11px] ${animated ? "recipe-item-enter" : ""}`}
            style={animated ? { animationDelay: `${i * 60 + 80}ms` } : undefined}
          >
            <ProcessIcon process={c.process} className="w-3.5 h-3.5 shrink-0" />
            <span className="font-semibold tabular-nums text-primary">
              {c.ml}<span className="text-tertiary text-[9px] font-normal">ml</span>
            </span>
            {c.process === "coffee" && (
              <IntensityDots level={INTENSITY_DOTS[c.intensity] || 3} />
            )}
            <TempIcon temp={c.temp} className="w-3 h-3 shrink-0" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={vertical ? "flex flex-col gap-3 items-center" : "flex gap-6 justify-center"}>
      {components.map((c, i) => (
        <div
          key={i}
          className={`flex flex-col gap-1 items-center text-sm ${animated ? "recipe-item-enter" : ""}`}
          style={animated ? { animationDelay: `${i * 80 + 100}ms` } : undefined}
        >
          <div className="flex items-center gap-2">
            <ProcessIcon process={c.process} className="w-5 h-5 shrink-0" />
            <span className="font-semibold tabular-nums text-primary">
              {c.ml}<span className="text-tertiary text-xs font-normal">ml</span>
            </span>
            <TempIcon temp={c.temp} className="w-4 h-4 shrink-0" />
          </div>
          <div className="flex items-center gap-2">
            {c.process === "coffee" ? (
              <>
                <IntensityDots level={INTENSITY_DOTS[c.intensity] || 3} />
                {c.shots > 0 && <span className="text-secondary font-medium">{c.shots}x</span>}
              </>
            ) : c.temp === "high" ? (
              <span className="text-tertiary text-xs">
                {t("process.high")}
              </span>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

const SERVICE_KEYS: Record<string, { labelKey: TranslationKey; subKey: TranslationKey }> = {
  Cleaning: { labelKey: "service.cleaning", subKey: "service.cleaning_sub" },
  "Easy Clean": { labelKey: "service.easy_clean", subKey: "service.easy_clean_sub" },
  "Intensive Clean": { labelKey: "service.intensive_clean", subKey: "service.intensive_clean_sub" },
  Descaling: { labelKey: "service.descaling", subKey: "service.descaling_sub" },
  Evaporating: { labelKey: "service.evaporating", subKey: "service.evaporating_sub" },
  Busy: { labelKey: "service.busy", subKey: "service.busy_sub" },
};

const ACTION_KEYS: Record<string, TranslationKey> = {
  "Brew Unit Removed": "action.brew_unit_removed",
  "Trays Missing": "action.trays_missing",
  "Empty Trays": "action.empty_trays",
  "Fill Water": "action.fill_water",
  "Close Powder Lid": "action.close_powder_lid",
  "Fill Powder": "action.fill_powder",
};

const DK_LABEL_KEYS: Record<DirectKeyCategory, TranslationKey> = {
  espresso: "brew.dk_espresso",
  cafe_creme: "brew.dk_cafe_creme",
  cappuccino: "brew.dk_cappuccino",
  latte_macchiato: "brew.dk_latte_macchiato",
  milk_froth: "brew.dk_milk_froth",
  // milk: "brew.dk_milk",  // no physical button on Barista TS Smart
  water: "brew.dk_water",
};

const DK_RECIPE_ICON: Record<DirectKeyCategory, string> = {
  espresso: "Espresso",
  cafe_creme: "Café Crème",
  cappuccino: "Cappuccino",
  latte_macchiato: "Latte Macchiato",
  milk_froth: "Milk Froth",
  // milk: "Milk",  // no physical button on Barista TS Smart
  water: "Hot Water",
};

export function BrewSection({ conn, entities, prefix }: Props) {
  const { t, theme, viewMode } = usePreferences();
  const isDark = theme === "dark";
  const machineState = getState(entities, prefix, "sensor", "state");
  const isReady = machineState === "Ready";
  const isBrewing = machineState === "Brewing";
  const activity = getState(entities, prefix, "sensor", "activity") || "";
  const progress = getState(entities, prefix, "sensor", "progress");
  const actionRequired = getState(entities, prefix, "sensor", "action_required");
  const hasAction = actionRequired && actionRequired !== "None";
  const progressNum = progress ? Math.min(100, Math.max(0, parseFloat(progress))) : 0;

  const selectedProfile = getState(entities, prefix, "select", "profile");
  const selectedRecipe = getState(entities, prefix, "select", "recipe");
  const { profileOptions, recipeOptions, allRecipes, directKey } = useRecipeCache(entities, prefix);
  const cupCounts = useMemo(() => getCupCounts(entities, prefix), [entities, prefix]);

  // Sort recipes by popularity (cup count desc), keep original order for ties
  const sortedRecipeOptions = useMemo(() => {
    if (Object.keys(cupCounts).length === 0) return recipeOptions;
    return [...recipeOptions].sort((a, b) => (cupCounts[b] ?? 0) - (cupCounts[a] ?? 0));
  }, [recipeOptions, cupCounts]);

  const selectedDetails = allRecipes[selectedRecipe || ""] as RecipeDetails | undefined;
  const hasSelectedDetails = selectedDetails?.c1_process !== undefined;

  const brewId = `button.${prefix}_brew`;
  const cancelId = `button.${prefix}_cancel`;
  const [hoveredRecipe, setHoveredRecipe] = useState<string | null>(null);
  const [editingDk, setEditingDk] = useState<{ category: DirectKeyCategory; recipe: DirectKeyRecipe } | null>(null);
  const [selectedDk, setSelectedDk] = useState<DirectKeyCategory | null>(null);
  const [twoCups, setTwoCups] = useState(false);
  const [aromaIntense, setAromaIntense] = useState(false);
  const [editingProfileIdx, setEditingProfileIdx] = useState<number | null>(null);
  const [editingProfileName, setEditingProfileName] = useState("");
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);
  const dkLongPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dkLongPressTriggered = useRef(false);
  const profileNameInputRef = useRef<HTMLInputElement>(null);

  const activeProfileId = directKey?.activeProfile ?? 0;
  const activeProfileRecipes = directKey?.profiles[activeProfileId] ?? {};
  const hasDkRecipes = Object.keys(activeProfileRecipes).length > 0;

  const startDkLongPress = useCallback((cat: DirectKeyCategory, recipe: DirectKeyRecipe) => {
    if (activeProfileId === 0) return;
    dkLongPressTriggered.current = false;
    dkLongPressTimer.current = setTimeout(() => {
      dkLongPressTriggered.current = true;
      setEditingDk({ category: cat, recipe });
    }, 500);
  }, [activeProfileId]);

  const cancelDkLongPress = useCallback(() => {
    if (dkLongPressTimer.current) {
      clearTimeout(dkLongPressTimer.current);
      dkLongPressTimer.current = null;
    }
  }, []);

  const handleDkClick = useCallback((cat: DirectKeyCategory) => {
    if (dkLongPressTriggered.current) return;
    if (selectedDk === cat) {
      safeCall(() => brewDirectkey(conn, brewId, cat, twoCups));
    } else {
      setSelectedDk(cat);
    }
  }, [conn, brewId, selectedDk, twoCups]);

  const handleDkDoubleClick = useCallback((cat: DirectKeyCategory, recipe: DirectKeyRecipe) => {
    if (activeProfileId === 0) return;
    setEditingDk({ category: cat, recipe });
  }, [activeProfileId]);

  const startLongPress = useCallback((idx: number, name: string) => {
    longPressTriggered.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      if (idx > 0) {
        setEditingProfileIdx(idx);
        setEditingProfileName(name);
        setTimeout(() => profileNameInputRef.current?.focus(), 50);
      }
    }, 500);
  }, []);

  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleProfileClick = useCallback((_idx: number, opt: string) => {
    if (longPressTriggered.current) return;
    if (editingProfileIdx !== null) return;
    if (opt === selectedProfile) return;
    safeCall(() => selectOption(conn, `select.${prefix}_profile`, opt));
  }, [conn, prefix, editingProfileIdx, selectedProfile]);

  const handleProfileDoubleClick = useCallback((idx: number, name: string) => {
    if (idx > 0) {
      setEditingProfileIdx(idx);
      setEditingProfileName(name);
      setTimeout(() => profileNameInputRef.current?.focus(), 50);
    }
  }, []);

  const commitProfileName = useCallback(() => {
    if (editingProfileIdx !== null && editingProfileName.trim()) {
      const entityId = `text.${prefix}_profile_${editingProfileIdx}_name`;
      safeCall(() => setTextValue(conn, entityId, editingProfileName.trim()));
    }
    setEditingProfileIdx(null);
  }, [editingProfileIdx, editingProfileName, conn, prefix]);

  // Select recipe only (no brew) — used by carousel, grid, and list
  const handleCarouselSelect = useCallback((name: string) => {
    setSelectedDk(null);
    if (name !== selectedRecipe) {
      safeCall(() => selectOption(conn, `select.${prefix}_recipe`, name));
    }
  }, [conn, prefix, selectedRecipe]);

  // Carousel: brew
  const handleCarouselBrew = useCallback(() => {
    if (getEntity(entities, prefix, "button", "brew")) {
      safeCall(() => pressButton(conn, brewId));
    }
  }, [conn, brewId, entities, prefix]);

  // Carousel: stable renderInfo (compact for card layout)
  const carouselRenderInfo = useCallback(
    (details: RecipeDetails) => <RecipeInfo details={details} compact animated t={t} />,
    [t],
  );

  // Carousel: stable recipes array (only recompute when source data changes)
  const carouselRecipes = useMemo(
    () => sortedRecipeOptions.map((opt) => ({
      name: opt,
      isSelected: opt === selectedRecipe && !selectedDk,
      details: allRecipes[opt] as RecipeDetails | undefined,
    })),
    [sortedRecipeOptions, selectedRecipe, selectedDk, allRecipes],
  );

  if (isBrewing) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-8 px-6">
        <CoffeeIcon recipe={activity || "Espresso"} size={260} />
        <div className="flex flex-col items-center gap-4 w-full max-w-xs">
          <div className="w-full rounded-2xl backdrop-blur-xl ring-1 ring-border px-5 py-4" style={{ background: "var(--surface-card)" }}>
            <div className="text-lg font-light text-primary tracking-wide text-center">{activity}</div>
            {hasSelectedDetails && selectedDetails && (
              <div className="flex justify-center mt-2">
                <RecipeInfo details={selectedDetails} t={t} />
              </div>
            )}
            {progress && (
              <div className="mt-3 flex items-center gap-3">
                <div className="flex-1 h-px overflow-hidden rounded-full" style={{ background: "var(--slider-track)" }}>
                  <div
                    className="h-full transition-all duration-500"
                    style={{ width: `${progressNum}%`, background: "var(--accent)" }}
                  />
                </div>
                <span className="text-tertiary text-xs tabular-nums w-8 text-right">{progressNum}%</span>
              </div>
            )}
          </div>
          <button
            onClick={() => safeCall(() => pressButton(conn, cancelId))}
            className="rounded-lg px-8 py-2.5 text-sm font-medium text-secondary ring-1 ring-border hover:ring-border-hover transition active:scale-[0.98]"
          >
            {t("brew.cancel")}
          </button>
        </div>
      </div>
    );
  }

  if (!machineState || machineState === "Off" || machineState === "offline") {
    return (
      <div className="flex h-full flex-col items-center justify-center px-8">
        <div className="flex flex-col items-center gap-6 max-w-sm">
          <img src={iconNotConnected} alt="offline" className="w-24 h-24 object-contain opacity-60" draggable={false} />
          <div className="text-center">
            <div className="text-xl font-light text-primary tracking-wide">{t("brew.offline_title")}</div>
            <div className="text-sm text-tertiary mt-2 leading-relaxed">{t("brew.offline_desc")}</div>
          </div>
          <div className="w-12 h-px" style={{ background: "var(--border)" }} />
        </div>
      </div>
    );
  }

  const serviceKeys = machineState ? SERVICE_KEYS[machineState] : null;
  if (serviceKeys && !isReady && !isBrewing) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-8">
        <div className="flex flex-col items-center gap-6 max-w-sm">
          <img src={iconService} alt="service" className="w-20 h-20 object-contain opacity-70" draggable={false} />
          <div className="text-center">
            <div className="text-xl font-light text-primary tracking-wide">{t(serviceKeys.labelKey)}</div>
            <div className="text-sm text-tertiary mt-2 leading-relaxed">{t(serviceKeys.subKey)}</div>
          </div>
          {progress && (
            <div className="w-48 flex items-center gap-3">
              <div className="flex-1 h-px overflow-hidden rounded-full" style={{ background: "var(--slider-track)" }}>
                <div className="h-full transition-all duration-500" style={{ width: `${progressNum}%`, background: "var(--text-secondary)" }} />
              </div>
              <span className="text-tertiary text-xs tabular-nums">{progressNum}%</span>
            </div>
          )}
          <div className="w-12 h-px" style={{ background: "var(--border)" }} />
        </div>
      </div>
    );
  }

  const actionKey = ACTION_KEYS[actionRequired || ""];
  const actionHint = actionKey ? t(actionKey) : "";

  return (
    <div className="relative flex h-full flex-col">
      {hasAction && (
        <div className="absolute inset-0 z-30 flex items-center justify-center backdrop-blur-sm" style={{ background: "var(--overlay-bg)" }}>
          <div className="flex flex-col items-center gap-5 max-w-xs rounded-2xl ring-1 ring-border px-8 py-8" style={{ background: "var(--surface)" }}>
            <img src={iconNotConnected} alt="action required" className="w-20 h-20 object-contain" draggable={false} />
            <div className="text-center">
              <div className="text-lg font-light text-primary tracking-wide">{actionRequired}</div>
              {actionHint && <div className="text-sm text-tertiary mt-2 leading-relaxed">{actionHint}</div>}
            </div>
          </div>
        </div>
      )}

      {/* Profile tab bar — always dark */}
      {isReady && profileOptions.length > 1 && (
        <div className="shrink-0" style={{ background: "var(--profile-bar-bg)" }}>
          <div className="flex overflow-x-auto">
            {profileOptions.map((opt, idx) => {
              const isActive = opt === selectedProfile;
              const isEditing = editingProfileIdx === idx;
              return (
                <button
                  key={idx}
                  onClick={() => handleProfileClick(idx, opt)}
                  onDoubleClick={() => handleProfileDoubleClick(idx, opt)}
                  onPointerDown={() => startLongPress(idx, opt)}
                  onPointerUp={cancelLongPress}
                  onPointerLeave={cancelLongPress}
                  onContextMenu={(e) => e.preventDefault()}
                  className="relative flex-1 min-w-[80px] px-4 py-3 text-[11px] tracking-widest uppercase font-medium transition-opacity whitespace-nowrap"
                  style={{ letterSpacing: "0.12em", color: isActive ? "#ffffff" : "rgba(255,255,255,0.4)" }}
                >
                  {isEditing ? (
                    <input
                      ref={profileNameInputRef}
                      type="text"
                      value={editingProfileName}
                      onChange={(e) => setEditingProfileName(e.target.value)}
                      onBlur={commitProfileName}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitProfileName();
                        if (e.key === "Escape") setEditingProfileIdx(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full text-center text-[11px] tracking-widest uppercase font-medium outline-none bg-transparent border-b"
                      style={{ color: "#ffffff", borderColor: "rgba(255,255,255,0.5)" }}
                    />
                  ) : (
                    opt
                  )}
                  {isActive && (
                    <span
                      className="absolute bottom-0 left-3 right-3 h-px"
                      style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)" }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* DirectKey recipe grid */}
      {isReady && hasDkRecipes && (
        <div className="shrink-0">
          <div
            className="grid grid-cols-8 sm:grid-cols-8 md:grid-cols-8"
            style={{ gap: "1px", background: "var(--section-divider)" }}
          >
            {DIRECTKEY_CATEGORIES.map((cat) => {
              const recipe = activeProfileRecipes[cat];
              if (!recipe) return null;
              const label = t(DK_LABEL_KEYS[cat]);
              const isSelected = selectedDk === cat;
              const hasDetails = recipe.c1_process !== undefined && recipe.c1_process !== "none";
              return (
                <button
                  key={cat}
                  onClick={() => handleDkClick(cat)}
                  onDoubleClick={() => handleDkDoubleClick(cat, recipe)}
                  onPointerDown={() => startDkLongPress(cat, recipe)}
                  onPointerUp={cancelDkLongPress}
                  onPointerLeave={cancelDkLongPress}
                  onContextMenu={(e) => e.preventDefault()}
                  className="relative flex flex-col items-center justify-center p-1.5 pb-5 transition-colors duration-300 active:scale-[0.97] overflow-hidden"
                  style={{ background: isSelected ? "var(--recipe-selected-bg)" : "var(--dk-card-bg)" }}
                >
                  <div className={isSelected && hasDetails ? "recipe-icon-fade" : ""}>
                    <CoffeeIcon recipe={DK_RECIPE_ICON[cat]} size={64} />
                  </div>
                  {isSelected && hasDetails && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center recipe-overlay-enter" style={{ background: "var(--overlay-bg)" }}>
                      <RecipeInfo details={recipe} compact animated t={t} />
                    </div>
                  )}
                  <span
                    className="absolute bottom-0 left-0 right-0 text-center text-[10px] py-1.5 transition-all duration-300 z-10 truncate"
                    style={
                      isSelected
                        ? { background: "var(--recipe-label-bg)", color: "var(--recipe-label-text)", fontWeight: 600 }
                        : { background: "transparent", color: "var(--text-tertiary)", fontWeight: 500 }
                    }
                  >
                    {isSelected ? `${t("brew.brew")} ${label}` : label}
                  </span>
                </button>
              );
            })}

            {/* 2x toggle — brew two cups */}
            <button
              onClick={() => setTwoCups((v) => !v)}
              className="relative flex flex-col items-center justify-center p-1.5 pb-5 transition-all duration-300 active:scale-[0.97] overflow-hidden"
              style={{ background: twoCups ? "var(--recipe-selected-bg)" : "var(--dk-card-bg)" }}
            >
              <div className="flex items-center justify-center" style={{ width: 64, height: 64 }}>
                <img
                  src={isDark ? iconTwoCupsWhite : iconTwoCups}
                  alt="2x"
                  className="object-contain transition-all duration-300"
                  style={{
                    width: twoCups ? 52 : 44,
                    height: twoCups ? 52 : 44,
                    opacity: twoCups ? 1 : 0.4,
                  }}
                  draggable={false}
                />
              </div>
              <span
                className="absolute bottom-0 left-0 right-0 text-center text-[10px] py-1.5 transition-all duration-300 z-10 truncate"
                style={
                  twoCups
                    ? { background: "var(--recipe-label-bg)", color: "var(--recipe-label-text)", fontWeight: 600 }
                    : { background: "transparent", color: "var(--text-tertiary)", fontWeight: 500 }
                }
              >
                {twoCups ? t("brew.two_cups_on") : t("brew.two_cups")}
              </span>
            </button>

            {/* Aroma toggle — intense aroma */}
            <button
              onClick={() => setAromaIntense((v) => !v)}
              className="relative flex flex-col items-center justify-center p-1.5 pb-5 transition-all duration-300 active:scale-[0.97] overflow-hidden"
              style={{ background: aromaIntense ? "var(--recipe-selected-bg)" : "var(--dk-card-bg)" }}
            >
              <div className="flex items-center justify-center" style={{ width: 64, height: 64 }}>
                <img
                  src={iconAroma}
                  alt="aroma"
                  className="object-contain transition-all duration-300"
                  style={{
                    width: aromaIntense ? 52 : 44,
                    height: aromaIntense ? 52 : 44,
                    opacity: aromaIntense ? 1 : 0.4,
                  }}
                  draggable={false}
                />
              </div>
              <span
                className="absolute bottom-0 left-0 right-0 text-center text-[10px] py-1.5 transition-all duration-300 z-10 truncate"
                style={
                  aromaIntense
                    ? { background: "var(--recipe-label-bg)", color: "var(--recipe-label-text)", fontWeight: 600 }
                    : { background: "transparent", color: "var(--text-tertiary)", fontWeight: 500 }
                }
              >
                {aromaIntense ? t("brew.aroma_on") : t("brew.aroma")}
              </span>
            </button>
          </div>
        </div>
      )}

      {editingDk && (
        <RecipeEditModal
          conn={conn}
          brewEntityId={brewId}
          category={editingDk.category}
          categoryLabel={t(DK_LABEL_KEYS[editingDk.category])}
          recipe={editingDk.recipe}
          profileId={activeProfileId}
          onClose={() => setEditingDk(null)}
        />
      )}

      {isReady && sortedRecipeOptions.length > 0 && (
        <div className="flex-1 min-h-0 flex flex-col">
          {/* Divider with view mode toggle */}
          <div className="shrink-0 flex items-center gap-3 px-5 py-1.5" style={{ background: "var(--bg)" }}>
            <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg, var(--section-divider), transparent)" }} />
            {hasDkRecipes && (
              <span className="text-[9px] tracking-[0.2em] uppercase font-medium" style={{ color: "var(--text-secondary)", opacity: 0.6 }}>
                {t("brew.all_recipes")}
              </span>
            )}
            <ViewModeToggle />
            <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg, transparent, var(--section-divider))" }} />
          </div>

          {/* Grid view */}
          {viewMode === "grid" && (
            <RecipeGrid
              recipes={carouselRecipes}
              onSelect={handleCarouselSelect}
              onBrew={handleCarouselBrew}
              renderInfo={carouselRenderInfo}
              brewLabel={t("brew.brew")}
            />
          )}

          {/* List view — list left, selected card right */}
          {viewMode === "list" && (
            <div className="flex-1 min-h-0 flex">
              {/* Recipe list — left side */}
              <div className="flex-1 min-h-0 overflow-y-auto">
                {sortedRecipeOptions.map((opt) => {
                  const isSelected = opt === selectedRecipe && !selectedDk;
                  return (
                    <div key={opt}>
                      <button
                        onClick={() => handleCarouselSelect(opt)}
                        onPointerEnter={() => setHoveredRecipe(opt)}
                        onPointerLeave={() => setHoveredRecipe((h) => h === opt ? null : h)}
                        className="w-full flex items-center gap-3 px-4 py-2 transition-all duration-300 active:scale-[0.99]"
                        style={{
                          background: isSelected
                            ? "linear-gradient(90deg, var(--recipe-selected-bg), transparent)"
                            : hoveredRecipe === opt
                              ? "linear-gradient(90deg, var(--surface), transparent)"
                              : "transparent",
                        }}
                      >
                        <CoffeeIcon recipe={opt} size={36} />
                        <span
                          className={`text-xs tracking-widest uppercase text-left truncate transition-all duration-300 ${isSelected ? "font-medium" : "font-light"}`}
                          style={{
                            color: isSelected ? "var(--text-primary)" : "var(--text-tertiary)",
                            letterSpacing: "0.12em",
                          }}
                        >
                          {opt}
                        </span>
                      </button>
                      <div className="h-px ml-4" style={{ background: "linear-gradient(90deg, var(--border-hover), transparent)" }} />
                    </div>
                  );
                })}
              </div>

              {/* Selected recipe card — right side */}
              {selectedRecipe && selectedDetails && (
                <div className="w-[45%] shrink-0 flex flex-col items-center justify-center border-l" style={{ borderColor: "var(--border)" }}>
                  <RecipeCard
                    recipe={{
                      name: selectedRecipe,
                      isSelected: true,
                      details: selectedDetails,
                    }}
                    active
                    hovered={false}
                    dimInactive={false}
                    iconSize={200}
                    onClick={handleCarouselBrew}
                    onPointerEnter={() => {}}
                    onPointerLeave={() => {}}
                    renderInfo={carouselRenderInfo}
                    className="pt-4 px-4 pb-3 h-full"
                  />
                  {/* Brew button */}
                  <div className="shrink-0 pb-3">
                    <button
                      className="py-2.5 px-8 text-xs tracking-widest uppercase font-semibold transition-all duration-200 active:scale-[0.98]"
                      style={{
                        background: "var(--recipe-label-bg)",
                        color: "var(--recipe-label-text)",
                        letterSpacing: "0.12em",
                      }}
                      onClick={handleCarouselBrew}
                    >
                      {t("brew.brew")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Carousel view */}
          {viewMode === "carousel" && (
            <RecipeCarousel
              recipes={carouselRecipes}
              onSelect={handleCarouselSelect}
              onBrew={handleCarouselBrew}
              renderInfo={carouselRenderInfo}
              brewLabel={t("brew.brew")}
            />
          )}
        </div>
      )}
    </div>
  );
}
