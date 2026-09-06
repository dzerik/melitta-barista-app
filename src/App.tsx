import { useState, useCallback, useEffect } from "react";
import { useHA } from "./hooks/useHA";
import { useUiContract } from "./hooks/useUiContract";
import { useSwipePager } from "./hooks/useSwipe";
import { clearConfig } from "./lib/ha";
import { deriveMachineStatus, isNavigationLocked, sectionGates } from "./lib/status";
import { syncServerStrings } from "./lib/server-strings";
import { usePreferences } from "./lib/preferences";
import { ConnectScreen, VersionMismatchScreen } from "./components/ConnectScreen";
import { StatusBar } from "./components/StatusBar";
import { BrewSection } from "./components/BrewSection";
import { FreestyleSection } from "./components/FreestyleSection";
import { SettingsSection } from "./components/SettingsSection";
import { StatsSection } from "./components/StatsSection";
import { MaintenanceSection } from "./components/MaintenanceSection";
import { SommelierSection } from "./components/SommelierSection";
import { StatusOverlay } from "./components/StatusOverlay";
import { PreferencesModal } from "./components/PreferencesModal";
import { ResolutionGuard } from "./components/ResolutionGuard";
import { Rule } from "./components/ui";
import type { TranslationKey } from "./lib/i18n";
import iconBtConnect from "./assets/icons/bt_connect.png";

/** §G2.1 — content text hangs 10px inside the rail the rules span. */
const RAIL_TEXT = "calc(var(--rail) + 10px)";

/**
 * A bare word carrying a 1px `--border` underline — what every non-committing
 * action in this app looks like now (§C5a). No fill, no ring, no radius.
 */
const WORD_ACTION = {
  borderRadius: 0,
  borderBottomWidth: "1px",
  borderBottomStyle: "solid" as const,
  borderBottomColor: "var(--border)",
};

const TABS = ["brew", "freestyle", "sommelier", "stats", "maintenance", "settings"] as const;
type Tab = (typeof TABS)[number];

const TAB_LABEL_KEYS: Record<Tab, TranslationKey> = {
  brew: "tab.brew",
  freestyle: "tab.freestyle",
  sommelier: "tab.sommelier",
  stats: "tab.stats",
  maintenance: "tab.maintenance",
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
  const { t, locale } = usePreferences();

  // Contract session (Zone P-I wiring): bridge detection, ui_contract/get
  // lifecycle with retry + last-good persistence, §5.4 version gate.
  const session = useUiContract(connection, entities, prefix);
  const contract = session.contract;

  // Server strings (§6.3.2): one i18n/get per connection + locale, revalidated
  // for free against the contract document's strings_version when available.
  // The tick re-renders the tree once the registry is (re)filled — every
  // label helper reads the registry synchronously during render.
  const [, setStringsTick] = useState(0);
  useEffect(() => {
    let cancelled = false;
    syncServerStrings(connection, locale, session.stringsVersion).then(() => {
      if (!cancelled) setStringsTick((tick) => tick + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [connection, locale, session.stringsVersion]);

  // Capability-gated sections (§3.5): no contract → every tab stays visible
  // (the legacy behavior).
  const gates = sectionGates(contract);
  const visibleTabs = TABS.filter((tt) =>
    tt === "freestyle" ? gates.freestyle : tt === "stats" ? gates.stats : true,
  );
  // Clamped at render time: if a contract arriving mid-session hides tabs,
  // the pager lands on the last visible one without a state round-trip.
  const pageIndex = Math.min(tabIndex, visibleTabs.length - 1);

  // Tab-lock gate, token-first (UI Contract §3.4 B) with the legacy
  // English-string matching as the pre-contract fallback.
  const hasAction = (() => {
    if (!entities || !prefix) return false;
    return isNavigationLocked(deriveMachineStatus(entities, prefix, locale));
  })();

  const onPageChange = useCallback(
    (page: number) => {
      if (!hasAction) setTabIndex(page);
    },
    [hasAction],
  );

  const { state: pager, handlers: swipe } = useSwipePager({
    pageCount: visibleTabs.length,
    currentPage: pageIndex,
    onPageChange,
    pageWidth,
  });

  if (status === "disconnected" || status === "error" || !connection) {
    return (
      <>
        <ConnectScreen
          onConnect={connect}
          error={error}
          connecting={status === "connecting"}
        />
        <ResolutionGuard />
      </>
    );
  }

  const handleDisconnect = () => {
    clearConfig();
    disconnect();
  };

  if (!prefix) {
    return (
      <>
        <div className="flex h-full items-center justify-center p-6">
          <div className="flex flex-col items-center text-center space-y-4">
            <img src={iconBtConnect} alt="" className="w-20 h-20 object-contain opacity-50" draggable={false} />
            <p className="t-body text-secondary">{t("app.looking")}</p>
            <p className="t-label text-tertiary">
              {t("app.integration_hint")}
            </p>
            <button
              onClick={handleDisconnect}
              className="tap press mt-4 t-body text-secondary hover:text-primary"
              style={WORD_ACTION}
            >
              {t("app.disconnect")}
            </button>
          </div>
        </div>
        <ResolutionGuard />
      </>
    );
  }

  // §5.4 PWA gate: the app has no legacy mode against a pre-contract or
  // version-incompatible integration — one of the two mismatch screens.
  if (session.mismatch !== null) {
    return (
      <>
        <VersionMismatchScreen
          direction={session.mismatch}
          onDisconnect={handleDisconnect}
        />
        <ResolutionGuard />
      </>
    );
  }

  const tab = visibleTabs[pageIndex];

  const renderSection = (tt: Tab) => {
    switch (tt) {
      case "brew":
        return <BrewSection conn={connection} entities={entities} prefix={prefix} contract={contract} />;
      case "freestyle":
        return <FreestyleSection conn={connection} entities={entities} prefix={prefix} contract={contract} />;
      case "sommelier":
        return <SommelierSection conn={connection} entities={entities} prefix={prefix} contract={contract} />;
      case "stats":
        return <StatsSection entities={entities} prefix={prefix} />;
      case "maintenance":
        return <MaintenanceSection conn={connection} entities={entities} prefix={prefix} contract={contract} />;
      case "settings":
        return <SettingsSection conn={connection} entities={entities} prefix={prefix} contract={contract} />;
    }
  };

  return (
    <div className="flex h-full flex-col bg-page">
      <StatusBar
        entities={entities}
        prefix={prefix}
        onDisconnect={handleDisconnect}
        onOpenPrefs={() => setPrefsOpen(true)}
      />

      {/* §5.4: persisted last-good contract rendered before a live fetch lands.
          The notice sits between two hairlines and paints nothing — the top
          rule is the StatusBar's own rail rule directly above it, so drawing a
          second one here would double the line to 2px. */}
      {session.stale && (
        <div className="shrink-0">
          <div
            className="py-1 text-center t-label text-tertiary"
            style={{ paddingLeft: RAIL_TEXT, paddingRight: RAIL_TEXT }}
          >
            {t("contract.stale_notice")}
          </div>
          <Rule rail />
        </div>
      )}

      {/* Swipe pager */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <div
          className="flex h-full will-change-transform"
          style={{
            width: `${visibleTabs.length * 100}%`,
            transform: `translateX(${pager.offsetPx}px)`,
            transition: pager.dragging
              ? "none"
              : "transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
          onTouchStart={swipe.onTouchStart}
          onTouchMove={swipe.onTouchMove}
          onTouchEnd={swipe.onTouchEnd}
        >
          {visibleTabs.map((tt) => (
            <div key={tt} className="h-full" style={{ width: `${pageWidth}px` }}>
              {renderSection(tt)}
            </div>
          ))}
        </div>
      </div>

      {/* Tab bar — no fill of its own (§L2): one rail-to-rail hairline with a
          square-cut 2px accent bar riding on it, and six 60px word targets on
          the bare ground. Every tab is a full-height target, so the same row
          works under a pointer and a thumb. */}
      <div className="shrink-0">
        <Rule rail />
        <nav
          className="relative flex"
          style={{ marginLeft: "var(--rail)", marginRight: "var(--rail)" }}
        >
          {/* The screen's one position mark (§8.1c): square-cut, 2px, riding on
              the rule above and tracking the pager so a drag shows where it
              lands. A per-word reserved underline cannot slide with a drag,
              which is why the tab bar keeps a single moving mark instead. */}
          <div
            aria-hidden="true"
            data-ui="tab-indicator"
            data-fill="rule"
            className="absolute h-[2px]"
            style={{
              top: "-1px",
              width: `${100 / visibleTabs.length}%`,
              transform: `translateX(${(-pager.offsetPx / pageWidth) * 100}%)`,
              transition: pager.dragging
                ? "none"
                : "transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
              backgroundColor: "var(--accent)",
              borderRadius: 0,
            }}
          />
          {visibleTabs.map((tt, i) => {
            const current = tt === tab;
            const locked = hasAction && tt !== tab;
            return (
              <button
                key={tt}
                onClick={() => onPageChange(i)}
                disabled={locked}
                aria-current={current ? "page" : undefined}
                data-ui="tab"
                data-selected={current ? "true" : "false"}
                className={`tap tap-lg press flex-1 t-label ${
                  locked
                    ? "text-tertiary cursor-not-allowed"
                    : current
                      ? "text-primary font-semibold"
                      : "text-secondary hover:text-primary"
                }`}
                style={{
                  borderRadius: 0,
                  // §10 disabled: 0.35, and the row keeps its space.
                  opacity: locked ? 0.35 : 1,
                }}
              >
                {t(TAB_LABEL_KEYS[tt])}
              </button>
            );
          })}
        </nav>
      </div>

      <StatusOverlay conn={connection} entities={entities} prefix={prefix} />
      {prefsOpen && <PreferencesModal onClose={() => setPrefsOpen(false)} />}
      <ResolutionGuard />
    </div>
  );
}
