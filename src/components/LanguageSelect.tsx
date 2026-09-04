import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { SUPPORTED_LOCALES, LOCALE_ENDONYM, type Locale } from "../lib/i18n";

interface Props {
  value: Locale;
  onChange: (locale: Locale) => void;
  /** Accessible name — the visible label is rendered by the caller. */
  label: string;
  id?: string;
}

/**
 * Language picker for the sign-in screen.
 *
 * A native `<select>` would be simpler, but its dropdown is painted by the
 * browser, not by us: it ignores the app's palette and opens as a system
 * menu against a page that may be in the opposite theme. This one is ordinary
 * DOM, so it takes the same surface, border and accent tokens as the form it
 * sits in, and keeps every row at the 48px target the rest of the app uses.
 */
export function LanguageSelect({ value, onChange, label, id }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Dismiss on an outside press or Escape — a menu that can only be closed by
  // choosing something traps whoever opened it by accident.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // Open with the current language in view: the list is 29 rows long and the
  // chosen one is usually not near the top.
  useEffect(() => {
    if (!open) return;
    const selected = listRef.current?.querySelector('[aria-selected="true"]');
    // `scrollIntoView` is missing in some webviews (and in jsdom); the list is
    // usable without it, so it must never take the picker down with it.
    selected?.scrollIntoView?.({ block: "center" });
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        id={id}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        className="tap press w-full flex items-center gap-3 rounded-xl px-4 t-body ring-1"
        style={{
          justifyContent: "space-between",
          background: "var(--input-bg)",
          borderColor: "var(--input-border)",
          color: "var(--text-primary)",
        }}
      >
        <span>{LOCALE_ENDONYM[value]}</span>
        <ChevronDown
          size={18}
          className="shrink-0 text-tertiary transition-transform"
          style={{ transform: open ? "rotate(180deg)" : undefined }}
        />
      </button>

      {open && (
        <div
          ref={listRef}
          role="listbox"
          aria-label={label}
          className="absolute z-10 bottom-full mb-2 w-full max-h-64 overflow-y-auto custom-scroll rounded-xl ring-1 ring-border"
          style={{ background: "var(--bg-elevated)", boxShadow: "var(--shadow-lift)" }}
        >
          {SUPPORTED_LOCALES.map((locale) => {
            const active = locale === value;
            return (
              <button
                key={locale}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(locale);
                  setOpen(false);
                }}
                className="tap press w-full flex items-center gap-3 px-4 t-body"
                style={{
                  justifyContent: "space-between",
                  background: active ? "var(--surface-elevated)" : "transparent",
                  color: active ? "var(--text-primary)" : "var(--text-secondary)",
                  fontWeight: active ? 600 : 400,
                }}
              >
                <span>{LOCALE_ENDONYM[locale]}</span>
                {active && <Check size={18} style={{ color: "var(--accent)" }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
