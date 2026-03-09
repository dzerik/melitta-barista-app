import { useState, useCallback, useEffect } from "react";
import { useHA } from "./hooks/useHA";
import { useSwipePager } from "./hooks/useSwipe";
import { clearConfig } from "./lib/ha";
import { getState } from "./lib/entities";
import { usePreferences } from "./lib/preferences";
import { ConnectScreen } from "./components/ConnectScreen";
import { StatusBar } from "./components/StatusBar";
import { BrewSection } from "./components/BrewSection";
import { FreestyleSection } from "./components/FreestyleSection";
import { SettingsSection } from "./components/SettingsSection";
import { StatsSection } from "./components/StatsSection";
import { StatusOverlay } from "./components/StatusOverlay";
import { PreferencesModal } from "./components/PreferencesModal";
import type { TranslationKey } from "./lib/i18n";

const TABS = ["brew", "freestyle", "stats", "settings"] as const;
type Tab = (typeof TABS)[number];

const TAB_LABEL_KEYS: Record<Tab, TranslationKey> = {
  brew: "tab.brew",
  freestyle: "tab.freestyle",
  stats: "tab.stats",
  settings: "tab.settings",
};

function useWindowWidth() {
  const [width, setWidth] = useState(window.innerWidth);
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return width;
}

export default function App() {
  const { status, connection, entities, prefix, error, connect, disconnect } =
    useHA();
  const [tabIndex, setTabIndex] = useState(0);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const pageWidth = useWindowWidth();
  const { t } = usePreferences();

  const hasAction = (() => {
    if (!entities || !prefix) return false;
    const ar = getState(entities, prefix, "sensor", "action_required");
    if (ar && ar !== "None") return true;
    const ms = (getState(entities, prefix, "sensor", "state") || "ready").toLowerCase();
    return ms !== "ready";
  })();

  const onPageChange = useCallback(
    (page: number) => {
      if (!hasAction) setTabIndex(page);
    },
    [hasAction],
  );

  const { state: pager, handlers: swipe } = useSwipePager({
    pageCount: TABS.length,
    currentPage: tabIndex,
    onPageChange,
    pageWidth,
  });

  if (status === "disconnected" || status === "error" || !connection) {
    return (
      <ConnectScreen
        onConnect={connect}
        error={error}
        connecting={status === "connecting"}
      />
    );
  }

  if (!prefix) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="text-center space-y-3">
          <p className="text-secondary">{t("app.looking")}</p>
          <p className="text-sm text-tertiary">
            {t("app.integration_hint")}
          </p>
          <button
            onClick={() => {
              clearConfig();
              disconnect();
            }}
            className="mt-4 rounded-lg px-4 py-2 text-sm text-secondary ring-1 ring-border hover:ring-border-hover transition"
          >
            {t("app.disconnect")}
          </button>
        </div>
      </div>
    );
  }

  const handleDisconnect = () => {
    clearConfig();
    disconnect();
  };

  const tab = TABS[tabIndex];

  return (
    <div className="flex h-full flex-col bg-page">
      <StatusBar
        entities={entities}
        prefix={prefix}
        onDisconnect={handleDisconnect}
        onOpenPrefs={() => setPrefsOpen(true)}
      />

      {/* Swipe pager */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <div
          className="flex h-full will-change-transform"
          style={{
            width: `${TABS.length * 100}%`,
            transform: `translateX(${pager.offsetPx}px)`,
            transition: pager.dragging
              ? "none"
              : "transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
          onTouchStart={swipe.onTouchStart}
          onTouchMove={swipe.onTouchMove}
          onTouchEnd={swipe.onTouchEnd}
        >
          <div className="h-full" style={{ width: `${pageWidth}px` }}>
            <BrewSection conn={connection} entities={entities} prefix={prefix} />
          </div>
          <div className="h-full" style={{ width: `${pageWidth}px` }}>
            <FreestyleSection conn={connection} entities={entities} prefix={prefix} />
          </div>
          <div className="h-full" style={{ width: `${pageWidth}px` }}>
            <StatsSection entities={entities} prefix={prefix} />
          </div>
          <div className="h-full" style={{ width: `${pageWidth}px` }}>
            <SettingsSection conn={connection} entities={entities} prefix={prefix} />
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="relative flex border-t border-border">
        {/* Sliding indicator */}
        <div
          className="absolute top-0 h-px"
          style={{
            width: `${100 / TABS.length}%`,
            transform: `translateX(${(-pager.offsetPx / pageWidth) * 100}%)`,
            transition: pager.dragging
              ? "none"
              : "transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
            background: "var(--accent)",
          }}
        />
        {TABS.map((tt, i) => (
          <button
            key={tt}
            onClick={() => onPageChange(i)}
            disabled={hasAction && tt !== tab}
            className={`flex-1 py-3 text-xs font-medium tracking-wider uppercase transition ${
              hasAction && tt !== tab
                ? "text-tertiary cursor-not-allowed opacity-30"
                : tt === tab
                  ? "text-primary"
                  : "text-secondary hover:text-primary"
            }`}
          >
            {t(TAB_LABEL_KEYS[tt])}
          </button>
        ))}
      </div>

      <StatusOverlay conn={connection} entities={entities} prefix={prefix} />
      {prefsOpen && <PreferencesModal onClose={() => setPrefsOpen(false)} />}
    </div>
  );
}
