import { LayoutGrid, List, GalleryHorizontalEnd } from "lucide-react";
import { usePreferences, type ViewMode } from "../lib/preferences";
import { Option } from "./ui";
import type { TranslationKey } from "../lib/i18n";

const MODES: { mode: ViewMode; Icon: typeof LayoutGrid }[] = [
  { mode: "grid", Icon: LayoutGrid },
  { mode: "list", Icon: List },
  { mode: "carousel", Icon: GalleryHorizontalEnd },
];

/**
 * The view-mode cluster — Catalog #1's glyph-only form of the single-choice
 * row, and now the SHARED `Option`, not a fourth hand-rolled copy of it (C19).
 *
 * This control used to be the app's last `rounded-xl` utility with a
 * `--surface-card` fill that no longer resolved to anything, so the selected
 * mode was said only by colour and stroke weight. It says it the way every
 * other choice in the app says it: the glyph goes solid `--text-primary` over
 * a lit 1px `--accent` underline whose slot is always reserved, and the
 * unchosen ones stay quiet. Selection never shifts a pixel and never paints a
 * box (owner decision 1, §C3.1–C3.3).
 *
 * The word is hidden but is still the accessible name — a mode cluster is
 * bare glyphs by design (§C1's mode-cluster form), and `title` keeps it
 * discoverable to a pointer. `role="radio"` preserves the radiogroup contract
 * the tests pin.
 */
export function ViewModeToggle() {
  const { viewMode, setViewMode, t } = usePreferences();

  return (
    <div className="flex items-center" role="radiogroup">
      {MODES.map(({ mode, Icon }) => {
        const label = t(`brew.view_${mode}` as TranslationKey);
        return (
          <Option
            key={mode}
            role="radio"
            label={label}
            hideLabel
            title={label}
            selected={viewMode === mode}
            onSelect={() => setViewMode(mode)}
            icon={<Icon size={20} strokeWidth={1.75} />}
          />
        );
      })}
    </div>
  );
}
