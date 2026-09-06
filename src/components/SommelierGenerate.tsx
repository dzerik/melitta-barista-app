import { useState } from "react";
import { Sparkles, Shuffle } from "lucide-react";
import { usePreferences } from "../lib/preferences";
import type { TranslationKey } from "../lib/i18n";
import type { useSommelier } from "../hooks/useSommelier";
import { sommelierTokens, sommelierLabel, suggestionLabel } from "../lib/sommelier-vocab";
import { Option } from "./ui/Option";
import { OptionRow } from "./ui/OptionRow";
import { Commit } from "./ui/Commit";
import { Rule } from "./ui/Rule";
import { SommelierRecipeCard, SommelierShelf, SOMMELIER_COLUMNS } from "./SommelierRecipeCard";

type SommelierHook = ReturnType<typeof useSommelier>;

interface Props {
  sommelier: SommelierHook;
}

/** Which of the two ways in is running, so only the acting control goes quiet (§10). */
type Pending = "generate" | "surprise" | null;

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
  const [pending, setPending] = useState<Pending>(null);

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
  const handleGenerate = () => {
    setPending("generate");
    generate("generate", preference || undefined, count, options);
  };
  const handleSurprise = () => {
    setPending("surprise");
    generate("surprise_me", undefined, count, options);
  };
  // `pending` is only ever read while `generating` is true, so it needs no
  // reset: the next run overwrites it before it can be seen again.

  const handleBrew = async (id: string) => {
    setBrewingId(id);
    try { await brewRecipe(id); } finally { setBrewingId(null); }
  };

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
    <div className="flex h-full min-h-0 flex-col">
      {/* The brief. Everything above the rule is what you are asking for —
          text and controls hang 10px inside the rail the rule spans (§G2.1);
          the shelf of drinks below runs the full rail width, as structure. */}
      <div
        className="shrink-0 space-y-4 py-4"
        style={{ paddingLeft: "10px", paddingRight: "10px" }}
      >
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

        {/* The free text leads — it is the one field that can say something
            the words below cannot. A line to write on, never a filled box. */}
        <input
          type="text"
          value={preference}
          onChange={(e) => setPreference(e.target.value)}
          placeholder={t("sommelier.preference_placeholder" as TranslationKey)}
          className="tap tap-lg w-full bg-transparent border-b px-0 t-body outline-none transition"
          style={{ borderColor: "var(--border-hover)", color: "var(--text-primary)", borderRadius: 0 }}
        />

        {/* Two columns of labelled hairline rows: the brief has to leave the
            page room for the drinks it produces, and the tab does not scroll. */}
        <div className="grid grid-cols-2 gap-x-8">
          <OptionRow label={t("sommelier.mood" as TranslationKey)} labelWidth="5.5rem">
            {moods.map((m) => (
              <Option
                key={m}
                label={sommelierLabel(locale, "mood", m)}
                selected={mood === m}
                onSelect={() => setMood(mood === m ? "" : m)}
              />
            ))}
          </OptionRow>

          <OptionRow label={t("sommelier.occasion" as TranslationKey)} labelWidth="5.5rem">
            {occasions.map((o) => (
              <Option
                key={o}
                label={sommelierLabel(locale, "occasion", o)}
                selected={occasion === o}
                onSelect={() => setOccasion(occasion === o ? "" : o)}
              />
            ))}
          </OptionRow>

          {hasIce && (
            <OptionRow label={t("sommelier.temp_pref" as TranslationKey)} labelWidth="5.5rem">
              {temps.map((tmp) => (
                <Option
                  key={tmp}
                  label={sommelierLabel(locale, "temperature", tmp)}
                  selected={temperature === tmp}
                  onSelect={() => setTemperature(tmp)}
                />
              ))}
            </OptionRow>
          )}

          <OptionRow label={t("sommelier.servings" as TranslationKey)} labelWidth="5.5rem">
            {[1, 2, 3, 4].map((n) => (
              <Option
                key={n}
                label={String(n)}
                selected={servings === n}
                onSelect={() => setServings(n)}
              />
            ))}
          </OptionRow>

          <OptionRow label={t("sommelier.count" as TranslationKey)} labelWidth="5.5rem">
            {[1, 2, 3, 4, 5].map((n) => (
              <Option
                key={n}
                label={String(n)}
                selected={count === n}
                onSelect={() => setCount(n)}
              />
            ))}
          </OptionRow>
        </div>

        {/* One committing action; the second way in is a word (§C3.5). Its
            width is the brief's own column — never a padding figure. */}
        <div className="flex items-center gap-6">
          <div className="flex-1 min-w-0">
            <Commit
              label={t("sommelier.generate" as TranslationKey)}
              busyLabel={t("sommelier.generating" as TranslationKey)}
              busy={generating && pending !== "surprise"}
              disabled={generating && pending === "surprise"}
              icon={<Sparkles size={18} />}
              onCommit={handleGenerate}
            />
          </div>
          <button
            type="button"
            onClick={handleSurprise}
            disabled={generating}
            aria-label={t("sommelier.surprise_me" as TranslationKey)}
            className="tap tap-lg press t-body shrink-0 gap-2"
            style={{
              color: "var(--text-secondary)",
              borderRadius: 0,
              opacity: generating ? (pending === "surprise" ? 0.5 : 0.35) : 1,
              pointerEvents: generating ? "none" : undefined,
            }}
          >
            <Shuffle size={18} aria-hidden="true" />
            {t("sommelier.surprise_me" as TranslationKey)}
          </button>
        </div>
      </div>

      <Rule />

      {/* The drinks the brief produced. */}
      <div className="flex min-h-0 flex-1 flex-col pt-3">
        {generating && (
          <div className="flex flex-1 items-center justify-center gap-3">
            {/* §9.3 — the subject glyph breathes; there is no spinner left. */}
            <Sparkles size={24} className="status-icon-pulse text-secondary" aria-hidden="true" />
            <span className="t-body text-secondary">
              {t("sommelier.generating" as TranslationKey)}
            </span>
          </div>
        )}

        {currentSession && !generating && (
          <>
            <h2 className="t-label text-tertiary shrink-0" style={{ paddingLeft: "10px" }}>
              {t("sommelier.results" as TranslationKey)}
            </h2>
            <div className="min-h-0 flex-1">
              {/* One row of drinks, paged — the brief above it has to leave
                  the page room for what it produced (§G2.2, no scroll). */}
              <SommelierShelf
                items={currentSession.recipes}
                perPage={SOMMELIER_COLUMNS}
                cellKey={(recipe) => recipe.id}
                renderCell={(recipe, i) => (
                  <SommelierRecipeCard
                    recipe={recipe}
                    onBrew={handleBrew}
                    onFavorite={addFavorite}
                    isFavorited={favIds.has(recipe.id)}
                    brewing={brewingId === recipe.id}
                    enterIndex={i}
                  />
                )}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
