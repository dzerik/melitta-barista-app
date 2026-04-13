import { useState } from "react";
import { Sparkles, Shuffle, Loader2 } from "lucide-react";
import { usePreferences } from "../lib/preferences";
import type { TranslationKey } from "../lib/i18n";
import type { useSommelier } from "../hooks/useSommelier";
import { SommelierRecipeCard } from "./SommelierRecipeCard";

type SommelierHook = ReturnType<typeof useSommelier>;

interface Props {
  sommelier: SommelierHook;
}

const MOODS = ["energizing", "relaxing", "dessert", "classic"] as const;
const OCCASIONS = ["morning", "after_lunch", "guests", "romantic", "work"] as const;
const TEMPS = ["auto", "hot", "iced"] as const;

export function SommelierGenerate({ sommelier }: Props) {
  const { t } = usePreferences();
  const { hoppers, milkTypes, extras, currentSession, generating, favorites, generate, brewRecipe, addFavorite } = sommelier;
  const [preference, setPreference] = useState("");
  const [count, setCount] = useState(3);
  const [brewingId, setBrewingId] = useState<string | null>(null);
  const [mood, setMood] = useState<string>("");
  const [occasion, setOccasion] = useState<string>("");
  const [temperature, setTemperature] = useState<string>("auto");
  const [servings, setServings] = useState(1);

  const favIds = new Set(favorites.map((f) => f.source_recipe_id));

  const hasIce = (extras?.syrups?.length ?? 0) > 0 || (extras?.toppings?.length ?? 0) > 0 || (extras?.liqueurs?.length ?? 0) > 0;

  const handleGenerate = () => generate("generate", preference || undefined, count, {
    mood: mood || undefined,
    occasion: occasion || undefined,
    temperature: temperature !== "auto" ? temperature : undefined,
    servings: servings > 1 ? servings : undefined,
  });
  const handleSurprise = () => generate("surprise_me", undefined, count, {
    mood: mood || undefined,
    occasion: occasion || undefined,
    temperature: temperature !== "auto" ? temperature : undefined,
    servings: servings > 1 ? servings : undefined,
  });

  const handleBrew = async (id: string) => {
    setBrewingId(id);
    try { await brewRecipe(id); } finally { setBrewingId(null); }
  };

  const renderHopper = (num: 1 | 2) => {
    const hopper = num === 1 ? hoppers.hopper1 : hoppers.hopper2;
    const bean = hopper?.bean;
    return (
      <div
        className="flex-1 rounded-xl ring-1 ring-border p-3"
        style={{ background: "var(--surface-card)" }}
      >
        <div className="text-[10px] font-medium text-tertiary uppercase tracking-wider mb-1.5">
          {t(`sommelier.hopper${num}` as TranslationKey)}
        </div>
        {bean ? (
          <>
            <div className="text-sm font-medium text-primary truncate">{bean.brand}</div>
            <div className="text-xs text-secondary truncate">{bean.product}</div>
            <div className="flex flex-wrap gap-1 mt-1.5">
              {bean.flavor_notes.slice(0, 3).map((note) => (
                <span key={note} className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "var(--surface)", color: "var(--text-tertiary)" }}>
                  {t(`sommelier.note_${note}` as TranslationKey)}
                </span>
              ))}
            </div>
          </>
        ) : (
          <div className="text-xs text-tertiary italic">{t("sommelier.not_configured" as TranslationKey)}</div>
        )}
      </div>
    );
  };

  const chipStyle = (active: boolean) => ({
    background: active ? "var(--btn-primary-bg)" : "var(--surface-card)",
    color: active ? "var(--btn-primary-text)" : "var(--text-secondary)",
    "--tw-ring-color": active ? "transparent" : "var(--border)",
  } as React.CSSProperties);

  return (
    <div className="space-y-5">
      {/* Hoppers */}
      <div className="flex gap-3">
        {renderHopper(1)}
        {renderHopper(2)}
      </div>

      {/* Milk tags */}
      {milkTypes.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <span className="text-[10px] font-medium text-tertiary uppercase tracking-wider self-center mr-1">
            {t("sommelier.milk" as TranslationKey)}:
          </span>
          {milkTypes.map((m) => (
            <span key={m} className="text-[11px] px-2 py-0.5 rounded-full ring-1 ring-border" style={{ background: "var(--surface-card)", color: "var(--text-secondary)" }}>
              {m}
            </span>
          ))}
        </div>
      )}

      {/* Mood selector */}
      <div>
        <div className="text-[10px] font-medium text-tertiary uppercase tracking-wider mb-2">
          {t("sommelier.mood" as TranslationKey)}
        </div>
        <div className="flex flex-wrap gap-2">
          {MOODS.map((m) => (
            <button
              key={m}
              onClick={() => setMood(mood === m ? "" : m)}
              aria-pressed={mood === m}
              aria-label={t(`sommelier.mood_${m}` as TranslationKey)}
              className="rounded-full px-3 py-1.5 text-xs font-medium transition active:scale-95 ring-1"
              style={chipStyle(mood === m)}
            >
              {t(`sommelier.mood_${m}` as TranslationKey)}
            </button>
          ))}
        </div>
      </div>

      {/* Occasion selector */}
      <div>
        <div className="text-[10px] font-medium text-tertiary uppercase tracking-wider mb-2">
          {t("sommelier.occasion" as TranslationKey)}
        </div>
        <div className="flex flex-wrap gap-2">
          {OCCASIONS.map((o) => (
            <button
              key={o}
              onClick={() => setOccasion(occasion === o ? "" : o)}
              aria-pressed={occasion === o}
              aria-label={t(`sommelier.occasion_${o}` as TranslationKey)}
              className="rounded-full px-3 py-1.5 text-xs font-medium transition active:scale-95 ring-1"
              style={chipStyle(occasion === o)}
            >
              {t(`sommelier.occasion_${o}` as TranslationKey)}
            </button>
          ))}
        </div>
      </div>

      {/* Temperature toggle — show only if extras exist (ice available) */}
      {hasIce && (
        <div>
          <div className="text-[10px] font-medium text-tertiary uppercase tracking-wider mb-2">
            {t("sommelier.temp_pref" as TranslationKey)}
          </div>
          <div className="flex gap-2">
            {TEMPS.map((tmp) => (
              <button
                key={tmp}
                onClick={() => setTemperature(tmp)}
                aria-pressed={temperature === tmp}
                aria-label={t(`sommelier.temp_${tmp}` as TranslationKey)}
                className="rounded-full px-3 py-1.5 text-xs font-medium transition active:scale-95 ring-1"
                style={chipStyle(temperature === tmp)}
              >
                {t(`sommelier.temp_${tmp}` as TranslationKey)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Servings */}
      <div className="flex items-center gap-3">
        <span className="text-[10px] font-medium text-tertiary uppercase tracking-wider">
          {t("sommelier.servings" as TranslationKey)}
        </span>
        <div className="flex gap-1.5">
          {[1, 2, 3, 4].map((n) => (
            <button
              key={n}
              onClick={() => setServings(n)}
              className="w-8 h-8 rounded-lg text-xs font-semibold transition active:scale-95 ring-1"
              style={chipStyle(servings === n)}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Preference input */}
      <div>
        <input
          type="text"
          value={preference}
          onChange={(e) => setPreference(e.target.value)}
          placeholder={t("sommelier.preference_placeholder" as TranslationKey)}
          className="w-full rounded-xl px-4 py-3 text-sm ring-1 ring-border outline-none transition focus:ring-2"
          style={{ background: "var(--surface-card)", color: "var(--text-primary)", "--tw-ring-color": "var(--border)" } as React.CSSProperties}
        />
      </div>

      {/* Actions row */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSurprise}
          disabled={generating}
          className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition active:scale-[0.97]"
          style={{ background: "var(--btn-primary-bg)", color: "var(--btn-primary-text)", opacity: generating ? 0.5 : 1 }}
        >
          <Shuffle size={16} />
          {t("sommelier.surprise_me" as TranslationKey)}
        </button>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold ring-1 ring-border transition active:scale-[0.97]"
          style={{ background: "var(--surface-card)", color: "var(--text-primary)", opacity: generating ? 0.5 : 1 }}
        >
          <Sparkles size={16} />
          {t("sommelier.generate" as TranslationKey)}
        </button>
        <select
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
          className="rounded-xl px-3 py-3 text-sm ring-1 ring-border outline-none"
          style={{ background: "var(--surface-card)", color: "var(--text-primary)" }}
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </div>

      {/* Generating spinner */}
      {generating && (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={24} className="animate-spin text-secondary" />
          <span className="ml-3 text-sm text-secondary">{t("sommelier.generating" as TranslationKey)}</span>
        </div>
      )}

      {/* Generated recipes */}
      {currentSession && !generating && (
        <div className="space-y-3">
          <div className="text-[10px] font-medium text-tertiary uppercase tracking-wider">
            {t("sommelier.results" as TranslationKey)} ({currentSession.recipes.length})
          </div>
          {currentSession.recipes.map((recipe) => (
            <SommelierRecipeCard
              key={recipe.id}
              recipe={recipe}
              onBrew={handleBrew}
              onFavorite={addFavorite}
              isFavorited={favIds.has(recipe.id)}
              brewing={brewingId === recipe.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
