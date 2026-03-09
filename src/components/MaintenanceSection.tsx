import { useState, useCallback } from "react";
import type { Connection, HassEntities } from "home-assistant-js-websocket";
import { getState, getEntity } from "../lib/entities";
import { pressButton, safeCall } from "../lib/ha";
import { usePreferences } from "../lib/preferences";
import type { TranslationKey } from "../lib/i18n";
import iconMaintenance from "../assets/icons/maintenance.png";
import iconWater from "../assets/icons/water.png";
import iconTemperature from "../assets/icons/temperature.png";
import iconSettings from "../assets/icons/settings.png";

function MelittaIcon({ src, alt }: { src: string; alt: string }) {
  return <img src={src} alt={alt} className="w-6 h-6 object-contain" draggable={false} />;
}

interface Props {
  conn: Connection;
  entities: HassEntities;
  prefix: string;
}

interface MaintenanceAction {
  key: string;
  suffix: string;
  labelKey: TranslationKey;
  descKey: TranslationKey;
  icon: React.ReactNode;
  confirm?: boolean;
}

const CLEANING_ACTIONS: MaintenanceAction[] = [
  {
    key: "easy_clean",
    suffix: "easy_clean",
    labelKey: "maint.easy_clean",
    descKey: "maint.easy_clean_desc",
    icon: <MelittaIcon src={iconMaintenance} alt="clean" />,
    confirm: true,
  },
  {
    key: "intensive_clean",
    suffix: "intensive_clean",
    labelKey: "maint.intensive_clean",
    descKey: "maint.intensive_clean_desc",
    icon: <MelittaIcon src={iconMaintenance} alt="intensive" />,
    confirm: true,
  },
  {
    key: "descaling",
    suffix: "descaling",
    labelKey: "maint.descaling",
    descKey: "maint.descaling_desc",
    icon: <MelittaIcon src={iconWater} alt="descaling" />,
    confirm: true,
  },
  {
    key: "evaporating",
    suffix: "evaporating",
    labelKey: "maint.evaporating",
    descKey: "maint.evaporating_desc",
    icon: <MelittaIcon src={iconTemperature} alt="evaporating" />,
    confirm: true,
  },
];

const FILTER_ACTIONS: MaintenanceAction[] = [
  {
    key: "filter_insert",
    suffix: "filter_insert",
    labelKey: "maint.filter_insert",
    descKey: "maint.filter_insert_desc",
    icon: <MelittaIcon src={iconWater} alt="filter" />,
  },
  {
    key: "filter_replace",
    suffix: "filter_replace",
    labelKey: "maint.filter_replace",
    descKey: "maint.filter_replace_desc",
    icon: <MelittaIcon src={iconWater} alt="filter" />,
  },
  {
    key: "filter_remove",
    suffix: "filter_remove",
    labelKey: "maint.filter_remove",
    descKey: "maint.filter_remove_desc",
    icon: <MelittaIcon src={iconWater} alt="filter" />,
  },
];

const OTHER_ACTIONS: MaintenanceAction[] = [
  {
    key: "switch_off",
    suffix: "switch_off",
    labelKey: "maint.switch_off",
    descKey: "maint.switch_off_desc",
    icon: <MelittaIcon src={iconSettings} alt="power" />,
    confirm: true,
  },
];

const stagger = (index: number) => ({ animationDelay: `${index * 60}ms` });

export function MaintenanceSection({ conn, entities, prefix }: Props) {
  const { t } = usePreferences();
  const [confirmKey, setConfirmKey] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const machineState = (
    getState(entities, prefix, "sensor", "state") || "ready"
  ).toLowerCase();
  const isReady = machineState === "ready";
  const isConnected = getState(entities, prefix, "sensor", "connection") === "Connected";

  const handlePress = useCallback(
    (action: MaintenanceAction) => {
      if (action.confirm && confirmKey !== action.key) {
        setConfirmKey(action.key);
        return;
      }
      setConfirmKey(null);
      setBusyKey(action.key);

      const entityId = `button.${prefix}_${action.suffix}`;
      safeCall(async () => {
        await pressButton(conn, entityId);
        // Clear busy state after a short delay
        setTimeout(() => setBusyKey(null), 2000);
      });
    },
    [conn, prefix, confirmKey],
  );

  const renderSection = (
    title: TranslationKey,
    actions: MaintenanceAction[],
    startIndex: number,
  ) => (
    <>
      <div
        className="settings-header-enter text-[10px] font-medium text-tertiary uppercase tracking-[0.2em] mb-3"
        style={stagger(startIndex)}
      >
        {t(title)}
      </div>
      <div className="space-y-2 mb-6">
        {actions.map((action, i) => {
          const exists = getEntity(entities, prefix, "button", action.suffix);
          if (!exists) return null;
          const isConfirming = confirmKey === action.key;
          const isBusy = busyKey === action.key;
          const disabled = !isConnected || !isReady || isBusy;
          const idx = startIndex + i + 1;

          return (
            <div
              key={action.key}
              className="settings-card-enter rounded-2xl p-4 transition-all duration-200 ring-1"
              style={{
                ...stagger(idx),
                background: isConfirming
                  ? "var(--surface-card-active)"
                  : "var(--surface-card)",
                "--tw-ring-color": isConfirming
                  ? "var(--border-active)"
                  : "var(--border)",
              } as React.CSSProperties}
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex items-center justify-center w-9 h-9 rounded-xl shrink-0"
                  style={{
                    background: "var(--surface-card)",
                    color: "var(--text-secondary)",
                  }}
                >
                  {action.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-primary">
                    {t(action.labelKey)}
                  </div>
                  <div className="text-[11px] text-tertiary leading-tight mt-0.5">
                    {t(action.descKey)}
                  </div>
                </div>
                <button
                  onClick={() => handlePress(action)}
                  disabled={disabled}
                  className="shrink-0 rounded-xl px-4 py-2 text-xs font-semibold transition-all duration-200 active:scale-95"
                  style={{
                    background: isConfirming
                      ? "var(--error-bg)"
                      : "var(--btn-secondary-bg)",
                    color: isConfirming
                      ? "var(--error-text)"
                      : "var(--btn-secondary-text)",
                    opacity: disabled ? 0.4 : 1,
                    border: isConfirming
                      ? "1px solid var(--error-border)"
                      : "1px solid transparent",
                  }}
                >
                  {isBusy
                    ? "..."
                    : isConfirming
                      ? t("maint.confirm")
                      : t("maint.start")}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );

  // Reset confirm state on tap outside
  const handleContainerClick = useCallback(() => {
    if (confirmKey) setConfirmKey(null);
  }, [confirmKey]);

  const cleaningStart = 0;
  const filterStart = CLEANING_ACTIONS.length + 1;
  const otherStart = filterStart + FILTER_ACTIONS.length + 1;

  return (
    <div
      className="flex h-full flex-col px-5 py-5 overflow-y-auto"
      onClick={handleContainerClick}
    >
      {!isConnected && (
        <div className="mb-4 rounded-2xl p-4 text-center text-sm text-secondary ring-1"
          style={{ background: "var(--surface-card)", "--tw-ring-color": "var(--border)" } as React.CSSProperties}
        >
          {t("maint.offline")}
        </div>
      )}

      {isConnected && !isReady && (
        <div className="mb-4 rounded-2xl p-4 text-center text-sm text-secondary ring-1"
          style={{ background: "var(--surface-card)", "--tw-ring-color": "var(--border)" } as React.CSSProperties}
        >
          {t("maint.not_ready")}
        </div>
      )}

      {renderSection("maint.section_cleaning", CLEANING_ACTIONS, cleaningStart)}
      {renderSection("maint.section_filter", FILTER_ACTIONS, filterStart)}
      {renderSection("maint.section_other", OTHER_ACTIONS, otherStart)}
    </div>
  );
}
