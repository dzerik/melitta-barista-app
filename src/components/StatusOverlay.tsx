import { createPortal } from "react-dom";
import type { Connection, HassEntities } from "home-assistant-js-websocket";
import { getState } from "../lib/entities";
import { deriveMachineStatus, type MachineStatusView } from "../lib/status";
import { usePreferences } from "../lib/preferences";
import { Glyph, TickRing } from "./ui";
import type { TranslationKey } from "../lib/i18n";
import iconMaintenance from "../assets/icons/maintenance.png";
import iconMachineBt from "../assets/icons/machine_bt.png";
import iconBusy from "../assets/icons/busy.png";
import iconBtError from "../assets/icons/bt_error.png";

interface Props {
  entities: HassEntities;
  prefix: string;
  /**
   * Deliberately unused here since C1 removed the brewing takeover — abort was
   * its only command. It stays on the props so the one mount site (App.tsx)
   * keeps a stable contract for the confirmation surface this overlay is the
   * natural home for (`view.awaitingConfirmation`, currently rendered by
   * nobody).
   */
  conn?: Connection;
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
  // C1, settled: BREWING IS NOT THIS COMPONENT'S STATE. BrewSection owns the
  // pour, and this early return is what makes that true rather than merely
  // intended — it must come first so the unknown-token branch below cannot
  // quietly re-take the screen for a brewing machine whose process token is
  // outside the v1 vocabulary. A fault raised DURING a pour still reaches the
  // user, because `hasAction` is tested independently of any config.
  if (view.brewing) return null;
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
 * WHAT THIS COMPONENT IS FOR, AND WHAT IT IS NOT (C1, settled by the owner).
 * It draws the states in which the MACHINE, not the app, has the floor:
 * machine prompts and faults (`hasAction`), a switched-off machine, and a
 * running maintenance programme. It no longer draws `view.brewing`.
 *
 * Two components used to render that one state — this z-50 portal and a second
 * copy inside BrewSection — so whatever BrewSection drew was never seen. The
 * owner's decision 4 settles which of the two is the specified form and it is
 * BrewSection's: "the screen keeps the drink, its name and its composition
 * exactly where they were… No takeover, no modal, no spinner." A portal that
 * never sees a recipe cannot show any of that, so the whole brewing branch —
 * its config entry, its abort circle and its bottom-pinned meter — is gone
 * from here rather than kept as a rival. What remains is the set of screens
 * only this component can draw, and there is exactly one of each.
 *
 * PROGRESS FORM (owner decision 4). The one progress form left here is the
 * §9.1 tick ring, and it appears for the one case it exists for: a maintenance
 * programme whose duration the machine actually reports, so the countdown is
 * KNOWN rather than estimated. It is drawn desaturated (§9.4) with the process
 * glyph in its centre moat and the status word 59px below it (§7.4). An
 * estimated wait is a linear meter and belongs to the screen that owns it.
 */
export function StatusOverlay({ entities, prefix }: Props) {
  const { t, locale } = usePreferences();
  const view = deriveMachineStatus(entities, prefix, locale);

  const progress = getState(entities, prefix, "sensor", "progress");

  const config = overlayConfig(view);
  const showOverlay = !!config || view.hasAction;
  if (!showOverlay) return null;

  const statusConfig: StatusConfig = view.hasAction
    ? {
        imgSrc: iconBtError,
        labelKey: "status.action_required",
        descKey: "status.check_machine",
      }
    : config!;

  const progressNum = progress ? parseInt(progress, 10) : null;

  // Title: token mode prefers the localized token label (server string →
  // bundle → humanized); the legacy path keeps the bundle key text.
  const title =
    view.hasAction || view.source === "legacy"
      ? t(statusConfig.labelKey)
      : view.statusLabel;

  // Description: the machine-domain sentence when the server has one
  // (§6.3.7 `status.*.description`), else the app's own generic copy. The
  // sub-process branch that used to sit here went with the brewing takeover —
  // a sub-process is something a POUR has, and the pour is BrewSection's.
  const description = view.hasAction
    ? view.actionLabel || t(statusConfig.descKey)
    : (view.processDescription ?? t(statusConfig.descKey));

  // A running service programme that reports a figure IS a known-duration
  // countdown — the ring's one licensed use. Everything else keeps the glyph.
  const showServiceRing =
    !view.hasAction && !!statusConfig.pulse && progressNum !== null;

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
              {/* C27: NOT a `Glyph`. That ladder has exactly two rungs — the
                  20px row mark and the 80px state mark — and neither is this:
                  §9.1 fixes the mark in the ring's centre moat at ~50px, a
                  measure that belongs to the ring's geometry rather than to
                  the glyph ladder. Forcing it onto a rung would either shrink
                  it to a row mark or burst the moat. */}
              <img
                src={statusConfig.imgSrc}
                alt=""
                aria-hidden="true"
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
            {/* C27: the `state` rung of the glyph ladder — one size, one
                knock-down, everywhere a page stands over an empty, blocked or
                busy machine. */}
            <Glyph
              size="state"
              src={statusConfig.imgSrc}
              alt=""
              pulse={!!statusConfig.pulse}
            />
            <h2 className="t-title text-primary text-center">{title}</h2>
          </>
        )}

        <p className="t-body text-secondary text-center max-w-[32ch]">
          {description}
        </p>
      </div>
    </div>,
    document.body,
  );
}
