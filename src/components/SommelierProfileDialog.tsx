import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { usePreferences } from "../lib/preferences";
import type { TranslationKey } from "../lib/i18n";
import type { ProfileInput } from "../hooks/useSommelier";
import { sommelierTokens, sommelierLabel, cupVolumesHint } from "../lib/sommelier-vocab";

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (data: ProfileInput) => Promise<void>;
  initial?: Partial<ProfileInput>;
}

// The temperature-preference picker is removed pending the §9.2.4 follow-up:
// its token set is enforced nowhere server-side, so serving or picking from it
// would advertise a false contract. An existing profile's stored value rides
// through `initial` untouched; new profiles simply omit the field.
const EMPTY: ProfileInput = {
  name: "",
  cup_size: "cup",
  dietary: [],
  caffeine_pref: "regular",
};

export function SommelierProfileDialog({ open, onClose, onSave, initial }: Props) {
  const { t, locale } = usePreferences();
  const [form, setForm] = useState<ProfileInput>({ ...EMPTY, ...initial });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm({ ...EMPTY, ...initial });
  }, [open, initial]);

  if (!open) return null;

  // §9.2.6.1 pickers: served vocab tokens → hardcoded fallback lists. The
  // served cup_size list is adopted verbatim — no client-side token migration
  // (§9.2.6.4; the server normalizes legacy values on ingest).
  const cupSizes = sommelierTokens("cup_size");
  const dietaryOptions = sommelierTokens("dietary");
  const caffeinePrefs = sommelierTokens("caffeine");

  const set = <K extends keyof ProfileInput>(key: K, value: ProfileInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const toggleDietary = (item: string) => {
    const current = form.dietary ?? [];
    set("dietary", current.includes(item) ? current.filter((d) => d !== item) : [...current, item]);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const stopTouch = (e: React.TouchEvent) => e.stopPropagation();

  const chipStyle = (active: boolean) => ({
    background: active ? "var(--btn-primary-bg)" : "var(--surface-card)",
    color: active ? "var(--btn-primary-text)" : "var(--text-secondary)",
    "--tw-ring-color": active ? "transparent" : "var(--border)",
  } as React.CSSProperties);

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
            {initial ? t("sommelier.edit_profile" as TranslationKey) : t("sommelier.add_profile" as TranslationKey)}
          </span>
          <button onClick={onClose} className="text-tertiary hover:text-primary transition p-1">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Name */}
          <div>
            <label className="text-[11px] font-medium text-tertiary uppercase tracking-wider">
              {t("sommelier.profile_name" as TranslationKey)}
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm ring-1 ring-border outline-none"
              style={{ background: "var(--surface-card)", color: "var(--text-primary)" }}
            />
          </div>

          {/* Cup Size */}
          <div>
            <label className="text-[11px] font-medium text-tertiary uppercase tracking-wider">
              {t("sommelier.cup_size" as TranslationKey)}
            </label>
            <select
              value={form.cup_size ?? "cup"}
              onChange={(e) => set("cup_size", e.target.value)}
              className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm ring-1 ring-border outline-none"
              style={{ background: "var(--surface-card)", color: "var(--text-primary)" }}
            >
              {cupSizes.map((cs) => {
                const hint = cupVolumesHint(cs);
                return (
                  <option key={cs} value={cs}>
                    {sommelierLabel(locale, "cup_size", cs)}{hint ? ` (${hint})` : ""}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Dietary */}
          <div>
            <label className="text-[11px] font-medium text-tertiary uppercase tracking-wider">
              {t("sommelier.dietary" as TranslationKey)}
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              {dietaryOptions.map((d) => {
                const active = (form.dietary ?? []).includes(d);
                return (
                  <button
                    key={d}
                    onClick={() => toggleDietary(d)}
                    className="rounded-full px-3 py-1.5 text-xs font-medium transition active:scale-95 ring-1"
                    style={chipStyle(active)}
                  >
                    {sommelierLabel(locale, "dietary", d)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Caffeine Preference */}
          <div>
            <label className="text-[11px] font-medium text-tertiary uppercase tracking-wider">
              {t("sommelier.caffeine" as TranslationKey)}
            </label>
            <select
              value={form.caffeine_pref ?? "regular"}
              onChange={(e) => set("caffeine_pref", e.target.value)}
              className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm ring-1 ring-border outline-none"
              style={{ background: "var(--surface-card)", color: "var(--text-primary)" }}
            >
              {caffeinePrefs.map((cp) => (
                <option key={cp} value={cp}>{sommelierLabel(locale, "caffeine", cp)}</option>
              ))}
            </select>
          </div>

          {/* Machine Profile */}
          <div>
            <label className="text-[11px] font-medium text-tertiary uppercase tracking-wider">
              {t("sommelier.machine_profile" as TranslationKey)}
            </label>
            <select
              value={form.machine_profile ?? ""}
              onChange={(e) => set("machine_profile", e.target.value ? Number(e.target.value) : undefined)}
              className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm ring-1 ring-border outline-none"
              style={{ background: "var(--surface-card)", color: "var(--text-primary)" }}
            >
              <option value="">-</option>
              {[0, 1, 2, 3].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
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
            disabled={saving || !form.name.trim()}
            className="rounded-xl px-5 py-2.5 text-sm font-semibold transition active:scale-95"
            style={{
              background: "var(--btn-primary-bg)",
              color: "var(--btn-primary-text)",
              opacity: saving || !form.name.trim() ? 0.5 : 1,
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
