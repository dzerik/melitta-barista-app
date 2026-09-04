import { useState, useCallback } from "react";
import { callService, type Connection, type HassEntities } from "home-assistant-js-websocket";
import { getState, getEntity } from "../lib/entities";
import { pressButton, safeCall } from "../lib/ha";
import { usePreferences } from "../lib/preferences";
import type { UiContract } from "../lib/contract";
import { deriveMachineStatus } from "../lib/status";
import {
  resolveActionCatalog,
  maintenanceActionGroups,
  requiresContextFromStatus,
  evalRequires,
  needsConfirm,
  isDestructive,
  planActionInvocation,
  actionIconName,
  actionLabel,
  actionDescription,
  actionGroupLabel,
  type CatalogAction,
} from "../lib/actions";
import { resolveMdiIcon } from "../lib/icons";
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
  /** UI Contract document (P-I wiring); null/omitted → legacy tables. */
  contract?: UiContract | null;
}

interface MaintenanceAction {
  key: string;
  suffix: string;
  labelKey: TranslationKey;
  descKey: TranslationKey;
  icon: React.ReactNode;
  confirm?: boolean;
}

/**
 * Legacy hardcoded action tables — the permanent §6.2.5.1 fallback rendered
 * whenever the contract serves no action catalog (pre-0.92 integrations).
 */
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

/** One rendered maintenance row — shared markup for both catalog and legacy modes. */
function ActionCard({
  index,
  icon,
  label,
  description,
  destructive = false,
  isConfirming,
  isBusy,
  disabled,
  onPress,
  confirmText,
  startText,
}: {
  index: number;
  icon: React.ReactNode;
  label: string;
  description: string | null;
  destructive?: boolean;
  isConfirming: boolean;
  isBusy: boolean;
  disabled: boolean;
  onPress: () => void;
  confirmText: string;
  startText: string;
}) {
  const danger = isConfirming || destructive;
  return (
    <div
      className="settings-card-enter rounded-2xl p-4 transition-all duration-200 ring-1"
      style={{
        ...stagger(index),
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
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-primary">
            {label}
          </div>
          {description !== null && (
            <div className="t-label text-tertiary leading-tight mt-0.5">
              {description}
            </div>
          )}
        </div>
        <button
          onClick={onPress}
          disabled={disabled}
          className="tap press shrink-0 rounded-xl px-5 t-label font-semibold"
          style={{
            background: danger
              ? "var(--error-bg)"
              : "var(--btn-secondary-bg)",
            color: danger
              ? "var(--error-text)"
              : "var(--btn-secondary-text)",
            opacity: disabled ? 0.4 : 1,
            border: danger
              ? "1px solid var(--error-border)"
              : "1px solid transparent",
          }}
        >
          {isBusy ? "..." : isConfirming ? confirmText : startText}
        </button>
      </div>
    </div>
  );
}

export function MaintenanceSection({ conn, entities, prefix, contract = null }: Props) {
  const { t, locale } = usePreferences();
  const [confirmKey, setConfirmKey] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const catalog = resolveActionCatalog(contract);

  // Legacy flags — kept byte-identical to the pre-contract app for the
  // fallback tables (missing state sensor defaults to ready, as before).
  const machineState = (
    getState(entities, prefix, "sensor", "state") || "ready"
  ).toLowerCase();
  const legacyReady = machineState === "ready";
  const legacyConnected =
    getState(entities, prefix, "sensor", "connection") === "Connected";

  // Catalog mode gates per entry via `requires` (§6.2.4) — no blanket
  // ready-gate, so switch_off stays usable while connected-not-ready (PR #42
  // as data). The banners reflect the same context.
  const view = deriveMachineStatus(entities, prefix, locale);
  const ctx = requiresContextFromStatus(view);
  const isConnected = catalog !== null ? ctx.connected : legacyConnected;
  const isReady = catalog !== null ? ctx.ready : legacyReady;

  const finishPress = useCallback(
    (key: string, run: () => Promise<unknown>) => {
      setConfirmKey(null);
      setBusyKey(key);
      safeCall(async () => {
        await run();
        // Clear busy state after a short delay
        setTimeout(() => setBusyKey(null), 2000);
      });
    },
    [],
  );

  const handleLegacyPress = useCallback(
    (action: MaintenanceAction) => {
      if (action.confirm && confirmKey !== action.key) {
        setConfirmKey(action.key);
        return;
      }
      const entityId = `button.${prefix}_${action.suffix}`;
      finishPress(action.key, () => pressButton(conn, entityId));
    },
    [conn, prefix, confirmKey, finishPress],
  );

  const handleCatalogPress = useCallback(
    (entry: CatalogAction) => {
      if (needsConfirm(entry) && confirmKey !== entry.action) {
        setConfirmKey(entry.action);
        return;
      }
      const plan = planActionInvocation(entry, prefix);
      finishPress(entry.action, () =>
        "button" in plan
          ? pressButton(conn, `button.${prefix}_${plan.button}`)
          : callService(conn, plan.domain, plan.service, plan.data),
      );
    },
    [conn, prefix, confirmKey, finishPress],
  );

  const renderLegacySection = (
    title: TranslationKey,
    actions: MaintenanceAction[],
    startIndex: number,
  ) => (
    <>
      <div
        className="settings-header-enter t-label font-medium text-tertiary mb-3"
        style={stagger(startIndex)}
      >
        {t(title)}
      </div>
      <div className="space-y-2 mb-6">
        {actions.map((action, i) => {
          const exists = getEntity(entities, prefix, "button", action.suffix);
          if (!exists) return null;
          return (
            <ActionCard
              key={action.key}
              index={startIndex + i + 1}
              icon={action.icon}
              label={t(action.labelKey)}
              description={t(action.descKey)}
              isConfirming={confirmKey === action.key}
              isBusy={busyKey === action.key}
              disabled={!legacyConnected || !legacyReady || busyKey === action.key}
              onPress={() => handleLegacyPress(action)}
              confirmText={t("maint.confirm")}
              startText={t("maint.start")}
            />
          );
        })}
      </div>
    </>
  );

  const renderCatalogGroup = (
    group: string,
    entries: CatalogAction[],
    startIndex: number,
  ) => (
    <div key={group}>
      <div
        className="settings-header-enter t-label font-medium text-tertiary mb-3"
        style={stagger(startIndex)}
      >
        {actionGroupLabel(locale, group)}
      </div>
      <div className="space-y-2 mb-6">
        {entries.map((entry, i) => {
          const Icon = resolveMdiIcon(actionIconName(entry));
          const isBusy = busyKey === entry.action;
          return (
            <ActionCard
              key={entry.action}
              index={startIndex + i + 1}
              icon={<Icon size={24} strokeWidth={1.75} />}
              label={actionLabel(locale, entry.action)}
              description={actionDescription(locale, entry.action)}
              destructive={isDestructive(entry)}
              isConfirming={confirmKey === entry.action}
              isBusy={isBusy}
              disabled={!evalRequires(entry.requires, ctx) || isBusy}
              onPress={() => handleCatalogPress(entry)}
              confirmText={t("maint.confirm")}
              startText={t("maint.start")}
            />
          );
        })}
      </div>
    </div>
  );

  // Reset confirm state on tap outside
  const handleContainerClick = useCallback(() => {
    if (confirmKey) setConfirmKey(null);
  }, [confirmKey]);

  const cleaningStart = 0;
  const filterStart = CLEANING_ACTIONS.length + 1;
  const otherStart = filterStart + FILTER_ACTIONS.length + 1;

  // Catalog mode: served groups minus the informational brew/control ones
  // (§6.2.5.2), with entries lacking their anchor button entity hidden.
  const catalogGroups =
    catalog === null
      ? null
      : maintenanceActionGroups(catalog)
          .map((g) => ({
            group: g.group,
            entries: g.entries.filter((e) =>
              getEntity(entities, prefix, "button", e.invocation.entity_suffix),
            ),
          }))
          .filter((g) => g.entries.length > 0);

  return (
    <div
      className="flex h-full flex-col px-5 py-5 overflow-y-auto max-w-2xl mx-auto w-full"
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

      {catalogGroups !== null ? (
        (() => {
          let start = 0;
          return catalogGroups.map((g) => {
            const rendered = renderCatalogGroup(g.group, g.entries, start);
            start += g.entries.length + 1;
            return rendered;
          });
        })()
      ) : (
        <>
          {renderLegacySection("maint.section_cleaning", CLEANING_ACTIONS, cleaningStart)}
          {renderLegacySection("maint.section_filter", FILTER_ACTIONS, filterStart)}
          {renderLegacySection("maint.section_other", OTHER_ACTIONS, otherStart)}
        </>
      )}
    </div>
  );
}
