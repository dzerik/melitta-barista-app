import { createPortal } from "react-dom";
import type { Connection, HassEntities } from "home-assistant-js-websocket";
import { getState } from "../lib/entities";
import { deriveMachineStatus, type MachineStatusView } from "../lib/status";
import { pressButton, safeCall } from "../lib/ha";
import { usePreferences } from "../lib/preferences";
import { X } from "lucide-react";
import { Meter, TickRing } from "./ui";
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

/**
 * Overlay kinds, keyed like the legacy lowercase native_value matching so
 * pre-contract rendering stays byte-identical. Token mode maps process
 * tokens onto the same set (easy/intensive clean & evaporating stay
 * overlay-free — BrewSection shows their service screen, as before).
 */
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

/** Map the status view onto an overlay config, or null for no overlay. */
function overlayConfig(view: MachineStatusView): StatusConfig | null {
  if (view.brewing) return STATUS_MAP.brewing;
  if (view.off) return STATUS_MAP.off;
  if (view.service === "cleaning") return STATUS_MAP.cleaning;
  if (view.service === "descaling") return STATUS_MAP.descaling;
  if (view.service === "busy") return STATUS_MAP.busy;
  // §5.3.2 rule 2: an unknown status token renders as neutral active/busy.
  if (view.source === "tokens" && view.unknownActive) return STATUS_MAP.busy;
  return null;
}

const stop = (e: React.TouchEvent | React.MouseEvent) => e.stopPropagation();

/** §7.4: the status word sits exactly 59px below the ring, and nowhere else. */
const STATUS_WORD_OFFSET = 59;

/**
 * Full-screen machine-status overlay (brewing/maintenance/off/action).
 *
 * Status is token-first via `deriveMachineStatus` (UI Contract §3.4 B) with
 * the legacy English-string matching as the pre-contract fallback.
 *
 * PROGRESS FORM (owner decision 4). A brew's end is only ever ESTIMATED, so
 * the pour is drawn the way the reference machine draws it: the screen keeps
 * its content and a horizontal segmented meter is pinned to the bottom edge
 * between the rails — no ring, no spinner, and one explicitly labelled abort
 * as the only control while it runs. A maintenance programme whose progress
 * the machine actually reports is a known-duration countdown, and that is the
 * one case the §9.1 tick ring exists for; it is drawn desaturated (§9.4) with
 * the process glyph in its centre moat and the status word 59px below it.
 */
export function StatusOverlay({ entities, prefix, conn }: Props) {
  const { t, locale } = usePreferences();
  const view = deriveMachineStatus(entities, prefix, locale);

  const progress = getState(entities, prefix, "sensor", "progress");

  const config = overlayConfig(view);
  const showOverlay = !!config || view.hasAction;
  if (!showOverlay) return null;

  const handleCancel = () => {
    safeCall(() => pressButton(conn, `button.${prefix}_cancel`));
  };

  const statusConfig: StatusConfig = view.hasAction
    ? {
        imgSrc: iconBtError,
        labelKey: "status.action_required",
        descKey: "status.check_machine",
      }
    : config!;

  const isBrewing = view.brewing;
  const progressNum = progress ? parseInt(progress, 10) : null;

  // Title: token mode prefers the localized token label (server string →
  // bundle → humanized); the legacy path keeps the bundle key text.
  const title =
    view.hasAction || view.source === "legacy"
      ? t(statusConfig.labelKey)
      : view.statusLabel;

  // Description: the machine-domain sentence when the server has one
  // (§6.3.7 `status.*.description`), else the app's own generic copy. While
  // brewing, the sub-process is the more specific thing to say — its served
  // description first, then the plain activity label, as before.
  const description = view.hasAction
    ? view.actionLabel || t(statusConfig.descKey)
    : isBrewing && view.activityLabel
      ? (view.activityDescription ?? view.activityLabel)
      : (view.processDescription ?? t(statusConfig.descKey));

  // A running service programme that reports a figure IS a known-duration
  // countdown — the ring's one licensed use. Everything else keeps the glyph.
  const showServiceRing =
    !isBrewing && !view.hasAction && !!statusConfig.pulse && progressNum !== null;

  const pulseClass = statusConfig.pulse ? "status-icon-pulse" : "";

  return createPortal(
    <div
      className="status-overlay-enter fixed inset-0 z-50 flex flex-col backdrop-blur-md"
      /** §5.A: a scrim is the removal of the page, not a container fill. */
      data-fill="scrim"
      style={{ backgroundColor: "var(--overlay-bg)" }}
      onTouchStart={stop}
      onTouchMove={stop}
      onTouchEnd={stop}
      onClick={stop}
    >
      <div className="status-content-enter flex flex-1 flex-col items-center justify-center gap-6 px-8">
        {showServiceRing ? (
          <div className="flex flex-col items-center">
            <TickRing value={progressNum} tone="service" ariaLabel={title}>
              <img
                src={statusConfig.imgSrc}
                alt=""
                className={`w-[50px] h-[50px] object-contain ${pulseClass}`}
                draggable={false}
              />
            </TickRing>
            <h2
              className="t-label text-primary text-center"
              style={{ marginTop: STATUS_WORD_OFFSET }}
            >
              {title}
            </h2>
          </div>
        ) : (
          <>
            <img
              src={statusConfig.imgSrc}
              alt=""
              className={`w-20 h-20 object-contain ${pulseClass}`}
              draggable={false}
            />
            <h2 className="t-title text-primary text-center">{title}</h2>
          </>
        )}

        <p className="t-body text-secondary text-center max-w-[32ch]">
          {description}
        </p>
      </div>

      {isBrewing && (
        <div className="shrink-0">
          {/*
            Jura's rule: while the machine prepares, the only control is the
            universal abort word. §5.C(ii) draws it as one solid circle inside
            a 48px reach with its label OUTSIDE the circle, to the right.
          */}
          <div className="flex justify-center pb-6">
            <button
              onClick={handleCancel}
              className="tap press flex items-center gap-3"
              style={{ borderRadius: 0, color: "var(--text-primary)" }}
            >
              <span
                aria-hidden="true"
                data-ui="abort-circle"
                /** The screen's one saturated shape — §5.C, form (ii). */
                data-fill="commit"
                className="flex shrink-0 items-center justify-center"
                style={{
                  width: 30,
                  height: 30,
                  // A true circle: width === height. The one curve §0/L1 allows.
                  borderRadius: "50%",
                  backgroundColor: "var(--error-text)",
                  color: "var(--text-inverse)",
                }}
              >
                <X size={10} strokeWidth={2.5} />
              </span>
              <span className="t-body">{t("brew.cancel")}</span>
            </button>
          </div>

          {progressNum !== null && (
            // Pinned to the bottom edge, rail to rail: the machine's own form.
            <Meter
              value={progressNum}
              max={100}
              segments={12}
              role="progressbar"
              ariaLabel={title}
              style={{
                marginLeft: "var(--rail)",
                marginRight: "var(--rail)",
                width: "auto",
              }}
            />
          )}
        </div>
      )}
    </div>,
    document.body,
  );
}
