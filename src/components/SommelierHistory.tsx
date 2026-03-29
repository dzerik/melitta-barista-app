import { Check, X, Sparkles, Shuffle, Clock } from "lucide-react";
import { usePreferences } from "../lib/preferences";
import type { TranslationKey } from "../lib/i18n";
import type { useSommelier } from "../hooks/useSommelier";

type SommelierHook = ReturnType<typeof useSommelier>;

interface Props {
  sommelier: SommelierHook;
}

function groupByDate(sessions: SommelierHook["history"]): Record<string, typeof sessions> {
  const groups: Record<string, typeof sessions> = {};
  for (const s of sessions) {
    const date = new Date(s.created_at).toLocaleDateString();
    (groups[date] ??= []).push(s);
  }
  return groups;
}

export function SommelierHistory({ sommelier }: Props) {
  const { t } = usePreferences();
  const { history, loadMoreHistory } = sommelier;

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <Clock size={40} className="text-tertiary opacity-40" />
        <div className="text-sm text-tertiary text-center">
          {t("sommelier.no_history" as TranslationKey)}
        </div>
      </div>
    );
  }

  const groups = groupByDate(history);

  return (
    <div className="space-y-5">
      {Object.entries(groups).map(([date, sessions]) => (
        <div key={date}>
          <div className="text-[10px] font-medium text-tertiary uppercase tracking-wider mb-2">
            {date}
          </div>
          <div className="space-y-2">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="rounded-xl ring-1 ring-border p-3 transition-all duration-200"
                style={{ background: "var(--surface-card)" }}
              >
                {/* Session header */}
                <div className="flex items-center gap-2 mb-2">
                  {session.mode === "surprise_me" ? (
                    <Shuffle size={14} className="text-tertiary" />
                  ) : (
                    <Sparkles size={14} className="text-tertiary" />
                  )}
                  <span className="text-xs font-medium text-secondary">
                    {session.mode === "surprise_me"
                      ? t("sommelier.surprise_me" as TranslationKey)
                      : session.preference || t("sommelier.generate" as TranslationKey)}
                  </span>
                  <span className="text-[10px] text-tertiary ml-auto tabular-nums">
                    {new Date(session.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>

                {/* Recipes */}
                <div className="space-y-1">
                  {session.recipes.map((recipe) => (
                    <div key={recipe.id} className="flex items-center gap-2 py-0.5">
                      {recipe.brewed ? (
                        <Check size={12} style={{ color: "var(--success)" }} />
                      ) : (
                        <X size={12} className="text-tertiary opacity-40" />
                      )}
                      <span className={`text-xs ${recipe.brewed ? "text-primary font-medium" : "text-tertiary"}`}>
                        {recipe.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Load more */}
      {history.length >= 20 && (
        <button
          onClick={loadMoreHistory}
          className="w-full rounded-xl py-2.5 text-sm font-medium ring-1 ring-border transition active:scale-[0.97]"
          style={{ background: "var(--surface-card)", color: "var(--text-secondary)" }}
        >
          {t("sommelier.load_more" as TranslationKey)}
        </button>
      )}
    </div>
  );
}
