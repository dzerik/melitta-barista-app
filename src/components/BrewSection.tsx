import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import type { Connection, HassEntities } from "home-assistant-js-websocket";
import {
  getState,
  getEntity,
  getCupCounts,
  resolveDirectKeyModel,
  legacyDirectKeyModel,
  visibleProfileSlots,
  canRenameProfileSlot,
  activeProfileFromEntities,
  directKeyProfilesFromList,
  fetchDirectKeyRecipeList,
  directKeyCategoryLabel,
  type RecipeDetails,
  type DirectKeyRecipe,
  type DirectKeyCategory,
  type DirectKeyProfileSlotModel,
} from "../lib/entities";
import { readDirectKey, type UiContract } from "../lib/contract";
import { serverString } from "../lib/server-strings";
import { deriveMachineStatus, type ServiceKind } from "../lib/status";
import { selectOption, pressButton, brewDirectkey, setTextValue, safeCall } from "../lib/ha";
import { useRecipeCache } from "../hooks/useRecipeCache";
import { usePreferences } from "../lib/preferences";
import { CoffeeIcon } from "./CoffeeIcon";
import { RecipeEditModal } from "./RecipeEditModal";
import { RecipeCarousel } from "./RecipeCarousel";
import { RecipeCard } from "./RecipeCard";
import { RecipeGrid } from "./RecipeGrid";
import { ViewModeToggle } from "./ViewModeToggle";
import {
  ActionBand,
  Commit,
  DrinkStage,
  Field,
  Glyph,
  Meter,
  Mosaic,
  Option,
  RAIL_TEXT,
  Rule,
  TickRing,
  Word,
  underlineSlot,
} from "./ui";
import { Snowflake, Flame, X } from "lucide-react";
import type { TranslationKey } from "../lib/i18n";
import iconBean from "../assets/icons/bean.png";
import iconMilk from "../assets/icons/milk.png";
import iconWater from "../assets/icons/water.png";
import iconNotConnected from "../assets/icons/not_connected.png";
import iconService from "../assets/icons/service.png";
import iconTwoCups from "../assets/icons/two_cups.png";
import iconTwoCupsWhite from "../assets/icons/two_cups_white.png";

interface Props {
  conn: Connection;
  entities: HassEntities;
  prefix: string;
  /** UI Contract document (P-I wiring); null/omitted → legacy tables. */
  contract?: UiContract | null;
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

/**
 * Strength, drawn the way the reference machine draws it: five bean marks,
 * the filled ones counting the level. True circles at 8px — a permitted curve
 * (§S4.6) and a position mark, so the paint is the value, not a container.
 */
function IntensityDots({ level, onInk, offInk }: {
  level: number;
  onInk: string;
  offInk: string;
}) {
  return (
    <span className="inline-flex gap-0.5" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className="inline-block"
          data-fill="dot"
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            backgroundColor: n <= level ? onInk : offInk,
            opacity: n <= level ? 1 : 0.45,
          }}
        />
      ))}
    </span>
  );
}

const PROCESS_LABEL: Record<string, TranslationKey> = {
  coffee: "process.coffee",
  milk: "process.milk",
  water: "process.water",
};

/**
 * The abort mark of a full-screen takeover (§C5b / §5.C form (ii)).
 *
 * One solid circle ~30px across, holding a single glyph at about a third of
 * the diameter, with its WORD OUTSIDE it to the right — which is why it is
 * passed as `Word`'s `icon` rather than drawn as a ninth hand-rolled button
 * (C5). A true circle (width === height) is the one curve L1 permits, and on
 * the brewing screen it is the only saturated shape there is, so it declares
 * the `commit` carve-out and nothing else on that screen may paint.
 */
function AbortCircle() {
  return (
    <span
      aria-hidden="true"
      data-ui="abort-circle"
      data-fill="commit"
      className="flex shrink-0 items-center justify-center"
      style={{
        width: 30,
        height: 30,
        borderRadius: "50%",
        backgroundColor: "var(--error-text)",
        color: "var(--text-inverse)",
      }}
    >
      <X size={10} strokeWidth={2.5} />
    </span>
  );
}

/**
 * The composition read-out, as the app's universal value strip (§C7).
 *
 * One horizontal line that never wraps, groups divided by a short 1px
 * `--border` hairline rather than by a chip, badge, pill or bar: the label
 * half in `--accent`, the value in `--text-primary`, the unit dropped to
 * `--text-tertiary` at the SAME size — the old `text-[9px]` and `text-xs`
 * unit suffixes were off the four-step scale (§7.6).
 *
 * `onAccent` re-inks the whole strip for the one place it sits on a saturated
 * ground: the selected DirectKey tile, which owner decision 2 turns into the
 * screen's commit rectangle.
 */
function RecipeInfo({ details, vertical, animated, compact, onAccent, t }: {
  details: RecipeDetails;
  vertical?: boolean;
  animated?: boolean;
  compact?: boolean;
  onAccent?: boolean;
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

  const ink = onAccent
    ? {
        label: "var(--text-inverse)",
        value: "var(--text-inverse)",
        quiet: "var(--text-inverse)",
        divider: "var(--text-inverse)",
        dotOn: "var(--text-inverse)",
        dotOff: "var(--text-inverse)",
      }
    : {
        label: "var(--accent)",
        value: "var(--text-primary)",
        quiet: "var(--text-tertiary)",
        divider: "var(--border)",
        dotOn: "var(--text-primary)",
        dotOff: "var(--text-tertiary)",
      };
  const glyph = compact ? "w-3.5 h-3.5 shrink-0" : "w-4 h-4 shrink-0";
  const tempGlyph = compact ? "w-3 h-3 shrink-0" : "w-4 h-4 shrink-0";

  return (
    <div
      data-ui="value-strip"
      className={`flex min-w-0 max-w-full items-center overflow-hidden ${
        vertical ? "flex-col gap-2" : "justify-center"
      }`}
      style={{ color: ink.value }}
    >
      {components.map((c, i) => {
        const divided = i > 0 && !vertical;
        return (
          <span
            key={i}
            className={`flex items-center gap-1.5 t-label whitespace-nowrap ${
              divided ? "pl-3 ml-3" : ""
            } ${animated ? "recipe-item-enter" : ""}`}
            style={{
              ...(divided
                ? {
                    borderLeftWidth: "1px",
                    borderLeftStyle: "solid" as const,
                    borderLeftColor: ink.divider,
                  }
                : null),
              ...(animated ? { animationDelay: `${i * 60 + 80}ms` } : null),
            }}
          >
            <ProcessIcon process={c.process} className={glyph} />
            {!compact && PROCESS_LABEL[c.process] !== undefined && (
              <span style={{ color: ink.label }}>{t(PROCESS_LABEL[c.process])}</span>
            )}
            <span className="num" style={{ fontWeight: 600, color: ink.value }}>
              {c.ml}
            </span>
            <span style={{ color: ink.quiet, opacity: onAccent ? 0.7 : 1 }}>ml</span>
            {c.process === "coffee" && (
              <IntensityDots
                level={INTENSITY_DOTS[c.intensity] || 3}
                onInk={ink.dotOn}
                offInk={ink.dotOff}
              />
            )}
            {c.process === "coffee" && c.shots > 0 && (
              // C22: a figure and its unit are two spans, never one baked
              // string — the number stays `--text-primary` at 600 and the "x"
              // drops to `--text-tertiary` at the SAME size, exactly as the
              // ml pair beside it does. "2x" written as one string could not
              // be re-inked later, which is the whole defect C22 names. They
              // sit in their own gapless flex so the pair still reads "2x".
              <span className="inline-flex items-baseline">
                <span className="num" style={{ fontWeight: 600, color: ink.value }}>
                  {c.shots}
                </span>
                <span style={{ color: ink.quiet, opacity: onAccent ? 0.7 : 1 }}>x</span>
              </span>
            )}
            {c.process !== "coffee" && c.temp === "high" && !compact && (
              <span style={{ color: ink.quiet, opacity: onAccent ? 0.7 : 1 }}>
                {t("process.high")}
              </span>
            )}
            <TempIcon temp={c.temp} className={tempGlyph} />
          </span>
        );
      })}
    </div>
  );
}

const SERVICE_KEYS: Record<ServiceKind, { labelKey: TranslationKey; subKey: TranslationKey }> = {
  cleaning: { labelKey: "service.cleaning", subKey: "service.cleaning_sub" },
  easy_clean: { labelKey: "service.easy_clean", subKey: "service.easy_clean_sub" },
  intensive_clean: { labelKey: "service.intensive_clean", subKey: "service.intensive_clean_sub" },
  descaling: { labelKey: "service.descaling", subKey: "service.descaling_sub" },
  evaporating: { labelKey: "service.evaporating", subKey: "service.evaporating_sub" },
  busy: { labelKey: "service.busy", subKey: "service.busy_sub" },
};

/**
 * Frozen English display labels (§5.2 rule 8) per category token — the
 * CoffeeIcon PNG-lookup fallback tier when a recipe row carries no
 * renderable IconSpec. Which categories render is served data now
 * (`machine_button`, §9.3.1), so all 7 tokens map.
 */
const DK_RECIPE_ICON: Record<string, string> = {
  espresso: "Espresso",
  cafe_creme: "Café Crème",
  cappuccino: "Cappuccino",
  latte_macchiato: "Latte Macchiato",
  milk_froth: "Milk Froth",
  milk: "Milk",
  water: "Hot Water",
};

export function BrewSection({ conn, entities, prefix, contract = null }: Props) {
  const { t, theme, viewMode, locale } = usePreferences();
  const isDark = theme === "dark";
  // Token-first status (UI Contract §3.4 B); legacy string matching inside
  // deriveMachineStatus is the pre-contract fallback.
  const statusView = deriveMachineStatus(entities, prefix, locale);
  const isReady = statusView.ready;
  const isBrewing = statusView.brewing;
  const activity = statusView.activityLabel || "";
  const progress = getState(entities, prefix, "sensor", "progress");
  const hasAction = statusView.hasAction;
  const progressNum = progress ? Math.min(100, Math.max(0, parseFloat(progress))) : 0;

  const selectedRecipe = getState(entities, prefix, "select", "recipe");
  const { profileOptions, recipeOptions, allRecipes, directKey } = useRecipeCache(entities, prefix);

  // DirectKey/profile model (§9.3.6 rule 1): served block → legacy tables.
  // Rule 6: a served model whose profile select has no state object falls
  // back whole to the legacy tier (contract presence never overrides entity
  // absence).
  const model = useMemo(() => {
    const m = resolveDirectKeyModel(contract, profileOptions.length);
    if (
      m.source === "contract" &&
      getEntity(entities, prefix, "select", m.profileSelectSuffix) === undefined
    ) {
      return legacyDirectKeyModel(profileOptions.length);
    }
    return m;
  }, [contract, profileOptions.length, entities, prefix]);

  const selectedProfile = getState(
    entities, prefix, "select", model.profileSelectSuffix,
  );

  // Profile slots: 0/fixed always; others via their bound activity switch.
  const visibleSlots = useMemo(
    () => visibleProfileSlots(model, profileOptions, entities, prefix),
    [model, profileOptions, entities, prefix],
  );

  const cupCounts = useMemo(() => getCupCounts(entities, prefix), [entities, prefix]);

  // Sort recipes by popularity (cup count desc), keep original order for ties
  const sortedRecipeOptions = useMemo(() => {
    if (Object.keys(cupCounts).length === 0) return recipeOptions;
    return [...recipeOptions].sort((a, b) => (cupCounts[b] ?? 0) - (cupCounts[a] ?? 0));
  }, [recipeOptions, cupCounts]);

  const selectedDetails = allRecipes[selectedRecipe || ""] as RecipeDetails | undefined;

  // The band is a mosaic, so it needs to know how many tiles it draws: the
  // served categories the machine actually has a button for, plus the 2x tile.
  const directKeyTiles = model.categories.filter((c) => c.machineButton);
  const hasSelectedDetails = selectedDetails?.c1_process !== undefined;

  const brewId = `button.${prefix}_brew`;
  const cancelId = `button.${prefix}_cancel`;
  const [hoveredRecipe, setHoveredRecipe] = useState<string | null>(null);
  const [editingDk, setEditingDk] = useState<{ category: DirectKeyCategory; recipe: DirectKeyRecipe } | null>(null);
  const [selectedDk, setSelectedDk] = useState<DirectKeyCategory | null>(null);
  const [twoCups, setTwoCups] = useState(false);
  const [editingProfileIdx, setEditingProfileIdx] = useState<number | null>(null);
  const [editingProfileName, setEditingProfileName] = useState("");
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);
  const dkLongPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dkLongPressTriggered = useRef(false);

  // Recipe data (§9.3.6 rule 5): WS recipes/list rows joined on
  // profile_id + category token when the contract serves a directkey block;
  // the pushed directkey_recipes attribute (display-name reverse maps in
  // useRecipeCache) stays the pre-0.93 fallback. Refetched when the
  // contract fingerprint changes (recipe_cache_generation is a fingerprint
  // input) and after a save closes the edit modal.
  const [listProfiles, setListProfiles] = useState<Record<
    number,
    Record<string, DirectKeyRecipe>
  > | null>(null);
  const [listGen, setListGen] = useState(0);
  useEffect(() => {
    const doc = contract;
    const block = readDirectKey(doc);
    if (doc === null || block === null) return;
    const ids: Record<string, number> = {};
    for (const c of block.categories) {
      if (typeof c?.category === "string" && typeof c?.id === "number") {
        ids[c.category] = c.id;
      }
    }
    let cancelled = false;
    void (async () => {
      const payload = await fetchDirectKeyRecipeList(conn, doc.entry_id);
      if (cancelled) return;
      setListProfiles(
        payload === null ? null : directKeyProfilesFromList(payload, ids),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [conn, contract, listGen]);

  // Active profile from the served attribute name (§9.3.6 rule 4);
  // the cached legacy value covers startup before entities arrive.
  const activeProfileId =
    activeProfileFromEntities(model, entities, prefix) ??
    directKey?.activeProfile ??
    0;
  // The recipes/list join applies only while the contract serves the block
  // (a fetched map from a previous document is ignored, not cleared — the
  // effect refetches whenever the document changes).
  const dkBlockPresent = contract !== null && readDirectKey(contract) !== null;
  const dkProfiles =
    (dkBlockPresent ? listProfiles : null) ?? directKey?.profiles ?? null;
  const activeProfileRecipes = dkProfiles?.[activeProfileId] ?? {};
  const hasDkRecipes = Object.keys(activeProfileRecipes).length > 0;
  // Slot 0 (`fixed`) recipes are not editable (§9.3.2).
  const activeSlot = model.profiles.find((p) => p.slot === activeProfileId);
  const dkEditBlocked = activeSlot !== undefined ? activeSlot.fixed : activeProfileId === 0;

  const startDkLongPress = useCallback((cat: DirectKeyCategory, recipe: DirectKeyRecipe) => {
    if (dkEditBlocked) return;
    dkLongPressTriggered.current = false;
    dkLongPressTimer.current = setTimeout(() => {
      dkLongPressTriggered.current = true;
      setEditingDk({ category: cat, recipe });
    }, 500);
  }, [dkEditBlocked]);

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
    if (dkEditBlocked) return;
    setEditingDk({ category: cat, recipe });
  }, [dkEditBlocked]);

  const startLongPress = useCallback((slot: DirectKeyProfileSlotModel, name: string) => {
    longPressTriggered.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      if (canRenameProfileSlot(model, slot, entities, prefix)) {
        setEditingProfileIdx(slot.slot);
        setEditingProfileName(name);
      }
    }, 500);
  }, [model, entities, prefix]);

  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleProfileClick = useCallback((_slot: number, opt: string) => {
    if (longPressTriggered.current) return;
    if (editingProfileIdx !== null) return;
    if (opt === selectedProfile) return;
    safeCall(() =>
      selectOption(conn, `select.${prefix}_${model.profileSelectSuffix}`, opt),
    );
  }, [conn, prefix, model, editingProfileIdx, selectedProfile]);

  const handleProfileDoubleClick = useCallback((slot: DirectKeyProfileSlotModel, name: string) => {
    if (canRenameProfileSlot(model, slot, entities, prefix)) {
      setEditingProfileIdx(slot.slot);
      setEditingProfileName(name);
    }
  }, [model, entities, prefix]);

  const commitProfileName = useCallback(() => {
    if (editingProfileIdx !== null && editingProfileName.trim()) {
      // Entity binding from the profiles entry (§9.3.6 rule 4) — the legacy
      // model carries the old string-template suffix for pre-contract servers.
      const suffix = model.profiles.find(
        (p) => p.slot === editingProfileIdx,
      )?.nameEntitySuffix;
      if (suffix) {
        safeCall(() =>
          setTextValue(conn, `text.${prefix}_${suffix}`, editingProfileName.trim()),
        );
      }
    }
    setEditingProfileIdx(null);
  }, [editingProfileIdx, editingProfileName, conn, prefix, model]);

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
    // C1 — THE ONE BREWING TAKEOVER, AND IT LIVES HERE.
    //
    // Two components used to draw `view.brewing`: this one and a z-50
    // `StatusOverlay` portal that mounted on top of it, so this screen was
    // never actually seen. Owner decision 4 settles which of the two is the
    // specified form — "the screen keeps the drink, its name and its
    // composition exactly where they were… No takeover, no modal, no spinner"
    // — and only this one can draw them, because a portal over the tab bar
    // never sees a recipe. The portal's brewing branch is gone; the one
    // property it alone had right, the §5.C(ii) abort circle with its word
    // outside it, came here with it.
    //
    // So the busy state ADDS the bar and takes nothing away: the drink, its
    // name and its composition stay put, a square-cut segmented Meter is
    // pinned to the bottom edge between the rails, the activity is the small
    // status word below the strip (§7.4), and one explicitly labelled abort is
    // the only control while a pour whose end we can only ESTIMATE runs.
    //
    // The drink is the CHOSEN RECIPE, not the activity. This screen used to
    // pass the sub-process label ("Grinding") to `CoffeeIcon` as if it were a
    // drink name, which matches no entry in the image table and fell through
    // to the freestyle placeholder every time — invisible for exactly as long
    // as the portal covered it.
    const brewingDrink = selectedRecipe || activity || "";
    const statusWord = activity && activity !== brewingDrink ? activity : "";
    return (
      <div className="relative flex h-full flex-col items-center justify-center gap-6 px-6">
        <DrinkStage size={260} active>
          <CoffeeIcon recipe={brewingDrink || "Espresso"} size={260} />
        </DrinkStage>

        <div className="flex flex-col items-center gap-3 max-w-full">
          {/* §7.2: the drink's name is the largest type on its own screen. */}
          <div className="t-title text-primary text-center">{brewingDrink}</div>
          {hasSelectedDetails && selectedDetails && (
            <RecipeInfo details={selectedDetails} t={t} />
          )}
          {/* §7.4: the status word is the smallest white text on a busy
              screen — the meter carries the message, the word only names it. */}
          {statusWord && (
            <div className="t-label text-primary text-center">{statusWord}</div>
          )}
        </div>

        {/* Jura's rule: while the machine prepares, the only control is the
            universal abort word — and it is a `Word` carrying the §5.C(ii)
            circle as its icon, not a ninth hand-rolled copy of one (C5). It
            wears no rule: an underline in this language says "chosen", and an
            abort is not chosen. */}
        <Word
          label={t("brew.cancel")}
          tone="strong"
          icon={<AbortCircle />}
          onClick={() => safeCall(() => pressButton(conn, cancelId))}
          className="tap-lg"
        />

        {progress && (
          <div
            className="absolute bottom-0"
            style={{ left: "var(--rail)", right: "var(--rail)" }}
          >
            <Meter
              value={progressNum}
              max={100}
              role="progressbar"
              ariaLabel={statusWord || brewingDrink || t("brew.brew")}
            />
          </div>
        )}
      </div>
    );
  }

  if (statusView.offline || statusView.off) {
    return (
      // C26/C27: ONE blocked-page treatment — the 80px state glyph at the one
      // 0.6 knock-down, `t-title` at its declared weight (never a per-page
      // `fontWeight` override), and a 48px rule closing the block. The glyph's
      // `alt="offline"` was hardcoded English; the headline beside it already
      // says it, so the mark is decorative.
      <div className="flex h-full flex-col items-center justify-center px-8">
        <div className="flex flex-col items-center gap-6 max-w-sm">
          <Glyph size="state" src={iconNotConnected} alt="" />
          <div className="text-center">
            <div className="t-title text-primary">{t("brew.offline_title")}</div>
            <div className="t-body text-tertiary mt-2 leading-relaxed">{t("brew.offline_desc")}</div>
          </div>
          <Rule style={{ width: 48, alignSelf: "center" }} />
        </div>
      </div>
    );
  }

  const serviceKeys = statusView.service ? SERVICE_KEYS[statusView.service] : null;
  if (serviceKeys && !isReady && !isBrewing) {
    const serviceTitle =
      statusView.source === "tokens" ? statusView.statusLabel : t(serviceKeys.labelKey);
    // The service-cycle sublabel is machine-domain wording (§6.3.7): the
    // served process description when there is one, else our own copy.
    const serviceSub = statusView.processDescription ?? t(serviceKeys.subKey);
    return (
      // A maintenance programme is the one place whose duration the machine
      // announces before we commit, so it — and only it — gets the §9.1 tick
      // ring, desaturated to `--text-secondary` (§9.4). No track, no capsule,
      // and no numeric percentage: the ring carries the message and the words
      // below it only name it (§7.4).
      <div className="flex h-full flex-col items-center justify-center px-8">
        <div className="flex flex-col items-center max-w-sm">
          {progress ? (
            <TickRing value={progressNum} max={100} tone="service" ariaLabel={serviceTitle}>
              {/* §9.1: the glyph in the ring's centre moat is its own rung —
                  50px with a wide empty ring around it — so it is not one of
                  `Glyph`'s two and cannot adopt it (C27). It is spelled the
                  same 50px the overlay's moat glyph is, rather than a 48px
                  `w-12` with a private `opacity-70`: one role, one size, one
                  value. The hardcoded `alt="service"` is gone either way —
                  the ring already announces the cycle. */}
              <img src={iconService} alt="" aria-hidden="true" className="w-[50px] h-[50px] object-contain" draggable={false} />
            </TickRing>
          ) : (
            <Glyph size="state" src={iconService} alt="" />
          )}
          <div className="text-center" style={{ marginTop: progress ? 59 : 24 }}>
            <div className="t-title text-primary">{serviceTitle}</div>
            <div className="t-body text-tertiary mt-2 leading-relaxed">{serviceSub}</div>
          </div>
          <Rule className="mt-6" style={{ width: 48, alignSelf: "center" }} />
        </div>
      </div>
    );
  }

  const actionLabel = statusView.actionLabel || "";
  const actionHint = statusView.actionHint || "";

  return (
    <div className="relative flex h-full flex-col">
      {hasAction && (
        <div
          className="absolute inset-0 z-30 flex items-center justify-center backdrop-blur-sm"
          /** §5.A: a full-bleed wash under a modal is the removal of the page, not a container fill. */
          data-fill="scrim"
          style={{ backgroundColor: "var(--overlay-bg)" }}
        >
          <div
            className="flex flex-col items-center gap-5 max-w-xs px-8 py-8"
            /** §5.B: the one flat neutral panel — radius 0, no border, no ring, no shadow. */
            data-fill="panel"
            style={{ backgroundColor: "var(--surface)", borderRadius: 0 }}
          >
            <Glyph size="state" src={iconNotConnected} alt="" />
            <div className="text-center">
              <div className="t-title text-primary">{actionLabel}</div>
              {actionHint && <div className="t-body text-tertiary mt-2 leading-relaxed">{actionHint}</div>}
            </div>
          </div>
        </div>
      )}

      {/* Profile switcher — the app's tab idiom, on the page ground.
          The always-dark `--profile-bar-bg` strip with its hard-coded
          `#ffffff` / `rgba(255,255,255,0.4)` tracked-out caps is gone: bare
          words on `--bg`, closed by one rail-to-rail rule, the chosen one
          white over a lit 2px `--accent` underline that sits ON that rule
          (§C6a). The rename gestures live on the wrapper, so long-press,
          double-click and the context-menu suppression all survive. */}
      {isReady && visibleSlots.length > 1 && (
        <div className="shrink-0">
          <div
            className="flex gap-8 overflow-x-auto"
            style={{ paddingLeft: RAIL_TEXT, paddingRight: RAIL_TEXT }}
          >
            {visibleSlots.map((slot) => {
              const opt = profileOptions[slot.slot];
              // Slot-0 name_key label via the reused recipes.category.* server
              // string (§9.3.2); the select option (legacy label) otherwise.
              const label =
                (slot.nameKey !== null
                  ? serverString(`recipes.category.${slot.nameKey}`)
                  : undefined) ?? opt;
              const isActive = opt === selectedProfile;
              const isEditing = editingProfileIdx === slot.slot;

              if (isEditing) {
                // C6: one input form in the app — a line to write on at
                // `--input-border`, not a third hairline weight invented for
                // this row. It keeps the nav row's 60px pitch and centred
                // text so renaming a profile does not shift the strip.
                return (
                  <span
                    key={slot.slot}
                    className="inline-flex"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Field
                      value={editingProfileName}
                      onChange={setEditingProfileName}
                      autoFocus
                      ariaLabel={label}
                      onBlur={commitProfileName}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitProfileName();
                        if (e.key === "Escape") setEditingProfileIdx(null);
                      }}
                      inputClassName="text-center min-w-[80px]"
                      inputStyle={{ minHeight: "var(--tap-lg)" }}
                    />
                  </span>
                );
              }

              return (
                <span
                  key={slot.slot}
                  className="inline-flex"
                  onDoubleClick={() => handleProfileDoubleClick(slot, opt)}
                  onPointerDown={() => startLongPress(slot, opt)}
                  onPointerUp={cancelLongPress}
                  onPointerLeave={cancelLongPress}
                  onContextMenu={(e) => e.preventDefault()}
                >
                  <Option
                    level="nav"
                    label={label}
                    selected={isActive}
                    onSelect={() => handleProfileClick(slot.slot, opt)}
                    className="whitespace-nowrap"
                  />
                </span>
              );
            })}
          </div>
          <Rule rail />
        </div>
      )}

      {/* DirectKey recipe grid */}
      {isReady && hasDkRecipes && (
        <div className="shrink-0">
          <Mosaic
            id="directkey-mosaic"
            // The band is one row: as many columns as it has tiles, so it
            // never invents an empty slot. A machine with fewer categories
            // gets wider tiles, not a hole.
            columns={directKeyTiles.length + 1}
            count={directKeyTiles.length + 1}
          >
            {/* Served category order (§9.3.6 rule 2); machine_button false →
                hidden, matching the legacy hard omission of milk (§9.3.1 —
                the BLE brew path itself is never disabled by the flag). */}
            {directKeyTiles.map((entry) => {
              const cat = entry.category;
              const recipe = activeProfileRecipes[cat];
              if (!recipe) return null;
              const label = directKeyCategoryLabel(locale, cat);
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
                  aria-pressed={isSelected}
                  // OWNER DECISION 2: the selected tile IS the screen's one
                  // commit rectangle — solid `--accent`, radius 0, reading
                  // "Brew <drink>". Unselected it paints only the mosaic's
                  // own ground so the 1px gaps read as hairlines.
                  data-ui={isSelected ? "commit" : undefined}
                  data-fill={isSelected ? "commit" : "rule"}
                  // C12 — ONE COMPOSITION FOR A MOSAIC TILE, AND THIS IS IT.
                  // The two hairline mosaics in the app were built two ways:
                  // this band pinned its caption absolutely inside a `pb-9`
                  // reservation while the stats tile let its label and figure
                  // flow under the drink on `p-2 pb-3`. The flow form is the
                  // one both now use — it is the same mechanism §R1.5 already
                  // uses for a drink cell (a hard-reserved band, in flow),
                  // it survives a second flow line the way the stats tile's
                  // figure needs, and it needs no z-index to sit above the
                  // composition overlay. What the pinning bought — the glyph
                  // never moving when the caption swaps `t-label` → `t-body`
                  // on arming — is bought instead by the caption band's fixed
                  // height below.
                  className="tap press relative flex flex-col items-center justify-center overflow-hidden p-2 pb-3"
                  style={{
                    backgroundColor: isSelected ? "var(--accent)" : "var(--bg)",
                    // An armed tile IS this screen's commit rectangle, so it
                    // takes the family's commit material too — otherwise
                    // obsidian's chrome ramp stops at the page-level commit and
                    // the same act is painted two ways.
                    backgroundImage: isSelected ? "var(--commit-fill)" : undefined,
                    borderRadius: 0,
                    boxShadow: "none",
                    minHeight: "var(--tap-lg)",
                  }}
                >
                  <div className={isSelected && hasDetails ? "recipe-icon-fade" : ""}>
                    {/* Served recipe IconSpec where a row exists (§9.3.6 rule
                        2); the frozen display label drives the legacy PNG
                        lookup fallback inside CoffeeIcon. */}
                    <CoffeeIcon
                      recipe={DK_RECIPE_ICON[cat] ?? label}
                      icon={recipe.icon ?? null}
                      size={64}
                    />
                  </div>
                  {isSelected && hasDetails && (
                    // `recipe-overlay-enter` is retired here: its keyframe
                    // animates `backdrop-filter: blur(1px)`, and a blur is
                    // only ever licensed on a scrim (§S4.7). The strip's own
                    // per-group `recipe-item-enter` stagger is the arrival.
                    <div className="absolute inset-0 flex flex-col items-center justify-center px-1">
                      <RecipeInfo details={recipe} compact animated onAccent t={t} />
                    </div>
                  )}
                  {/* C3 — ONE VERB, ONE SCALE BAND. Armed, this span is the
                      label of the screen's commit rectangle, so it takes the
                      commit's in-container step, `t-body` (§7.7); at rest it
                      is a mosaic tile's caption and stays `t-label`. "Brew"
                      used to be set at `t-label` here against `t-title` on
                      the page commit two metres away — three of the four type
                      steps for one verb. It is now two adjacent ones.

                      C12: in flow, not pinned — with the band's height and
                      leading fixed, so the two type steps occupy exactly the
                      same box and arming a tile never moves the glyph. */}
                  <span
                    className={`relative z-10 mt-1 w-full truncate px-1 text-center transition-colors duration-300 ${
                      isSelected ? "t-body" : "t-label"
                    }`}
                    style={{
                      height: "1.75rem",
                      lineHeight: "1.75rem",
                      color: isSelected ? "var(--text-inverse)" : "var(--text-tertiary)",
                      fontWeight: isSelected ? 600 : 500,
                    }}
                  >
                    {isSelected ? `${t("brew.brew")} ${label}` : label}
                  </span>
                </button>
              );
            })}

            {/* 2x toggle — brew two cups */}
            {/* A modifier, not a commit: it never fills. On = the glyph at
                full value and the word white over a lit 1px `--accent` rule
                along the tile's bottom edge; off = the same word quiet over a
                transparent rule that is already reserved (§C3.1). */}
            <button
              onClick={() => setTwoCups((v) => !v)}
              aria-pressed={twoCups}
              data-fill="rule"
              /** C12: the same mosaic-tile composition as its neighbours. */
              className="tap press relative flex flex-col items-center justify-center overflow-hidden p-2 pb-3"
              style={{
                backgroundColor: "var(--bg)",
                borderRadius: 0,
                minHeight: "var(--tap-lg)",
              }}
            >
              <div className="flex items-center justify-center" style={{ width: 64, height: 64 }}>
                <img
                  src={isDark ? iconTwoCupsWhite : iconTwoCups}
                  // Decorative: the word below is the button's own label, and
                  // `alt="2x"` was a hardcoded string duplicating it.
                  alt=""
                  aria-hidden="true"
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
                className="relative z-10 mt-1 w-full truncate px-1 text-center t-label transition-colors duration-300"
                data-underline={twoCups ? "lit" : "reserved"}
                style={{
                  height: "1.75rem",
                  lineHeight: "1.75rem",
                  color: twoCups ? "var(--text-primary)" : "var(--text-tertiary)",
                  fontWeight: twoCups ? 600 : 500,
                  ...underlineSlot(twoCups),
                }}
              >
                {twoCups ? t("brew.two_cups_on") : t("brew.two_cups")}
              </span>
            </button>
          </Mosaic>
        </div>
      )}

      {editingDk && (
        <RecipeEditModal
          conn={conn}
          brewEntityId={brewId}
          category={editingDk.category}
          categoryLabel={directKeyCategoryLabel(locale, editingDk.category)}
          recipe={editingDk.recipe}
          profileId={activeProfileId}
          contract={contract}
          onClose={() => {
            setEditingDk(null);
            // The recipes/list lane is polled, not pushed — refetch so a
            // saved slot shows immediately (legacy-attribute responsiveness).
            setListGen((g) => g + 1);
          }}
        />
      )}

      {isReady && sortedRecipeOptions.length > 0 && (
        <div className="flex-1 min-h-0 flex flex-col">
          {/* Divider with view mode toggle */}
          <div
            className="shrink-0 flex items-center gap-3 py-1.5"
            style={{ paddingLeft: "var(--rail)", paddingRight: "var(--rail)" }}
          >
            <Rule variant="inline" tone="divider" fadeToward="end" style={{ flex: "1 1 0%" }} />
            {hasDkRecipes && (
              <span className="t-label" style={{ color: "var(--text-secondary)" }}>
                {t("brew.all_recipes")}
              </span>
            )}
            <ViewModeToggle />
            <Rule variant="inline" tone="divider" fadeToward="start" style={{ flex: "1 1 0%" }} />
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
              <div className="flex-1 min-h-0 overflow-y-auto custom-scroll">
                {sortedRecipeOptions.map((opt) => {
                  const isSelected = opt === selectedRecipe && !selectedDk;
                  return (
                    <div key={opt}>
                      {/* H12 — SELECTION IS NEVER A FILL. This row used to say
                          "chosen" with a 2px `--accent` gutter painted down
                          its left edge. Owner decision 1 fixes selection for
                          every control in the app as one mark, and it is not
                          that one: the name turns `--text-primary` over a lit
                          1px `--accent` underline in a slot that is ALWAYS
                          declared, so nothing shifts — byte-identical to what
                          the grid cell does two views away (RecipeCard). A
                          gutter tick was a third selection idiom and an accent
                          fill marking a chosen option, which §8.2 withholds.
                          Hover still changes colour only (§C3.4). */}
                      <button
                        onClick={() => handleCarouselSelect(opt)}
                        onPointerEnter={() => setHoveredRecipe(opt)}
                        onPointerLeave={() => setHoveredRecipe((h) => h === opt ? null : h)}
                        aria-pressed={isSelected}
                        data-ui="recipe-row"
                        data-underline={isSelected ? "lit" : "reserved"}
                        className="tap press w-full min-w-0 flex items-center gap-3 px-4"
                        style={{ borderRadius: 0 }}
                      >
                        <CoffeeIcon recipe={opt} size={36} />
                        <span
                          data-ui="recipe-name"
                          className="t-label text-left truncate transition-colors duration-300"
                          style={{
                            color:
                              isSelected || hoveredRecipe === opt
                                ? "var(--text-primary)"
                                : "var(--text-secondary)",
                            fontWeight: isSelected ? 600 : 400,
                            ...underlineSlot(isSelected),
                          }}
                        >
                          {opt}
                        </span>
                      </button>
                      <Rule variant="inline" tone="border-hover" className="ml-4" />
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
                      isSelected: !selectedDk,
                      details: selectedDetails,
                    }}
                    active
                    hovered={false}
                    size="large"
                    onClick={handleCarouselBrew}
                    onPointerEnter={() => {}}
                    onPointerLeave={() => {}}
                    renderInfo={carouselRenderInfo}
                    className="pt-4 px-4 pb-3 h-full"
                  />
                  {/* Brew — the one action band (C10), width locked to this
                      45% pane rather than to the button's own padding. The
                      commit stands down while a DirectKey tile holds the
                      screen's one commit rectangle; the band's 2px accent
                      rule stays, so the pane never resizes. */}
                  <ActionBand
                    inset="none"
                    className="w-full px-4"
                    style={{ minHeight: "calc(var(--tap-lg) + 2rem + 2px)" }}
                    commit={
                      selectedDk ? undefined : (
                        <Commit label={t("brew.brew")} onCommit={handleCarouselBrew} />
                      )
                    }
                  />
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
