import type { CSSProperties } from "react";

export type RuleTone = "border" | "divider" | "border-hover" | "accent";

const TONE: Record<RuleTone, string> = {
  border: "var(--border)",
  divider: "var(--section-divider)",
  "border-hover": "var(--border-hover)",
  accent: "var(--accent)",
};

export interface RuleProps {
  orientation?: "horizontal" | "vertical";
  /**
   * `structural` is flat and runs rail to rail. `inline` fades away from its
   * anchor — the treatment a rule gets INSIDE a band (§R1.4).
   */
  variant?: "structural" | "inline";
  tone?: RuleTone;
  /** 1px divides content. 2px opens an action band, and only then may it be accent (§8.3). */
  weight?: 1 | 2;
  /** Inset a horizontal rule to `var(--rail)` on both sides — 90% of the viewport (§G2.1). */
  rail?: boolean;
  /** Which end an `inline` rule fades toward. Default `end`. */
  fadeToward?: "start" | "end";
  id?: string;
  className?: string;
  style?: CSSProperties;
}

/**
 * The hairline — the app's container. §S4.2 and §R1.3/R1.4.
 *
 * Not one of the seven real machine panels studied uses a per-item card, tile
 * fill or tinted block; they all separate content with 1px rules and nothing
 * else. So this is what bounds a region here: a flat rule when it is
 * structural and spans rail to rail, a gradient-faded one when it lives inside
 * a band and should die away from its anchor.
 *
 * `rail` is the one margin in the app: every full-width rule — the StatusBar
 * rule, a section rule, the tab-bar rule — spans exactly `var(--rail)` to
 * `var(--rail)`, and content text hangs 10px inside that.
 *
 * Marked `aria-hidden`: a rule is a drawn boundary, never an announced one.
 */
export function Rule({
  orientation = "horizontal",
  variant = "structural",
  tone = "border",
  weight = 1,
  rail = false,
  fadeToward = "end",
  id,
  className = "",
  style,
}: RuleProps) {
  const ink = TONE[tone];
  const horizontal = orientation === "horizontal";

  const paint: CSSProperties =
    variant === "inline"
      ? {
          backgroundImage: `linear-gradient(${horizontal ? "90deg" : "180deg"}, ${
            fadeToward === "end" ? `${ink}, transparent` : `transparent, ${ink}`
          })`,
        }
      : { backgroundColor: ink };

  return (
    <div
      id={id}
      aria-hidden="true"
      data-ui="rule"
      data-fill="rule"
      data-orientation={orientation}
      data-variant={variant}
      className={["shrink-0", className].filter(Boolean).join(" ")}
      style={{
        ...paint,
        borderRadius: 0,
        ...(horizontal
          ? {
              height: `${weight}px`,
              width: "auto",
              marginLeft: rail ? "var(--rail)" : undefined,
              marginRight: rail ? "var(--rail)" : undefined,
              alignSelf: "stretch",
            }
          : { width: `${weight}px`, alignSelf: "stretch" }),
        ...style,
      }}
    />
  );
}
