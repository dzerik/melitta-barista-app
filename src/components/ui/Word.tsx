import type { CSSProperties, ReactNode } from "react";

export type WordTone = "quiet" | "strong" | "destructive";

const INK: Record<WordTone, string> = {
  quiet: "var(--text-secondary)",
  strong: "var(--text-primary)",
  destructive: "var(--error-text)",
};

export interface WordProps {
  /** The verb the user reads. Already localized — never a raw string. */
  label: string;
  /** Fired on click. Never called while `busy` or `disabled`. */
  onClick: () => void;
  /**
   * An optional 16–18px lucide glyph drawn to the LEFT of the word. The word
   * still shows: this is the one control the audit found wearing a naked
   * chevron with nothing beside it (R8), and a bare glyph is not a label.
   */
  icon?: ReactNode;
  /**
   * `quiet` (default) is the ordinary secondary action. `strong` is the one
   * word on a screen that carries as much weight as its subject. `destructive`
   * inks the word `--error-text` — the armed half of §C5a, drawn as type, never
   * as a red box.
   */
  tone?: WordTone;
  /** §10 in-flight: opacity 0.5 on the acting control only, taps refused. */
  busy?: boolean;
  /** The progressive verb shown while busy. Localized by the caller. */
  busyLabel?: string;
  /** §10 disabled: opacity 0.35, no pointer events, layout preserved. */
  disabled?: boolean;
  /** Set on a disclosure so the button can announce (and perform) collapse. */
  ariaExpanded?: boolean;
  /** Set where the visible word is not the whole accessible name. */
  ariaLabel?: string;
  ariaControls?: string;
  title?: string;
  type?: "button" | "submit";
  id?: string;
  className?: string;
  style?: CSSProperties;
}

/**
 * The bare word — every action in the app that is not the screen's one commit
 * rectangle (§C3.5, §C5a). Cancel, Reset, Restart, Load more, Surprise me,
 * Details, Remove, Disconnect: all of them are this.
 *
 * ONE UNDERLINE DECISION, AND IT IS "NONE". In this language an underline
 * means *chosen* — it is the mark `Option` reserves and lights. An action word
 * is not chosen, it is tappable, so it wears no rule at all. That is why there
 * is no `underline` prop here and no tone that grows one: the eight hand-rolled
 * copies this replaces disagreed on the underline's COLOUR (`--border` in
 * seven places, `--border-hover` in an eighth) precisely because none of them
 * could say what the line meant.
 *
 * Rank is carried by ink (§7.3), reach by `.tap`, feedback by `.press`, and
 * scale by exactly one type step — `t-body`. A second scale is how the same
 * verb ended up three steps apart across three tabs (C3); there is no `scale`
 * prop for the same reason there is no `underline` one.
 */
export function Word({
  label,
  onClick,
  icon,
  tone = "quiet",
  busy = false,
  busyLabel,
  disabled = false,
  ariaExpanded,
  ariaLabel,
  ariaControls,
  title,
  type = "button",
  id,
  className = "",
  style,
}: WordProps) {
  const shown = busy && busyLabel !== undefined ? busyLabel : label;
  const inert = busy || disabled;

  return (
    <button
      type={type}
      id={id}
      title={title}
      onClick={onClick}
      disabled={inert}
      aria-busy={busy || undefined}
      aria-expanded={ariaExpanded}
      aria-controls={ariaControls}
      aria-label={ariaLabel ?? shown}
      data-ui="word"
      data-tone={tone}
      data-busy={busy ? "true" : "false"}
      className={["tap press t-body gap-2", className].filter(Boolean).join(" ")}
      style={{
        color: INK[tone],
        // No fill, no ring, no radius — and, deliberately, no underline.
        borderRadius: 0,
        opacity: disabled ? 0.35 : busy ? 0.5 : 1,
        pointerEvents: inert ? "none" : undefined,
        ...style,
      }}
    >
      {icon ? (
        <span
          aria-hidden="true"
          data-ui="word-icon"
          style={{ display: "inline-flex" }}
        >
          {icon}
        </span>
      ) : null}
      <span>{shown}</span>
    </button>
  );
}
