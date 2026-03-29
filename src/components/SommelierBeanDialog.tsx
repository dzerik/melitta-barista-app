import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { usePreferences } from "../lib/preferences";
import type { TranslationKey } from "../lib/i18n";
import type { CoffeeBeanInput, CoffeePreset } from "../hooks/useSommelier";

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (data: CoffeeBeanInput) => Promise<void>;
  presets: CoffeePreset[];
  initial?: Partial<CoffeeBeanInput>;
}

const ROAST_OPTIONS = ["light", "medium", "medium_dark", "dark"] as const;
const BEAN_TYPES = ["arabica", "arabica_robusta", "robusta"] as const;
const ORIGIN_OPTIONS = ["single_origin", "blend"] as const;
const FLAVOR_NOTES = [
  "chocolate", "nutty", "fruity", "floral", "caramel",
  "spicy", "earthy", "honey", "berry", "citrus",
] as const;

const EMPTY: CoffeeBeanInput = {
  brand: "",
  product: "",
  roast: "medium",
  bean_type: "arabica",
  origin: "blend",
  flavor_notes: [],
};

export function SommelierBeanDialog({ open, onClose, onSave, presets, initial }: Props) {
  const { t } = usePreferences();
  const [form, setForm] = useState<CoffeeBeanInput>({ ...EMPTY, ...initial });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm({ ...EMPTY, ...initial });
  }, [open, initial]);

  if (!open) return null;

  const set = <K extends keyof CoffeeBeanInput>(key: K, value: CoffeeBeanInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const toggleNote = (note: string) => {
    const notes = form.flavor_notes ?? [];
    set("flavor_notes", notes.includes(note) ? notes.filter((n) => n !== note) : [...notes, note]);
  };

  const applyPreset = (presetId: string) => {
    const p = presets.find((pr) => pr.id === presetId);
    if (!p) return;
    setForm({
      brand: p.brand,
      product: p.product,
      roast: p.roast,
      bean_type: p.bean_type,
      origin: p.origin,
      flavor_notes: [...p.flavor_notes],
      preset_id: p.id,
    });
  };

  const handleSave = async () => {
    if (!form.brand.trim() || !form.product.trim()) return;
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const stopTouch = (e: React.TouchEvent) => e.stopPropagation();

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm"
      style={{ background: "var(--overlay-bg)" }}
      onClick={onClose}
      onTouchStart={stopTouch}
      onTouchMove={stopTouch}
      onTouchEnd={stopTouch}
    >
      <div
        className="relative w-full max-w-lg max-h-[85vh] mx-4 rounded-2xl ring-1 ring-border overflow-hidden flex flex-col surface"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <span className="text-sm font-semibold text-primary tracking-wide">
            {initial ? t("sommelier.edit_bean" as TranslationKey) : t("sommelier.add_bean" as TranslationKey)}
          </span>
          <button onClick={onClose} className="text-tertiary hover:text-primary transition p-1">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Preset selector */}
          {presets.length > 0 && (
            <div>
              <label className="text-[11px] font-medium text-tertiary uppercase tracking-wider">
                {t("sommelier.preset" as TranslationKey)}
              </label>
              <select
                value={form.preset_id ?? ""}
                onChange={(e) => e.target.value && applyPreset(e.target.value)}
                className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm ring-1 ring-border outline-none"
                style={{ background: "var(--surface-card)", color: "var(--text-primary)" }}
              >
                <option value="">{t("sommelier.select_preset" as TranslationKey)}</option>
                {presets.map((p) => (
                  <option key={p.id} value={p.id}>{p.brand} {p.product}</option>
                ))}
              </select>
            </div>
          )}

          {/* Brand & Product */}
          {(["brand", "product"] as const).map((field) => (
            <div key={field}>
              <label className="text-[11px] font-medium text-tertiary uppercase tracking-wider">
                {t(`sommelier.${field}` as TranslationKey)}
              </label>
              <input
                type="text"
                value={(form[field] as string) || ""}
                onChange={(e) => set(field, e.target.value)}
                className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm ring-1 ring-border outline-none"
                style={{ background: "var(--surface-card)", color: "var(--text-primary)" }}
              />
            </div>
          ))}

          {/* Roast */}
          <div>
            <label className="text-[11px] font-medium text-tertiary uppercase tracking-wider">
              {t("sommelier.roast" as TranslationKey)}
            </label>
            <select
              value={form.roast}
              onChange={(e) => set("roast", e.target.value)}
              className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm ring-1 ring-border outline-none"
              style={{ background: "var(--surface-card)", color: "var(--text-primary)" }}
            >
              {ROAST_OPTIONS.map((r) => (
                <option key={r} value={r}>{t(`sommelier.roast_${r}` as TranslationKey)}</option>
              ))}
            </select>
          </div>

          {/* Bean type */}
          <div>
            <label className="text-[11px] font-medium text-tertiary uppercase tracking-wider">
              {t("sommelier.bean_type" as TranslationKey)}
            </label>
            <select
              value={form.bean_type}
              onChange={(e) => set("bean_type", e.target.value)}
              className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm ring-1 ring-border outline-none"
              style={{ background: "var(--surface-card)", color: "var(--text-primary)" }}
            >
              {BEAN_TYPES.map((bt) => (
                <option key={bt} value={bt}>{t(`sommelier.type_${bt}` as TranslationKey)}</option>
              ))}
            </select>
          </div>

          {/* Origin */}
          <div>
            <label className="text-[11px] font-medium text-tertiary uppercase tracking-wider">
              {t("sommelier.origin" as TranslationKey)}
            </label>
            <select
              value={form.origin}
              onChange={(e) => set("origin", e.target.value)}
              className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm ring-1 ring-border outline-none"
              style={{ background: "var(--surface-card)", color: "var(--text-primary)" }}
            >
              {ORIGIN_OPTIONS.map((o) => (
                <option key={o} value={o}>{t(`sommelier.origin_${o}` as TranslationKey)}</option>
              ))}
            </select>
          </div>

          {/* Country & Composition (optional) */}
          {(["origin_country", "composition"] as const).map((field) => (
            <div key={field}>
              <label className="text-[11px] font-medium text-tertiary uppercase tracking-wider">
                {t(`sommelier.${field}` as TranslationKey)}
              </label>
              <input
                type="text"
                value={(form[field] as string) || ""}
                onChange={(e) => set(field, e.target.value || undefined)}
                className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm ring-1 ring-border outline-none"
                style={{ background: "var(--surface-card)", color: "var(--text-primary)" }}
                placeholder={t("sommelier.optional" as TranslationKey)}
              />
            </div>
          ))}

          {/* Flavor notes */}
          <div>
            <label className="text-[11px] font-medium text-tertiary uppercase tracking-wider">
              {t("sommelier.flavor_notes" as TranslationKey)}
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              {FLAVOR_NOTES.map((note) => {
                const active = (form.flavor_notes ?? []).includes(note);
                return (
                  <button
                    key={note}
                    onClick={() => toggleNote(note)}
                    className="rounded-full px-3 py-1.5 text-xs font-medium transition active:scale-95 ring-1"
                    style={{
                      background: active ? "var(--btn-primary-bg)" : "var(--surface-card)",
                      color: active ? "var(--btn-primary-text)" : "var(--text-secondary)",
                      "--tw-ring-color": active ? "transparent" : "var(--border)",
                    } as React.CSSProperties}
                  >
                    {t(`sommelier.note_${note}` as TranslationKey)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-border">
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 text-sm font-medium transition"
            style={{ color: "var(--text-secondary)" }}
          >
            {t("sommelier.cancel" as TranslationKey)}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !form.brand.trim() || !form.product.trim()}
            className="rounded-xl px-5 py-2.5 text-sm font-semibold transition active:scale-95"
            style={{
              background: "var(--btn-primary-bg)",
              color: "var(--btn-primary-text)",
              opacity: saving || !form.brand.trim() || !form.product.trim() ? 0.5 : 1,
            }}
          >
            {saving ? "..." : t("sommelier.save" as TranslationKey)}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
