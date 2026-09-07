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
 * THE MATERIAL LAYER (the amendment's second permitted gradient surface). A
 * family may lay `--rule-fill` over a structural rule's tone colour and
 * `--rule-fill-inline` over the fade an inline rule already draws. Both are
 * `background-image` values and both are `none` in cappuccino and caramel, so
 * a `none` layer is a no-op and the flat hairline those families ship is
 * unchanged. Obsidian is the family that uses them: its rules are chrome that
 * catches the light at one end.
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
  const inline = variant === "inline";

  /*
    A material layer must fade in the direction the rule already fades, and
    `--rule-fill-inline` is written ONCE, at a fixed 90deg, dying toward the
    end. So a rule that fades toward its START is drawn end-ward and mirrored
    with `scaleX(-1)`: both layers turn together, the pair of mirrored rules
    that flank a caption stay symmetrical in every family, and a transform on a
    1px decoration costs no layout. A VERTICAL inline rule gets no material
    layer at all — the token is horizontal by construction, and raking a 90deg
    gradient across a 1px-wide column would paint one arbitrary column of it.
  */
  const mirrored = inline && horizontal && fadeToward === "start";

  const paint: CSSProperties = inline
    ? horizontal
      ? {
          backgroundImage: `var(--rule-fill-inline), linear-gradient(90deg, ${ink}, transparent)`,
          ...(mirrored ? { transform: "scaleX(-1)" } : null),
        }
      : {
          backgroundImage: `linear-gradient(180deg, ${
            fadeToward === "end" ? `${ink}, transparent` : `transparent, ${ink}`
          })`,
        }
    : { backgroundColor: ink, backgroundImage: "var(--rule-fill)" };

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
