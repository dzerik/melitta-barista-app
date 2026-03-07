import { useState } from "react";
import { useHA } from "./hooks/useHA";
import { clearConfig } from "./lib/ha";
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
          <div className="text-4xl">🔍</div>
          <p className="text-coffee-300">Looking for Melitta machine...</p>
          <p className="text-sm text-coffee-500">
            Make sure the integration is set up in Home Assistant
          </p>
          <button
            onClick={() => {
              clearConfig();
              disconnect();
            }}
            className="mt-4 rounded-lg px-4 py-2 text-sm text-coffee-400 ring-1 ring-coffee-700 hover:bg-coffee-800 transition"
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

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "brew", label: "Brew", icon: "☕" },
    { id: "freestyle", label: "Freestyle", icon: "🧪" },
    { id: "settings", label: "Settings", icon: "⚙️" },
  ];

  return (
    <div className="flex h-full flex-col">
      <StatusBar
        entities={entities}
        prefix={prefix}
        onDisconnect={handleDisconnect}
      />

      {/* Content area — fills remaining space, no scroll */}
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
      <div className="flex border-t border-coffee-800 bg-coffee-900/90 backdrop-blur-sm">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-xs font-medium transition relative ${
              tab === t.id
                ? "text-coffee-100"
                : "text-coffee-500 hover:text-coffee-300"
            }`}
          >
            {tab === t.id && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-coffee-400" />
            )}
            <span className="text-lg">{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
