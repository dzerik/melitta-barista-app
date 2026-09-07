import type { CSSProperties } from "react";

export interface DotProps {
  /** True for the mark that names where you are. */
  current: boolean;
  /**
   * The painted diameter. Defaults to `--dot` (8px) and there is no reason to
   * pass anything else — the mark never changes size between states.
   */
  size?: string;
  id?: string;
  className?: string;
  style?: CSSProperties;
}

/**
 * The position mark — a true circle, and one of the two curves the language
 * permits (§S4.6, §C6b).
 *
 * The current position is a solid `--accent` disc at `--dot`; every other one
 * is the same 8px circle drawn as a 1px `--accent` ring whose `--bg` interior
 * visibly interrupts the rule passing behind it. No size change between
 * states, no opacity fade, and above all no growing 22×8 capsule. The painted
 * mark stays 8px; the 48px reach belongs to the `.tap` button the caller wraps
 * it in — that decoupling is the point, and it is why this component draws no
 * button of its own and announces nothing.
 *
 * ONE `data-fill` VALUE. These attributes are the audit surface for the whole
 * fill inventory, and the sommelier's copy tagged itself `data-fill="meter"`
 * while the other two said `"dot"` (C21) — which silently exempted it from
 * every query written against the inventory. A position mark is `"dot"`
 * everywhere: pager dots, intensity beads, the stat tile's leader mark.
 */
export function Dot({
  current,
  size = "var(--dot)",
  id,
  className = "",
  style,
}: DotProps) {
  return (
    <span
      id={id}
      aria-hidden="true"
      data-ui="dot"
      /** The declared exception to "radius 0": a TRUE circle, width = height. */
      data-shape="circle"
      data-current={current ? "true" : "false"}
      /** §8.1c — a position mark: the paint IS the position. */
      data-fill="dot"
      className={["block", className].filter(Boolean).join(" ")}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        backgroundColor: current ? "var(--accent)" : "var(--bg)",
        borderWidth: current ? 0 : "1px",
        borderStyle: "solid",
        borderColor: "var(--accent)",
        ...style,
      }}
    />
  );
}
