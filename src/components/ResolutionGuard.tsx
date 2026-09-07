import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { usePreferences } from "../lib/preferences";
import { Glyph, Rule } from "./ui";
import iconNotConnected from "../assets/icons/not_connected.png";

const MIN_WIDTH = 1024;
const MIN_HEIGHT = 690;

/**
 * The blocking notice shown below the app's minimum working size.
 *
 * ONE FILL, NOT TWO — AND IT IS NOT A PANEL (C7/C8/C9).
 * This used to hand-roll the §5.B shape: a `--surface` rectangle at its own
 * `max-w-sm`, with its own header treatment and no close control. Two things
 * are wrong with that. First, `Panel` — the primitive that owns §5.B — cannot
 * draw a panel without a close control: `onClose` and `closeLabel` are
 * required and the `X` always renders. Second, that is correct of it. A panel
 * is a modal: a thing you opened, over a page you can go back to. This is
 * neither. There is nothing to close to; the window is the wrong size and the
 * only way out is to resize it. Drawing a close control here would be a
 * control that lies, and drawing a panel without one forks the primitive.
 *
 * So the block keeps only the scrim (§5.A — the removal of the page, not a
 * container tint) and stands bare on it: a state glyph, a title, a line of
 * prose, and the figures between two hairlines. No second fill, no measure of
 * its own — the rail bounds it like everything else, and the one `max-w-*`
 * left is `max-w-prose` on running prose, which is the only cap §G2.3 allows.
 */
export function ResolutionGuard() {
  const { t } = usePreferences();
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  const tooSmall = size.w < MIN_WIDTH || size.h < MIN_HEIGHT;

  useEffect(() => {
    const check = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  if (!tooSmall) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center backdrop-blur-md"
      data-fill="scrim"
      style={{
        backgroundColor: "var(--overlay-bg)",
        paddingLeft: "var(--rail)",
        paddingRight: "var(--rail)",
      }}
    >
      <div
        data-ui="resolution-block"
        className="flex w-full max-w-prose flex-col items-center gap-5 text-center"
      >
        {/* §6.6 / C27: the `state` rung — 80px at the one 0.6 knock-down. */}
        <Glyph src={iconNotConnected} size="state" />
        <h2 className="t-title text-primary">
          {t("app.resolution_title")}
        </h2>
        <div className="t-body text-secondary leading-relaxed">
          {t("app.resolution_desc")}
        </div>
        <div className="w-full">
          <Rule />
          {/* C25: `.num` is the app's one spelling of "tabular". */}
          <div className="t-label text-tertiary num py-2">
            {t("app.resolution_min")}: {MIN_WIDTH}×{MIN_HEIGHT}px
            <br />
            {t("app.resolution_current")}: {size.w}×{size.h}px
          </div>
          <Rule />
        </div>
      </div>
    </div>,
    document.body,
  );
}
