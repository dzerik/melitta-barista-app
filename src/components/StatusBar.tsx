import type { HassEntities } from "home-assistant-js-websocket";
import { deriveMachineStatus } from "../lib/status";
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

/**
 * Top bar: BLE link state + machine status label.
 *
 * Token-first (UI Contract §3.4): with a supported bridge, `connected` comes
 * from the bridge attribute block and the label from the localized process
 * token; pre-contract integrations keep the frozen legacy strings.
 */
export function StatusBar({ entities, prefix, onDisconnect, onOpenPrefs }: Props) {
  const { t, locale } = usePreferences();
  const view = deriveMachineStatus(entities, prefix, locale);

  return (
    <div className="flex items-center justify-between px-6 py-3 border-b border-border">
      <div className="flex items-center gap-3">
        <img src={logoMelitta} alt="Melitta" className="h-6 object-contain" draggable={false} />
        <div className="flex items-center gap-1.5 text-xs">
          <img
            src={view.connected ? iconBtConnected : iconBtDisconnected}
            alt={view.connected ? "connected" : "disconnected"}
            className="w-3.5 h-3.5 object-contain"
            draggable={false}
          />
          <span className="text-secondary">{view.statusLabel}</span>
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
