import type { HassEntities } from "home-assistant-js-websocket";
import { getState } from "../lib/entities";
import { usePreferences } from "../lib/preferences";
import { Settings } from "lucide-react";
import logoMelitta from "../assets/logo_melitta.png";
import iconBtConnected from "../assets/icons/bt_connected.png";
import iconBtDisconnected from "../assets/icons/bt_disconnected.png";

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
        <img src={logoMelitta} alt="Melitta" className="h-6 object-contain" draggable={false} />
        <div className="flex items-center gap-1.5 text-xs">
          <img
            src={isConnected ? iconBtConnected : iconBtDisconnected}
            alt={isConnected ? "connected" : "disconnected"}
            className="w-3.5 h-3.5 object-contain"
            draggable={false}
          />
          <span className="text-secondary">{machineState}</span>
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
