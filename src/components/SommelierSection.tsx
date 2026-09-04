import { useMemo, useState } from "react";
import type { Connection, HassEntities } from "home-assistant-js-websocket";
import { Sparkles, Heart, Clock, Loader2, AlertCircle } from "lucide-react";
import { usePreferences } from "../lib/preferences";
import type { TranslationKey } from "../lib/i18n";
import { useSommelier } from "../hooks/useSommelier";
import { readBridgeAttributes, readStringsVersion, type UiContract } from "../lib/contract";
import { withSommelierErrorMapping } from "../lib/sommelier-errors";
import { BrewWizardContext, type BrewWizardEnv } from "../hooks/useBrewPhase";
import { SommelierGenerate } from "./SommelierGenerate";
import { SommelierFavorites } from "./SommelierFavorites";
import { SommelierHistory } from "./SommelierHistory";

interface Props {
  conn: Connection;
  entities: HassEntities;
  prefix: string;
  /** Contract document (Zone P-I): its strings_version revalidates the vocab cache for free. */
  contract?: UiContract | null;
}

type SubView = "generate" | "favorites" | "history";

const SUB_VIEWS: { key: SubView; labelKey: string; icon: typeof Sparkles }[] = [
  { key: "generate", labelKey: "sommelier.tab_generate", icon: Sparkles },
  { key: "favorites", labelKey: "sommelier.tab_favorites", icon: Heart },
  { key: "history", labelKey: "sommelier.tab_history", icon: Clock },
];

/**
 * Sommelier tab shell: sub-navigation, the shared error banner, and the
 * Zone P-H hosting duties — sommelier WS rejections are mapped by code to
 * localized actionable hints (no_llm_agent / no_llm_agent_selected /
 * llm_agent_missing / timeout / unauthorized) before they reach the
 * `useSommelier` error state, and a `BrewWizardContext` gives recipe cards
 * the connection + entry scope + confirm-prompt entity the brew-phase
 * wizard needs.
 */
export function SommelierSection({ conn, entities, prefix, contract = null }: Props) {
  const { t, locale } = usePreferences();
  const [subView, setSubView] = useState<SubView>("generate");

  // The mapping wrapper localizes at rejection time. Rebuilding it on a
  // locale switch is safe: useSommelier's init effects are ref-guarded, so a
  // new connection identity never refires the session fetches.
  const mappedConn = useMemo(
    () => withSommelierErrorMapping(conn, () => locale),
    [conn, locale],
  );
  const sommelier = useSommelier(mappedConn, readStringsVersion(contract));

  // Wizard environment (Zone P-H): entry scope from the §3.4 bridge
  // attributes (null pre-contract — status polling then stays off) and the
  // machine's Confirm Prompt button when it exists.
  const entryId = readBridgeAttributes(entities, prefix)?.entryId ?? null;
  const confirmId = `button.${prefix}_confirm_prompt`;
  const confirmEntityId = entities[confirmId] ? confirmId : null;
  const wizardEnv = useMemo<BrewWizardEnv>(
    () => ({ conn, entryId, confirmEntityId }),
    [conn, entryId, confirmEntityId],
  );

  if (sommelier.loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 size={24} className="animate-spin text-secondary" />
      </div>
    );
  }

  return (
    <BrewWizardContext.Provider value={wizardEnv}>
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
              aria-current={active ? "page" : undefined}
              className="tap press flex-1 flex items-center justify-center gap-2 t-label"
              style={
                active
                  ? { background: "var(--btn-primary-bg)", color: "var(--btn-primary-text)", fontWeight: 600 }
                  : { background: "var(--surface)", color: "var(--text-secondary)" }
              }
            >
              <Icon size={18} />
              <span>{t(labelKey as TranslationKey)}</span>
            </button>
          );
        })}
      </div>

      {/* Active sub-view */}
      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
        {subView === "generate" && <SommelierGenerate sommelier={sommelier} />}
        {subView === "favorites" && <SommelierFavorites sommelier={sommelier} />}
        {subView === "history" && <SommelierHistory sommelier={sommelier} />}
      </div>
    </div>
    </BrewWizardContext.Provider>
  );
}
