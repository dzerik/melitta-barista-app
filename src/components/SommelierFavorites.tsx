import { useState } from "react";
import { Coffee, Trash2, Star } from "lucide-react";
import { usePreferences } from "../lib/preferences";
import type { TranslationKey } from "../lib/i18n";
import type { useSommelier } from "../hooks/useSommelier";

type SommelierHook = ReturnType<typeof useSommelier>;

interface Props {
  sommelier: SommelierHook;
}

export function SommelierFavorites({ sommelier }: Props) {
  const { t } = usePreferences();
  const { favorites, brewFavorite, removeFavorite } = sommelier;
  const [brewingId, setBrewingId] = useState<string | null>(null);

  const handleBrew = async (id: string) => {
    setBrewingId(id);
    try { await brewFavorite(id); } finally { setBrewingId(null); }
  };

  if (favorites.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <Star size={40} className="text-tertiary opacity-40" />
        <div className="text-sm text-tertiary text-center">
          {t("sommelier.no_favorites" as TranslationKey)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {favorites.map((fav) => (
        <div
          key={fav.id}
          className="rounded-xl ring-1 ring-border p-4 transition-all duration-200"
          style={{ background: "var(--surface-card)" }}
        >
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-primary truncate">{fav.name}</span>
                {fav.brew_count > 0 && (
                  <span
                    className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full tabular-nums"
                    style={{ background: "var(--surface)", color: "var(--text-tertiary)" }}
                  >
                    x{fav.brew_count}
                  </span>
                )}
              </div>
              <p className="text-xs text-secondary mt-1 line-clamp-2">{fav.description}</p>
              {fav.last_brewed_at && (
                <div className="text-[10px] text-tertiary mt-1.5">
                  {t("sommelier.last_brewed" as TranslationKey)}: {new Date(fav.last_brewed_at).toLocaleDateString()}
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => handleBrew(fav.id)}
                disabled={brewingId === fav.id}
                className="rounded-xl px-3 py-2 text-xs font-semibold transition active:scale-95"
                style={{
                  background: "var(--btn-primary-bg)",
                  color: "var(--btn-primary-text)",
                  opacity: brewingId === fav.id ? 0.5 : 1,
                }}
              >
                {brewingId === fav.id ? "..." : (
                  <span className="flex items-center gap-1.5">
                    <Coffee size={14} />
                    {t("sommelier.brew" as TranslationKey)}
                  </span>
                )}
              </button>
              <button
                onClick={() => removeFavorite(fav.id)}
                className="p-2 rounded-lg text-tertiary hover:text-red-400 transition"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
