import type { HassEntities } from "home-assistant-js-websocket";
import { getState } from "../lib/entities";

interface Props {
  entities: HassEntities;
  prefix: string;
  onDisconnect: () => void;
}

const STATE_COLORS: Record<string, string> = {
  ready: "text-green-400",
  brewing: "text-amber-400",
  cleaning: "text-blue-400",
  descaling: "text-blue-400",
  busy: "text-amber-400",
};

export function StatusBar({ entities, prefix, onDisconnect }: Props) {
  const machineState = getState(entities, prefix, "sensor", "state") || "offline";
  const connection = getState(entities, prefix, "sensor", "connection") || "Disconnected";
  const isConnected = connection === "Connected";
  const stateColor = STATE_COLORS[machineState.toLowerCase()] || "text-coffee-400";

  return (
    <div className="flex items-center justify-between px-6 py-4">
      <div className="flex items-center gap-3">
        <span className="text-2xl">☕</span>
        <div>
          <h1 className="text-lg font-bold text-coffee-50">Melitta Barista</h1>
          <div className="flex items-center gap-2 text-sm">
            <span
              className={`h-2 w-2 rounded-full ${isConnected ? "bg-green-400" : "bg-red-400"}`}
            />
            <span className={stateColor}>{machineState}</span>
          </div>
        </div>
      </div>
      <button
        onClick={onDisconnect}
        className="rounded-lg px-3 py-1.5 text-xs text-coffee-500 ring-1 ring-coffee-700 hover:bg-coffee-800 transition"
      >
        Disconnect
      </button>
    </div>
  );
}
