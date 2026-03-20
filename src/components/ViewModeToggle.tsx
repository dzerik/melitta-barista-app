import { LayoutGrid, List, GalleryHorizontalEnd } from "lucide-react";
import { usePreferences, type ViewMode } from "../lib/preferences";

const MODES: { mode: ViewMode; Icon: typeof LayoutGrid }[] = [
  { mode: "grid", Icon: LayoutGrid },
  { mode: "list", Icon: List },
  { mode: "carousel", Icon: GalleryHorizontalEnd },
];

export function ViewModeToggle() {
  const { viewMode, setViewMode } = usePreferences();

  return (
    <div className="flex items-center gap-1.5" role="radiogroup" aria-label="View mode">
      {MODES.map(({ mode, Icon }) => {
        const active = viewMode === mode;
        return (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            role="radio"
            aria-checked={active}
            aria-label={mode}
            className="p-2.5 rounded-lg transition-all"
            style={{
              color: active ? "var(--text-primary)" : "var(--text-tertiary)",
              background: active ? "var(--surface-card)" : "transparent",
              opacity: active ? 1 : 0.4,
            }}
          >
            <Icon size={20} strokeWidth={active ? 2.5 : 1.5} />
          </button>
        );
      })}
    </div>
  );
}
