import { LayoutGrid, List, GalleryHorizontalEnd } from "lucide-react";
import { usePreferences, type ViewMode } from "../lib/preferences";
import type { TranslationKey } from "../lib/i18n";

const MODES: { mode: ViewMode; Icon: typeof LayoutGrid }[] = [
  { mode: "grid", Icon: LayoutGrid },
  { mode: "list", Icon: List },
  { mode: "carousel", Icon: GalleryHorizontalEnd },
];

export function ViewModeToggle() {
  const { viewMode, setViewMode, t } = usePreferences();

  return (
    <div className="flex items-center" role="radiogroup">
      {MODES.map(({ mode, Icon }) => {
        const active = viewMode === mode;
        return (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            role="radio"
            aria-checked={active}
            aria-label={t(`brew.view_${mode}` as TranslationKey)}
            title={t(`brew.view_${mode}` as TranslationKey)}
            className="tap press"
            style={{
              borderRadius: 0,
              color: active ? "var(--text-primary)" : "var(--text-secondary)",
              // Selection is the glyph going solid-white over a lit underline —
              // the WMF outline→filled swap, never a tinted plate behind it.
              borderBottom: active
                ? "var(--underline-w) solid var(--accent)"
                : "var(--underline-w) solid transparent",
            }}
          >
            <Icon size={20} strokeWidth={active ? 2 : 1.5} />
          </button>
        );
      })}
    </div>
  );
}
