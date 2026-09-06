import type { HassEntities } from "home-assistant-js-websocket";
import { deriveMachineStatus } from "../lib/status";
import { usePreferences } from "../lib/preferences";
import { Settings } from "lucide-react";
import { Rule } from "./ui";
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
 * §G2.1: the rule runs rail to rail and the first text pixel hangs 10px
 * inside it. This is the one margin the app has.
 */
const RAIL_TEXT = "calc(var(--rail) + 10px)";

/**
 * The always-visible truth line: BLE link state, machine state, and the
 * attention item if the machine is asking for one.
 *
 * §10 of the field research is the argument for its shape — every real panel
 * examined (Franke, WMF, Jura, Streamline, GaggiMate) carries one thin strip
 * that never moves between modes and never becomes a modal, and errors live in
 * that strip rather than on top of the drinks. So it paints no background of
 * its own: it is three groups of type on the page ground, bounded below by a
 * single rail-to-rail hairline, with a short vertical hairline splitting the
 * machine state from the attention item (§C7, the value-strip idiom).
 *
 * Token-first (UI Contract §3.4): with a supported bridge, `connected` comes
 * from the bridge attribute block and the label from the localized process
 * token; pre-contract integrations keep the frozen legacy strings.
 */
export function StatusBar({ entities, prefix, onDisconnect, onOpenPrefs }: Props) {
  const { t, locale } = usePreferences();
  const view = deriveMachineStatus(entities, prefix, locale);

  return (
    <div className="shrink-0">
      <div
        data-ui="status-strip"
        className="flex items-center justify-between gap-4"
        style={{ paddingLeft: RAIL_TEXT, paddingRight: RAIL_TEXT }}
      >
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
          {/* The attention item is the brightest word in an otherwise quiet
              strip — emphasis by value, not by hue (ISA-101), so the accent
              stays spent on the one commit and the position marks (§8.1). */}
          {view.hasAction && view.actionLabel ? (
            <div className="flex items-center gap-4 min-w-0">
              <Rule orientation="vertical" style={{ height: "1em", alignSelf: "center" }} />
              <span
                data-ui="status-attention"
                className="t-label truncate"
                style={{ color: "var(--text-primary)" }}
              >
                {view.actionLabel}
              </span>
            </div>
          ) : null}
        </div>
        <div className="flex items-center">
          <button
            onClick={onOpenPrefs}
            aria-label={t("prefs.title")}
            className="tap press text-secondary hover:text-primary"
            style={{ borderRadius: 0 }}
          >
            <Settings size={20} strokeWidth={1.75} />
          </button>
          <button
            onClick={onDisconnect}
            className="tap press px-4 t-label text-secondary hover:text-primary"
            style={{ borderRadius: 0 }}
          >
            {t("app.disconnect")}
          </button>
        </div>
      </div>
      <Rule rail />
    </div>
  );
}
