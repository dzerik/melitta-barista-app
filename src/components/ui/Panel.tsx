import { useEffect } from "react";
import type { CSSProperties, ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Rule } from "./Rule";
import { PANEL_PAD } from "./tokens";

export type PanelMeasure = "sm" | "md" | "lg";

/**
 * Three measures, and there is no fourth. The audit found five ad-hoc
 * `max-w-*` classes on the one §5.B shape (C8) because nothing in the language
 * ever picked a panel width, so each section picked its own.
 *
 *  sm — a short list or a confirmation (theme + language, the wizard).
 *  md — a picker grid or a form.
 *  lg — a three-up editor or a full detail sheet.
 */
const MEASURE: Record<PanelMeasure, string> = {
  sm: "28rem",
  md: "42rem",
  lg: "56rem",
};

/** §6.6 fixes the lucide ramp; a close control is a standalone glyph at 20px. */
const CLOSE_GLYPH = 20;

export interface PanelProps {
  /** The panel's identity, already localized. Sentence case. */
  title: string;
  /** Fired by the close control, by the scrim and by Escape (if `escape`). */
  onClose: () => void;
  /** Localized accessible name for the close control — usually `t("brew.cancel")`. */
  closeLabel: string;
  /** The body. Padding is the caller's: a picker grid runs edge to edge. */
  children: ReactNode;
  /** §5.B measure. Default `md`. */
  measure?: PanelMeasure;
  /**
   * The action band — an `<ActionBand>`. It brings its own 2px accent rule, so
   * the panel adds nothing around it.
   */
  actions?: ReactNode;
  /** A quiet figure beside the close control ("Step 3 of 7"). */
  headerExtra?: ReactNode;
  /** Anchor the panel to the bottom of the scrim instead of centring it. */
  align?: "center" | "end";
  /** Cap the panel's height. Default `80%` of the viewport. */
  maxHeight?: string;
  /** Close on Escape. Default true. */
  escape?: boolean;
  /** Render through a portal on `document.body`. Default true. */
  portal?: boolean;
  /** Overrides the dialog's accessible name; falls back to `title`. */
  ariaLabel?: string;
  id?: string;
  className?: string;
  bodyClassName?: string;
  style?: CSSProperties;
}

/**
 * The modal shell — scrim plus the ONE flat `--surface` panel per overlay
 * (§5.A and §5.B), with one header, one body and one optional action band.
 *
 * §5.B is a narrow carve-out and this is the only thing allowed to use it: a
 * flat step of the ground, `border-radius: 0`, NO border, NO ring, NO shadow
 * and NO backdrop-blur of its own — the blur belongs to the scrim, which is
 * the removal of the page rather than a container tint. Everything inside the
 * panel is unfilled.
 *
 * THE FILL IS SET WITH `backgroundColor`, NEVER the `background` shorthand.
 * jsdom drops `background: var(--x)` outright, which is how two panels (R3)
 * ended up with a fill no test in this repo could see while four others were
 * covered. One property, one panel, one assertion.
 *
 * The header is fixed: title left at `t-title`, an optional quiet figure and
 * one close control right, one `Rule` beneath. The close control is lucide `X`
 * at 20px in `--text-secondary` — the four rival close controls the audit
 * found (two hand-rolled 24-viewBox SVGs, an `X` at 20, an `X` at 18 and a
 * `ChevronUp` at 16) collapse to this one.
 */
export function Panel({
  title,
  onClose,
  closeLabel,
  children,
  measure = "md",
  actions,
  headerExtra,
  align = "center",
  maxHeight = "80%",
  escape = true,
  portal = true,
  ariaLabel,
  id,
  className = "",
  bodyClassName = "",
  style,
}: PanelProps) {
  useEffect(() => {
    if (!escape) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [escape, onClose]);

  const overlay = (
    <div
      data-ui="panel-scrim"
      /** §5.A: a full-bleed wash is the removal of the page, not a fill. */
      data-fill="scrim"
      className={[
        "fixed inset-0 z-50 flex justify-center backdrop-blur-sm",
        align === "end" ? "items-end" : "items-center",
      ].join(" ")}
      style={{
        backgroundColor: "var(--overlay-bg)",
        paddingLeft: "var(--rail)",
        paddingRight: "var(--rail)",
      }}
      onClick={onClose}
    >
      <div
        id={id}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel ?? title}
        data-ui="panel"
        data-measure={measure}
        /** §5.B: the one flat neutral panel this overlay is allowed. */
        data-fill="panel"
        className={["relative flex w-full flex-col overflow-hidden", className]
          .filter(Boolean)
          .join(" ")}
        style={{
          // Never the `background` shorthand — see the note above (R3).
          backgroundColor: "var(--surface)",
          borderRadius: 0,
          boxShadow: "none",
          maxWidth: MEASURE[measure],
          maxHeight,
          ...style,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          data-ui="panel-header"
          className="flex shrink-0 items-center justify-between gap-4"
          style={{
            paddingLeft: PANEL_PAD,
            paddingRight: PANEL_PAD,
            paddingTop: "0.5rem",
            paddingBottom: "0.5rem",
          }}
        >
          <h2 className="t-title text-primary truncate">{title}</h2>
          <div className="flex shrink-0 items-center gap-2">
            {headerExtra}
            <button
              type="button"
              onClick={onClose}
              aria-label={closeLabel}
              data-ui="panel-close"
              className="tap press"
              style={{ color: "var(--text-secondary)", borderRadius: 0 }}
            >
              <X size={CLOSE_GLYPH} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>
        </div>

        <Rule />

        <div
          data-ui="panel-body"
          className={["custom-scroll min-h-0 flex-1 overflow-y-auto", bodyClassName]
            .filter(Boolean)
            .join(" ")}
        >
          {children}
        </div>

        {actions}
      </div>
    </div>
  );

  return portal ? createPortal(overlay, document.body) : overlay;
}
