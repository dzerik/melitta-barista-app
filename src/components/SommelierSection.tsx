import { useMemo, useState } from "react";
import type { Connection, HassEntities } from "home-assistant-js-websocket";
import { Sparkles, Heart, Clock, AlertCircle } from "lucide-react";
import { usePreferences } from "../lib/preferences";
import type { TranslationKey } from "../lib/i18n";
import { useSommelier } from "../hooks/useSommelier";
import { readBridgeAttributes, readStringsVersion, type UiContract } from "../lib/contract";
import { withSommelierErrorMapping } from "../lib/sommelier-errors";
import { BrewWizardContext, type BrewWizardEnv } from "../hooks/useBrewPhase";
import { Option } from "./ui/Option";
import { Rule } from "./ui/Rule";
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
 *
 * Drawn to §G2.1/§G2.2/§G2.3: the tab strip's rule and the body both span rail
 * to rail with text hanging 10px inside, the body is a fixed-viewport
 * `flex h-full flex-col` that pages rather than scrolls, and the `max-w-6xl`
 * measure cap that used to wrap the whole tab is gone — a cap belongs on
 * running prose, never on structure.
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
    // §9.3 — a wait with no measure breathes on the subject glyph. No spinner.
    return (
      <div className="flex h-full items-center justify-center">
        <Sparkles size={24} className="status-icon-pulse text-secondary" aria-hidden="true" />
      </div>
    );
  }

  return (
    <BrewWizardContext.Provider value={wizardEnv}>
      <div className="flex h-full flex-col overflow-hidden">
        {/* §10 error: `--error-text` type between two hairlines. Not a box. */}
        {sommelier.error && (
          <div role="alert" className="shrink-0" title={sommelier.error}>
            <Rule rail style={{ backgroundColor: "var(--error-border)" }} />
            <div
              className="flex items-center gap-2 py-2.5 t-label"
              style={{
                color: "var(--error-text)",
                paddingLeft: "calc(var(--rail) + 10px)",
                paddingRight: "calc(var(--rail) + 10px)",
              }}
            >
              <AlertCircle size={16} className="shrink-0" />
              <span className="line-clamp-2">{sommelier.error}</span>
            </div>
            <Rule rail style={{ backgroundColor: "var(--error-border)" }} />
          </div>
        )}

        {/* Sub-navigation — three words on a rail-to-rail rule, the one you
            are on lit white with a 2px accent underline sitting ON that rule. */}
        <div
          className="mt-4 flex shrink-0 gap-8"
          style={{
            marginLeft: "var(--rail)",
            marginRight: "var(--rail)",
            paddingLeft: "10px",
            borderBottomWidth: "1px",
            borderBottomStyle: "solid",
            borderBottomColor: "var(--border)",
          }}
        >
          {SUB_VIEWS.map(({ key, labelKey, icon: Icon }) => (
            <Option
              key={key}
              level="nav"
              label={t(labelKey as TranslationKey)}
              selected={subView === key}
              onSelect={() => setSubView(key)}
              icon={<Icon size={18} />}
            />
          ))}
        </div>

        {/* The active sub-view runs rail to rail and fits the viewport: the
            only cap left in the tab is `max-w-prose` inside a details drawer. */}
        <div
          className="flex min-h-0 flex-1 flex-col"
          style={{ paddingLeft: "var(--rail)", paddingRight: "var(--rail)" }}
        >
          {subView === "generate" && <SommelierGenerate sommelier={sommelier} />}
          {subView === "favorites" && <SommelierFavorites sommelier={sommelier} />}
          {subView === "history" && <SommelierHistory sommelier={sommelier} />}
        </div>
      </div>
    </BrewWizardContext.Provider>
  );
}
