import type { HassEntities } from "home-assistant-js-websocket";
import { getState } from "../lib/entities";

interface Props {
  entities: HassEntities;
  prefix: string;
  onDisconnect: () => void;
}

const STATE_COLORS: Record<string, string> = {
  ready: "text-neutral-400",
  brewing: "text-white",
  cleaning: "text-neutral-300",
  descaling: "text-neutral-300",
  busy: "text-neutral-300",
};

export function StatusBar({ entities, prefix, onDisconnect }: Props) {
  const machineState = getState(entities, prefix, "sensor", "state") || "offline";
  const connection = getState(entities, prefix, "sensor", "connection") || "Disconnected";
  const isConnected = connection === "Connected";
  const stateColor = STATE_COLORS[machineState.toLowerCase()] || "text-neutral-500";

  return (
    <div className="flex items-center justify-between px-6 py-3 border-b border-neutral-800/60">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-base font-semibold text-white tracking-wide">Melitta Barista</h1>
          <div className="flex items-center gap-2 text-xs">
            <span
              className={`h-1.5 w-1.5 rounded-full ${isConnected ? "bg-white" : "bg-neutral-600"}`}
            />
            <span className={stateColor}>{machineState}</span>
          </div>
        </div>
      </div>
      <button
        onClick={onDisconnect}
        className="rounded-lg px-3 py-1.5 text-xs text-neutral-500 ring-1 ring-neutral-700 hover:bg-neutral-800 transition"
      >
        Disconnect
      </button>
    </div>
  );
}
