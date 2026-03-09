import { createPortal } from "react-dom";
import type { Connection, HassEntities } from "home-assistant-js-websocket";
import { getState } from "../lib/entities";
import { pressButton, safeCall } from "../lib/ha";
import { usePreferences } from "../lib/preferences";
import { X } from "lucide-react";
import type { TranslationKey } from "../lib/i18n";
import iconBrewCup from "../assets/icons/brew_cup.png";
import iconMaintenance from "../assets/icons/maintenance.png";
import iconMachineBt from "../assets/icons/machine_bt.png";
import iconBusy from "../assets/icons/busy.png";
import iconBtError from "../assets/icons/bt_error.png";

interface Props {
  entities: HassEntities;
  prefix: string;
  conn: Connection;
}

interface StatusConfig {
  imgSrc: string;
  labelKey: TranslationKey;
  descKey: TranslationKey;
  pulse?: boolean;
}

const STATUS_MAP: Record<string, StatusConfig> = {
  brewing: {
    imgSrc: iconBrewCup,
    labelKey: "status.brewing",
    descKey: "status.brewing_desc",
    pulse: true,
  },
  cleaning: {
    imgSrc: iconMaintenance,
    labelKey: "status.cleaning",
    descKey: "status.cleaning_desc",
    pulse: true,
  },
  descaling: {
    imgSrc: iconMaintenance,
    labelKey: "status.descaling",
    descKey: "status.descaling_desc",
    pulse: true,
  },
  off: {
    imgSrc: iconMachineBt,
    labelKey: "status.off",
    descKey: "status.off_desc",
  },
  busy: {
    imgSrc: iconBusy,
    labelKey: "status.busy",
    descKey: "status.busy_desc",
    pulse: true,
  },
};

const stop = (e: React.TouchEvent | React.MouseEvent) => e.stopPropagation();

export function StatusOverlay({ entities, prefix, conn }: Props) {
  const { t } = usePreferences();
  const machineState = (
    getState(entities, prefix, "sensor", "state") || "ready"
  ).toLowerCase();

  const actionRequired = getState(entities, prefix, "sensor", "action_required");
  const hasAction = !!actionRequired && actionRequired !== "None";
  const progress = getState(entities, prefix, "sensor", "progress");
  const activity = getState(entities, prefix, "sensor", "activity");

  const config = STATUS_MAP[machineState];
  const showOverlay = !!config || hasAction;
  if (!showOverlay) return null;

  const handleCancel = () => {
    safeCall(() => pressButton(conn, `button.${prefix}_cancel`));
  };

  const statusConfig: StatusConfig = hasAction
    ? {
        imgSrc: iconBtError,
        labelKey: "status.action_required",
        descKey: "status.check_machine",
      }
    : config!;

  const isBrewing = machineState === "brewing";
  const progressNum = progress ? parseInt(progress, 10) : null;
  const description = hasAction
    ? actionRequired || t(statusConfig.descKey)
    : isBrewing && activity
      ? activity
      : t(statusConfig.descKey);

  return createPortal(
    <div
      className="status-overlay-enter fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md"
      style={{ background: "var(--overlay-bg)" }}
      onTouchStart={stop}
      onTouchMove={stop}
      onTouchEnd={stop}
      onClick={stop}
    >
      <div className="status-content-enter flex flex-col items-center gap-6 px-8">
        <img
          src={statusConfig.imgSrc}
          alt=""
          className={`w-20 h-20 object-contain ${statusConfig.pulse ? "status-icon-pulse" : ""}`}
          draggable={false}
        />

        <h2 className="text-xl font-semibold text-primary tracking-wide">
          {t(statusConfig.labelKey)}
        </h2>

        <p className="text-sm text-secondary text-center max-w-[260px]">
          {description}
        </p>

        {isBrewing && progressNum !== null && (
          <div className="w-48 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--slider-track)" }}>
            <div
              className="h-full rounded-full bg-amber-400 transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, progressNum))}%` }}
            />
          </div>
        )}

        {isBrewing && (
          <button
            onClick={handleCancel}
            className="mt-2 flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-medium text-primary ring-1 ring-border hover:ring-border-hover active:scale-95 transition-all"
          >
            <X size={16} />
            {t("brew.cancel")}
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}
