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
import { serverString } from "../lib/server-strings";
import { resolveMdiIcon } from "../lib/icons";
import type { TranslationKey } from "../lib/i18n";
import { Rule } from "./ui";
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

/** §G2.7: a maintenance row is label + control on a fixed 80px pitch. */
const ROW_PITCH = 80;

/**
 * The programme's announced duration, when the machine's own vocabulary
 * carries one (`actions.<action>.duration`, e.g. "примерно 20 минут").
 *
 * Disclosing duration BEFORE the user commits is the single most consistent
 * rule in the maintenance flows of every panel studied ("the cleaning
 * programme lasts approximately 20 minutes"). The sentence is machine-domain
 * truth, so it is served like every other machine string rather than composed
 * here: an unserved key renders nothing at all instead of inventing a figure.
 */
function actionDuration(action: string): string | null {
  return serverString(`actions.${action}.duration`) ?? null;
}

/**
 * One rendered maintenance row — shared markup for both catalog and legacy
 * modes.
 *
 * §G2.7 draws it as a hairline row on the page ground: a bare glyph, the
 * label with its description and duration beneath it, and the action as a
 * BARE WORD on the right. No card, no fill, no ring, no radius, no icon
 * plate. Arming a destructive action turns that word `--error-text` over a
 * 1px `--error-border` underline (§10 destructive-armed); arming a merely
 * confirming one lights the ordinary `--accent` underline. The underline slot
 * is always declared, so nothing shifts when the row arms.
 */
function ActionCard({
  index,
  icon,
  label,
  description,
  duration,
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
  duration: string | null;
  destructive?: boolean;
  isConfirming: boolean;
  isBusy: boolean;
  disabled: boolean;
  onPress: () => void;
  confirmText: string;
  startText: string;
}) {
  const armedDanger = isConfirming && destructive;
  const underline = armedDanger
    ? "var(--error-border)"
    : isConfirming
      ? "var(--accent)"
      : "transparent";

  return (
    <div
      className="settings-card-enter flex items-center gap-4 px-2.5"
      style={{
        ...stagger(index),
        minHeight: ROW_PITCH,
        borderTopWidth: "1px",
        borderTopStyle: "solid",
        borderTopColor: "var(--border)",
        borderRadius: 0,
      }}
    >
      <span
        aria-hidden="true"
        className="flex shrink-0 items-center justify-center"
        style={{ color: "var(--text-tertiary)" }}
      >
        {icon}
      </span>

      <div className="flex-1 min-w-0">
        <div className="t-body text-primary">{label}</div>
        {description !== null && (
          <div className="t-label text-tertiary leading-tight mt-0.5">
            {description}
          </div>
        )}
        {duration !== null && (
          <div data-ui="action-duration" className="t-label num text-tertiary leading-tight mt-0.5">
            {duration}
          </div>
        )}
      </div>

      <button
        onClick={onPress}
        disabled={disabled}
        aria-busy={isBusy || undefined}
        className="tap press shrink-0 t-body"
        style={{
          color: armedDanger
            ? "var(--error-text)"
            : isConfirming
              ? "var(--text-primary)"
              : "var(--text-secondary)",
          fontWeight: isConfirming ? 600 : 400,
          borderBottomWidth: "1px",
          borderBottomStyle: "solid",
          borderBottomColor: underline,
          borderRadius: 0,
          // §10: in-flight dims the acting control only; disabled is 0.35.
          opacity: disabled && !isBusy ? 0.35 : isBusy ? 0.5 : 1,
          pointerEvents: disabled ? "none" : undefined,
        }}
      >
        {isConfirming ? confirmText : startText}
      </button>
    </div>
  );
}

/** A quiet line of type between two hairlines — §10's no-box notice form. */
function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <Rule />
      <div className="px-2.5 py-4 text-center t-label text-tertiary">{children}</div>
      <Rule />
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
        className="settings-header-enter t-label font-medium text-tertiary mb-3 px-2.5"
        style={stagger(startIndex)}
      >
        {t(title)}
      </div>
      <div className="mb-6">
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
              duration={actionDuration(action.key)}
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
        className="settings-header-enter t-label font-medium text-tertiary mb-3 px-2.5"
        style={stagger(startIndex)}
      >
        {actionGroupLabel(locale, group)}
      </div>
      <div className="mb-6">
        {entries.map((entry, i) => {
          const Icon = resolveMdiIcon(actionIconName(entry));
          const isBusy = busyKey === entry.action;
          return (
            <ActionCard
              key={entry.action}
              index={startIndex + i + 1}
              icon={<Icon size={20} strokeWidth={1.75} />}
              label={actionLabel(locale, entry.action)}
              description={actionDescription(locale, entry.action)}
              duration={actionDuration(entry.action)}
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
      className="flex h-full flex-col py-5 overflow-y-auto custom-scroll w-full"
      // §G2.1: rows and their rules run rail to rail; text hangs 10px inside.
      style={{ paddingLeft: "var(--rail)", paddingRight: "var(--rail)" }}
      onClick={handleContainerClick}
    >
      {!isConnected && <Notice>{t("maint.offline")}</Notice>}

      {isConnected && !isReady && <Notice>{t("maint.not_ready")}</Notice>}

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
