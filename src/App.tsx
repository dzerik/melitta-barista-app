import { useState } from "react";
import { useHA } from "./hooks/useHA";
import { clearConfig } from "./lib/ha";
import { getState } from "./lib/entities";
import { ConnectScreen } from "./components/ConnectScreen";
import { StatusBar } from "./components/StatusBar";
import { BrewSection } from "./components/BrewSection";
import { FreestyleSection } from "./components/FreestyleSection";
import { SettingsSection } from "./components/SettingsSection";

type Tab = "brew" | "freestyle" | "settings";

export default function App() {
  const { status, connection, entities, prefix, error, connect, disconnect } =
    useHA();
  const [tab, setTab] = useState<Tab>("brew");

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

  const actionRequired = getState(entities, prefix, "sensor", "action_required");
  const hasAction = !!actionRequired && actionRequired !== "None";

  const tabs: { id: Tab; label: string }[] = [
    { id: "brew", label: "Brew" },
    { id: "freestyle", label: "Freestyle" },
    { id: "settings", label: "Settings" },
  ];

  return (
    <div className="flex h-full flex-col bg-black">
      <StatusBar
        entities={entities}
        prefix={prefix}
        onDisconnect={handleDisconnect}
      />

      <div className="flex-1 min-h-0">
        {tab === "brew" && (
          <BrewSection conn={connection} entities={entities} prefix={prefix} />
        )}
        {tab === "freestyle" && (
          <FreestyleSection
            conn={connection}
            entities={entities}
            prefix={prefix}
          />
        )}
        {tab === "settings" && (
          <SettingsSection
            conn={connection}
            entities={entities}
            prefix={prefix}
          />
        )}
      </div>

      {/* Tab bar */}
      <div className="flex border-t border-neutral-800/60">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => !hasAction && setTab(t.id)}
            disabled={hasAction && tab !== t.id}
            className={`flex-1 py-3 text-xs font-medium tracking-wider uppercase transition relative ${
              hasAction && tab !== t.id
                ? "text-neutral-800 cursor-not-allowed"
                : tab === t.id
                  ? "text-white"
                  : "text-neutral-600 hover:text-neutral-400"
            }`}
          >
            {tab === t.id && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-px bg-white" />
            )}
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
