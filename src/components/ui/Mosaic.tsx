import type { CSSProperties, ReactNode } from "react";

interface Props {
  /** The tiles. Each one paints `var(--bg)` so the ground shows through the gaps. */
  children: ReactNode;
  /** How many tiles fit across. The app never renders below 1024px, so this is fixed. */
  columns: number;
  /** How many tiles were handed in — used to complete the last row. */
  count: number;
  /** Names the mosaic for the fill inventory, e.g. "directkey-mosaic". */
  id: string;
  className?: string;
  style?: CSSProperties;
}

/**
 * A hairline mosaic: tiles on the page ground, divided by the grid's own 1px
 * gap (§S4.3). The gap paint IS the dividers, which is why it is not a
 * container fill.
 *
 * Two things it does that a bare grid cannot:
 *
 * A FIXED COLUMN COUNT. `repeat(auto-fit, …)` was used in three places and
 * spelled three ways, and it has a worse defect than inconsistency: with a
 * variable count you cannot know where a row ends.
 *
 * A COMPLETED LAST ROW. Because the ground shows through the gaps, an unfilled
 * remainder paints the divider colour as one large tinted block — which is how
 * the statistics mosaic came to have a tan slab beside its last three tiles.
 * The filler cells repaint the ground, so the grid stays drawn where a slot is
 * empty. That is also what the reference panels do: Franke leaves the eighth
 * cell of an eight-cell grid empty rather than reflowing the other seven.
 */
export function Mosaic({ children, columns, count, id, className = "", style }: Props) {
  const missing = (columns - (count % columns)) % columns;

  return (
    <div
      data-ui={id}
      /** §S4.3 — the 1px grid gap over `--section-divider` is the hairline. */
      data-fill="rule"
      className={`grid ${className}`}
      style={{
        gap: "1px",
        backgroundColor: "var(--section-divider)",
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        borderRadius: 0,
        ...style,
      }}
    >
      {children}
      {Array.from({ length: missing }, (_, i) => (
        <div
          key={`mosaic-empty-${i}`}
          aria-hidden="true"
          data-ui={`${id}-empty`}
          data-fill="ground"
          style={{ backgroundColor: "var(--bg)", borderRadius: 0 }}
        />
      ))}
    </div>
  );
}
