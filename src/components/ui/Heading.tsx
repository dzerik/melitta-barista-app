import type { CSSProperties, ReactNode } from "react";
import { HANG, RAIL_TEXT } from "./tokens";

export type HeadingHang = "none" | "rail" | "inner";

const PAD: Record<HeadingHang, string | undefined> = {
  none: undefined,
  /** From the viewport edge: the rail the rules span, plus the 10px hang. */
  rail: RAIL_TEXT,
  /** The same hang, inside a parent that already carries the rail. */
  inner: HANG,
};

export interface HeadingProps {
  /** The heading itself, already localized. Sentence case (§7.5). */
  children: ReactNode;
  /** The element to render. Default `h3` — headings are structure, not style. */
  as?: "h2" | "h3" | "h4" | "div";
  /** §G2.1 / C23: which spelling of the 10px text hang this heading takes. */
  hang?: HeadingHang;
  id?: string;
  className?: string;
  style?: CSSProperties;
}

/**
 * The section heading — one type, one colour, one spacing, everywhere (C31).
 *
 * The audit found three treatments across five files: `t-label` primary at
 * weight 600 with `mb-4`, `t-label` medium tertiary with `mb-2`, the same with
 * `mb-3 px-2.5`, and a bare `t-label` tertiary with nothing. Two colours, two
 * weights, three bottom margins, for one role.
 *
 * The survivor is the quiet one. §7.3 gives `--text-tertiary` to "captions,
 * units, quiet meta", and a heading that names a group of controls is exactly
 * that — the controls are the content, the heading is the label on the drawer.
 * Weight comes from `.t-label`'s own 500 and is never overridden: the field
 * research is explicit that bold weights read worse than medium on a dark
 * ground. The margin is §G2.6's 16px between a heading and its controls.
 *
 * The 10px hang has one spelling here too — `hang="rail"` from the viewport
 * edge, `hang="inner"` inside an already rail-padded parent — replacing the
 * bare `"10px"`, the `ROW_INSET` constant and the `px-2.5` class (C23).
 */
export function Heading({
  children,
  as: Tag = "h3",
  hang = "none",
  id,
  className = "",
  style,
}: HeadingProps) {
  return (
    <Tag
      id={id}
      data-ui="heading"
      data-hang={hang}
      className={["t-label text-tertiary block", className]
        .filter(Boolean)
        .join(" ")}
      style={{
        // §G2.6 — 16px between a heading and the controls it names.
        marginBottom: "1rem",
        marginTop: 0,
        paddingLeft: PAD[hang],
        borderRadius: 0,
        ...style,
      }}
    >
      {children}
    </Tag>
  );
}
