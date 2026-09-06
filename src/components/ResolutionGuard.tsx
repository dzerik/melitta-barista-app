import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { usePreferences } from "../lib/preferences";
import { Rule } from "./ui";
import iconNotConnected from "../assets/icons/not_connected.png";

const MIN_WIDTH = 1024;
const MIN_HEIGHT = 690;

/**
 * The blocking notice shown below the app's minimum working size.
 *
 * Two of the four permitted fills and nothing else: the scrim (§5.A — the
 * removal of the page, not a container tint) and the one flat `--surface`
 * panel this overlay is allowed (§5.B), square-cornered with no ring and no
 * shadow. The dimensions read out as tabular figures between two hairlines
 * rather than inside a tinted chip.
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
      style={{ backgroundColor: "var(--overlay-bg)" }}
    >
      <div
        className="flex flex-col items-center gap-5 max-w-sm mx-6 px-8 py-10 text-center"
        data-fill="panel"
        style={{ backgroundColor: "var(--surface)", borderRadius: 0 }}
      >
        <img
          src={iconNotConnected}
          alt=""
          className="w-16 h-16 object-contain opacity-60"
          draggable={false}
        />
        <div className="t-title text-primary">
          {t("app.resolution_title")}
        </div>
        <div className="t-body text-secondary leading-relaxed">
          {t("app.resolution_desc")}
        </div>
        <div className="w-full">
          <Rule />
          <div className="t-label text-tertiary tabular-nums py-2">
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
