import { createPortal } from "react-dom";
import type { Connection, HassEntities } from "home-assistant-js-websocket";
import { getState } from "../lib/entities";
import { pressButton, safeCall } from "../lib/ha";
import { usePreferences } from "../lib/preferences";
import {
  Coffee,
  Droplets,
  Sparkles,
  Power,
  Loader,
  AlertTriangle,
  X,
} from "lucide-react";
import type { ComponentType } from "react";
import type { TranslationKey } from "../lib/i18n";

interface Props {
  entities: HassEntities;
  prefix: string;
  conn: Connection;
}

interface StatusConfig {
  icon: ComponentType<{ size?: number; className?: string }>;
  labelKey: TranslationKey;
  descKey: TranslationKey;
  color: string;
  pulse?: boolean;
}

const STATUS_MAP: Record<string, StatusConfig> = {
  brewing: {
    icon: Coffee,
    labelKey: "status.brewing",
    descKey: "status.brewing_desc",
    color: "text-amber-400",
    pulse: true,
  },
  cleaning: {
    icon: Droplets,
    labelKey: "status.cleaning",
    descKey: "status.cleaning_desc",
    color: "text-sky-400",
    pulse: true,
  },
  descaling: {
    icon: Sparkles,
    labelKey: "status.descaling",
    descKey: "status.descaling_desc",
    color: "text-sky-400",
    pulse: true,
  },
  off: {
    icon: Power,
    labelKey: "status.off",
    descKey: "status.off_desc",
    color: "text-[var(--text-tertiary)]",
  },
  busy: {
    icon: Loader,
    labelKey: "status.busy",
    descKey: "status.busy_desc",
    color: "text-amber-400",
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
        icon: AlertTriangle,
        labelKey: "status.action_required",
        descKey: "status.check_machine",
        color: "text-red-400",
      }
    : config!;

  const Icon = statusConfig.icon;
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
        <div className={`${statusConfig.color} ${statusConfig.pulse ? "status-icon-pulse" : ""}`}>
          <Icon size={64} />
        </div>

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
