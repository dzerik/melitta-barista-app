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
    <div className="flex items-center justify-between gap-4 pl-6 pr-3 border-b border-border">
      <div className="flex items-center gap-4 min-w-0">
        <img src={logoMelitta} alt="Melitta" className="h-6 object-contain shrink-0" draggable={false} />
        <div className="flex items-center gap-2 min-w-0">
          <img
            src={view.connected ? iconBtConnected : iconBtDisconnected}
            alt=""
            aria-hidden="true"
            className="w-4 h-4 object-contain shrink-0"
            draggable={false}
          />
          <span className="t-label text-secondary truncate">{view.statusLabel}</span>
        </div>
      </div>
      <div className="flex items-center">
        <button
          onClick={onOpenPrefs}
          aria-label={t("prefs.title")}
          className="tap press rounded-xl text-secondary hover:text-primary"
        >
          <Settings size={20} />
        </button>
        <button
          onClick={onDisconnect}
          className="tap press rounded-xl px-4 t-label text-secondary hover:text-primary"
        >
          {t("app.disconnect")}
        </button>
      </div>
    </div>
  );
}
