import type { HassEntities } from "home-assistant-js-websocket";
import { getState } from "../lib/entities";
import { usePreferences } from "../lib/preferences";
import { Settings } from "lucide-react";

interface Props {
  entities: HassEntities;
  prefix: string;
  onDisconnect: () => void;
  onOpenPrefs: () => void;
}

export function StatusBar({ entities, prefix, onDisconnect, onOpenPrefs }: Props) {
  const machineState = getState(entities, prefix, "sensor", "state") || "offline";
  const connection = getState(entities, prefix, "sensor", "connection") || "Disconnected";
  const isConnected = connection === "Connected";
  const { t } = usePreferences();

  return (
    <div className="flex items-center justify-between px-6 py-3 border-b border-border">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-base font-semibold text-primary tracking-wide">
            {t("app.title")}
          </h1>
          <div className="flex items-center gap-2 text-xs">
            <span
              className={`h-1.5 w-1.5 rounded-full ${isConnected ? "bg-[var(--accent)]" : "bg-[var(--text-tertiary)]"}`}
            />
            <span className="text-secondary">{machineState}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenPrefs}
          className="rounded-lg p-2 text-tertiary hover:text-secondary transition"
        >
          <Settings size={16} />
        </button>
        <button
          onClick={onDisconnect}
          className="rounded-lg px-3 py-1.5 text-xs text-secondary ring-1 ring-border hover:ring-border-hover transition"
        >
          {t("app.disconnect")}
        </button>
      </div>
    </div>
  );
}
