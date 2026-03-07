import { useHA } from "./hooks/useHA";
import { clearConfig } from "./lib/ha";
import { ConnectScreen } from "./components/ConnectScreen";
import { StatusBar } from "./components/StatusBar";
import { BrewSection } from "./components/BrewSection";
import { FreestyleSection } from "./components/FreestyleSection";
import { SettingsSection } from "./components/SettingsSection";

export default function App() {
  const { status, connection, entities, prefix, error, connect, disconnect } =
    useHA();

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

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <StatusBar
        entities={entities}
        prefix={prefix}
        onDisconnect={() => {
          clearConfig();
          disconnect();
        }}
      />

      <div className="flex-1 space-y-4 pb-8">
        <BrewSection conn={connection} entities={entities} prefix={prefix} />
        <FreestyleSection conn={connection} entities={entities} prefix={prefix} />
        <SettingsSection conn={connection} entities={entities} prefix={prefix} />
      </div>
    </div>
  );
}
