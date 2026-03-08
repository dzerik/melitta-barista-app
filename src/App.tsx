import { useState, useCallback, useEffect } from "react";
import { useHA } from "./hooks/useHA";
import { useSwipePager } from "./hooks/useSwipe";
import { clearConfig } from "./lib/ha";
import { getState } from "./lib/entities";
import { ConnectScreen } from "./components/ConnectScreen";
import { StatusBar } from "./components/StatusBar";
import { BrewSection } from "./components/BrewSection";
import { FreestyleSection } from "./components/FreestyleSection";
import { SettingsSection } from "./components/SettingsSection";
import { StatsSection } from "./components/StatsSection";

const TABS = ["brew", "freestyle", "stats", "settings"] as const;
type Tab = (typeof TABS)[number];

const TAB_LABELS: Record<Tab, string> = {
  brew: "Brew",
  freestyle: "Freestyle",
  stats: "Stats",
  settings: "Settings",
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
  const pageWidth = useWindowWidth();

  const hasAction = (() => {
    if (!entities || !prefix) return false;
    const ar = getState(entities, prefix, "sensor", "action_required");
    return !!ar && ar !== "None";
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
          <p className="text-neutral-400">Looking for Melitta machine...</p>
          <p className="text-sm text-neutral-600">
            Make sure the integration is set up in Home Assistant
          </p>
          <button
            onClick={() => {
              clearConfig();
              disconnect();
            }}
            className="mt-4 rounded-lg px-4 py-2 text-sm text-neutral-500 ring-1 ring-neutral-700 hover:bg-neutral-800 transition"
          >
            Disconnect
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
    <div className="flex h-full flex-col bg-black">
      <StatusBar
        entities={entities}
        prefix={prefix}
        onDisconnect={handleDisconnect}
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
      <div className="relative flex border-t border-neutral-800/60">
        {/* Sliding indicator — follows both tap and swipe */}
        <div
          className="absolute top-0 h-px bg-white"
          style={{
            width: `${100 / TABS.length}%`,
            transform: `translateX(${(-pager.offsetPx / pageWidth) * 100}%)`,
            transition: pager.dragging
              ? "none"
              : "transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        />
        {TABS.map((t, i) => (
          <button
            key={t}
            onClick={() => onPageChange(i)}
            disabled={hasAction && t !== tab}
            className={`flex-1 py-3 text-xs font-medium tracking-wider uppercase transition ${
              hasAction && t !== tab
                ? "text-neutral-800 cursor-not-allowed"
                : t === tab
                  ? "text-white"
                  : "text-neutral-600 hover:text-neutral-400"
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>
    </div>
  );
}
