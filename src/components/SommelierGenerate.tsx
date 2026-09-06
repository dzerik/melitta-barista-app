import { useState } from "react";
import { Sparkles, Shuffle, Loader2 } from "lucide-react";
import { usePreferences } from "../lib/preferences";
import type { TranslationKey } from "../lib/i18n";
import type { useSommelier } from "../hooks/useSommelier";
import { sommelierTokens, sommelierLabel, suggestionLabel } from "../lib/sommelier-vocab";
import { SommelierRecipeCard } from "./SommelierRecipeCard";

type SommelierHook = ReturnType<typeof useSommelier>;

interface Props {
  sommelier: SommelierHook;
}

/**
 * One labelled row of choices, in the machine's idiom: a quiet label, the
 * options as plain words, the chosen one lit in crema and underlined. The
 * outlined capsule this used to be is the tell of a generic UI kit — a coffee
 * machine's screen never draws one.
 */
function OptionRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex flex-wrap items-baseline gap-x-6 gap-y-1 border-t"
      style={{ borderColor: "var(--border)" }}
    >
      <span className="t-label text-tertiary w-28 shrink-0">{label}</span>
      <div className="flex flex-wrap items-baseline gap-x-6">{children}</div>
    </div>
  );
}

export function SommelierGenerate({ sommelier }: Props) {
  const { t, locale } = usePreferences();
  const { hoppers, milkTypes, extras, currentSession, generating, favorites, generate, brewRecipe, addFavorite } = sommelier;
  const [preference, setPreference] = useState("");
  const [count, setCount] = useState(3);
  const [brewingId, setBrewingId] = useState<string | null>(null);
  const [mood, setMood] = useState<string>("");
  const [occasion, setOccasion] = useState<string>("");
  const [temperature, setTemperature] = useState<string>("auto");
  const [servings, setServings] = useState(1);

  const favIds = new Set(favorites.map((f) => f.source_recipe_id));

  // §9.2.6.1 pickers: served vocab tokens → hardcoded fallback lists.
  const moods = sommelierTokens("mood");
  const occasions = sommelierTokens("occasion");
  const temps = sommelierTokens("temperature");

  const hasIce = (extras?.syrups?.length ?? 0) > 0 || (extras?.toppings?.length ?? 0) > 0 || (extras?.liqueurs?.length ?? 0) > 0;

  const options = {
    mood: mood || undefined,
    occasion: occasion || undefined,
    temperature: temperature !== "auto" ? temperature : undefined,
    servings: servings > 1 ? servings : undefined,
  };
  const handleGenerate = () => generate("generate", preference || undefined, count, options);
  const handleSurprise = () => generate("surprise_me", undefined, count, options);

  const handleBrew = async (id: string) => {
    setBrewingId(id);
    try { await brewRecipe(id); } finally { setBrewingId(null); }
  };

  const option = (
    key: string,
    label: string,
    active: boolean,
    onClick: () => void,
  ) => (
    <button
      key={key}
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      className="tap press t-body"
      style={{
        color: active ? "var(--accent)" : "var(--text-secondary)",
        borderBottom: active ? "1px solid var(--accent)" : "1px solid transparent",
      }}
    >
      {label}
    </button>
  );

  /** What is loaded in the machine right now — context, not a control. */
  const renderHopper = (num: 1 | 2) => {
    const hopper = num === 1 ? hoppers?.hopper1 : hoppers?.hopper2;
    const bean = hopper?.bean;
    return (
      <div
        className={`flex-1 min-w-0 ${num === 2 ? "border-l pl-6 ml-6" : ""}`}
        style={num === 2 ? { borderColor: "var(--border)" } : undefined}
      >
        <div className="t-label text-tertiary">
          {t(`sommelier.hopper${num}` as TranslationKey)}
        </div>
        {bean ? (
          <>
            <div className="t-body text-primary truncate">
              {bean.brand}
              {bean.product ? ` · ${bean.product}` : ""}
            </div>
            {bean.flavor_notes.length > 0 && (
              <div className="t-label text-tertiary truncate">
                {bean.flavor_notes
                  .slice(0, 3)
                  .map((note) => suggestionLabel(locale, "note_", note))
                  .join(" · ")}
              </div>
            )}
          </>
        ) : (
          <div className="t-label text-tertiary">
            {t("sommelier.not_configured" as TranslationKey)}
            <span className="block">{t("sommelier.configure_in_ha" as TranslationKey)}</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* What the machine is loaded with — one quiet strip, not two cards
          the size of the brief itself. */}
      <div className="flex flex-wrap gap-y-3">
        {renderHopper(1)}
        {renderHopper(2)}
        {milkTypes.length > 0 && (
          <div className="flex-1 min-w-0 border-l pl-6 ml-6" style={{ borderColor: "var(--border)" }}>
            <div className="t-label text-tertiary">{t("sommelier.milk" as TranslationKey)}</div>
            <div className="t-body text-primary truncate">
              {milkTypes.map((m) => suggestionLabel(locale, "milk_", m)).join(" · ")}
            </div>
          </div>
        )}
      </div>

      {/* The brief: what you feel like. The free text leads — it is the one
          field that can say something the chips cannot. */}
      <div className="space-y-4">
        <input
          type="text"
          value={preference}
          onChange={(e) => setPreference(e.target.value)}
          placeholder={t("sommelier.preference_placeholder" as TranslationKey)}
          className="tap tap-lg w-full bg-transparent border-b px-0 t-body outline-none transition"
          style={{ borderColor: "var(--border-hover)", color: "var(--text-primary)" }}
        />

        <div className="space-y-3">
          <OptionRow label={t("sommelier.mood" as TranslationKey)}>
            {moods.map((m) =>
              option(m, sommelierLabel(locale, "mood", m), mood === m, () =>
                setMood(mood === m ? "" : m),
              ),
            )}
          </OptionRow>

          <OptionRow label={t("sommelier.occasion" as TranslationKey)}>
            {occasions.map((o) =>
              option(o, sommelierLabel(locale, "occasion", o), occasion === o, () =>
                setOccasion(occasion === o ? "" : o),
              ),
            )}
          </OptionRow>

          {hasIce && (
            <OptionRow label={t("sommelier.temp_pref" as TranslationKey)}>
              {temps.map((tmp) =>
                option(tmp, sommelierLabel(locale, "temperature", tmp), temperature === tmp, () =>
                  setTemperature(tmp),
                ),
              )}
            </OptionRow>
          )}

          <OptionRow label={t("sommelier.servings" as TranslationKey)}>
            {[1, 2, 3, 4].map((n) =>
              option(String(n), String(n), servings === n, () => setServings(n)),
            )}
          </OptionRow>

          <OptionRow label={t("sommelier.count" as TranslationKey)}>
            {[1, 2, 3, 4, 5].map((n) =>
              option(`c${n}`, String(n), count === n, () => setCount(n)),
            )}
          </OptionRow>
        </div>
      </div>

      {/* One way in, and a second for when you have no idea. */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="tap tap-lg press flex items-center justify-center gap-2 rounded-md px-16 t-body font-semibold tracking-wide"
          style={{ background: "var(--btn-primary-bg)", color: "var(--btn-primary-text)", opacity: generating ? 0.5 : 1 }}
        >
          <Sparkles size={18} />
          {t("sommelier.generate" as TranslationKey)}
        </button>
        <button
          onClick={handleSurprise}
          disabled={generating}
          className="tap tap-lg press flex items-center justify-center gap-2 rounded-md px-6 t-body border"
          style={{ borderColor: "var(--border-hover)", color: "var(--text-secondary)", opacity: generating ? 0.5 : 1 }}
        >
          <Shuffle size={18} />
          {t("sommelier.surprise_me" as TranslationKey)}
        </button>
      </div>

      {generating && (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={24} className="animate-spin text-secondary" />
          <span className="ml-3 t-body text-secondary">{t("sommelier.generating" as TranslationKey)}</span>
        </div>
      )}

      {currentSession && !generating && (
        <div className="space-y-3">
          <h2 className="t-label text-tertiary">
            {t("sommelier.results" as TranslationKey)}
          </h2>
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(26rem, 1fr))" }}>
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
        </div>
      )}
    </div>
  );
}
