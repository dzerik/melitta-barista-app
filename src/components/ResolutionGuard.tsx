import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { usePreferences } from "../lib/preferences";
import iconNotConnected from "../assets/icons/not_connected.png";

const MIN_WIDTH = 1024;
const MIN_HEIGHT = 690;

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
      style={{ background: "var(--overlay-bg)" }}
    >
      <div
        className="flex flex-col items-center gap-5 max-w-sm mx-6 rounded-2xl ring-1 ring-border px-8 py-10 text-center"
        style={{ background: "var(--surface)" }}
      >
        <img
          src={iconNotConnected}
          alt=""
          className="w-16 h-16 object-contain opacity-60"
          draggable={false}
        />
        <div className="text-lg font-light text-primary tracking-wide">
          {t("app.resolution_title")}
        </div>
        <div className="text-sm text-secondary leading-relaxed">
          {t("app.resolution_desc")}
        </div>
        <div
          className="text-xs text-tertiary tabular-nums mt-1 px-4 py-2 rounded-lg"
          style={{ background: "var(--surface-card)" }}
        >
          {t("app.resolution_min")}: {MIN_WIDTH}×{MIN_HEIGHT}px
          <br />
          {t("app.resolution_current")}: {size.w}×{size.h}px
        </div>
      </div>
    </div>,
    document.body,
  );
}
