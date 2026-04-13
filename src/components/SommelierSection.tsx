import { useState } from "react";
import type { Connection, HassEntities } from "home-assistant-js-websocket";
import { Sparkles, Bean, Heart, Clock, Loader2, AlertCircle } from "lucide-react";
import { usePreferences } from "../lib/preferences";
import type { TranslationKey } from "../lib/i18n";
import { useSommelier } from "../hooks/useSommelier";
import { SommelierGenerate } from "./SommelierGenerate";
import { SommelierBeans } from "./SommelierBeans";
import { SommelierFavorites } from "./SommelierFavorites";
import { SommelierHistory } from "./SommelierHistory";

interface Props {
  conn: Connection;
  entities: HassEntities;
  prefix: string;
}

type SubView = "generate" | "beans" | "favorites" | "history";

const SUB_VIEWS: { key: SubView; labelKey: string; icon: typeof Sparkles }[] = [
  { key: "generate", labelKey: "sommelier.tab_generate", icon: Sparkles },
  { key: "beans", labelKey: "sommelier.tab_beans", icon: Bean },
  { key: "favorites", labelKey: "sommelier.tab_favorites", icon: Heart },
  { key: "history", labelKey: "sommelier.tab_history", icon: Clock },
];

export function SommelierSection({ conn }: Props) {
  const { t } = usePreferences();
  const [subView, setSubView] = useState<SubView>("generate");
  const sommelier = useSommelier(conn);

  if (sommelier.loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 size={24} className="animate-spin text-secondary" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Error banner */}
      {sommelier.error && (
        <div
          role="alert"
          className="mx-5 mt-3 rounded-xl px-4 py-3 text-sm flex items-center gap-2"
          style={{ background: "var(--error-bg)", color: "var(--error-text)" }}
          title={sommelier.error}
        >
          <AlertCircle size={16} className="shrink-0" />
          <span className="line-clamp-2">
            {sommelier.error.length > 240 ? `${sommelier.error.slice(0, 240)}…` : sommelier.error}
          </span>
        </div>
      )}

      {/* Sub-navigation */}
      <div className="mx-5 mt-4 flex rounded-xl overflow-hidden ring-1 ring-border">
        {SUB_VIEWS.map(({ key, labelKey, icon: Icon }) => {
          const active = subView === key;
          return (
            <button
              key={key}
              onClick={() => setSubView(key)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition"
              style={
                active
                  ? { background: "var(--btn-primary-bg)", color: "var(--btn-primary-text)", fontWeight: 700 }
                  : { background: "var(--surface)", color: "var(--text-tertiary)" }
              }
            >
              <Icon size={14} />
              <span className="hidden sm:inline">{t(labelKey as TranslationKey)}</span>
            </button>
          );
        })}
      </div>

      {/* Active sub-view */}
      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
        {subView === "generate" && <SommelierGenerate sommelier={sommelier} />}
        {subView === "beans" && <SommelierBeans sommelier={sommelier} />}
        {subView === "favorites" && <SommelierFavorites sommelier={sommelier} />}
        {subView === "history" && <SommelierHistory sommelier={sommelier} />}
      </div>
    </div>
  );
}
