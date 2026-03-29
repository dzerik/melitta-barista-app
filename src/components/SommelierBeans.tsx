import { useState } from "react";
import { Search, Plus, Pencil, Trash2, Pin } from "lucide-react";
import { usePreferences } from "../lib/preferences";
import type { TranslationKey } from "../lib/i18n";
import type { useSommelier } from "../hooks/useSommelier";
import type { CoffeeBeanInput } from "../hooks/useSommelier";
import { SommelierBeanDialog } from "./SommelierBeanDialog";

type SommelierHook = ReturnType<typeof useSommelier>;

interface Props {
  sommelier: SommelierHook;
}

const MILK_OPTIONS = ["whole", "oat", "almond", "soy", "coconut", "lactose_free"];

export function SommelierBeans({ sommelier }: Props) {
  const { t } = usePreferences();
  const { beans, hoppers, milkTypes, presets, addBean, updateBean, deleteBean, assignHopper, setMilk } = sommelier;
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editBean, setEditBean] = useState<string | null>(null);

  const filtered = search.trim()
    ? beans.filter((b) =>
        `${b.brand} ${b.product} ${b.roast} ${b.flavor_notes.join(" ")}`.toLowerCase().includes(search.toLowerCase())
      )
    : beans;

  const hopperBeanIds = new Set(
    [hoppers.hopper1?.bean?.id, hoppers.hopper2?.bean?.id].filter(Boolean) as string[]
  );
  const currentBeans = filtered.filter((b) => hopperBeanIds.has(b.id));
  const otherBeans = filtered.filter((b) => !hopperBeanIds.has(b.id));

  const handleSave = async (data: CoffeeBeanInput) => {
    if (editBean) {
      await updateBean(editBean, data);
    } else {
      await addBean(data);
    }
  };

  const hopperBadge = (beanId: string) => {
    if (hoppers.hopper1?.bean?.id === beanId) return "H1";
    if (hoppers.hopper2?.bean?.id === beanId) return "H2";
    return null;
  };

  const toggleMilk = (type: string) => {
    const next = milkTypes.includes(type)
      ? milkTypes.filter((m) => m !== type)
      : [...milkTypes, type];
    setMilk(next);
  };

  const renderBeanCard = (bean: typeof beans[0]) => {
    const badge = hopperBadge(bean.id);
    return (
      <div
        key={bean.id}
        className="rounded-xl ring-1 ring-border p-3 transition-all duration-200"
        style={{ background: "var(--surface-card)" }}
      >
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-primary truncate">
                {bean.brand} · {bean.product}
              </span>
              {badge && (
                <span
                  className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                  style={{ background: "var(--btn-primary-bg)", color: "var(--btn-primary-text)" }}
                >
                  {badge}
                </span>
              )}
            </div>
            <div className="text-[11px] text-tertiary mt-0.5">
              {t(`sommelier.roast_${bean.roast}` as TranslationKey)} · {t(`sommelier.type_${bean.bean_type}` as TranslationKey)} · {t(`sommelier.origin_${bean.origin}` as TranslationKey)}
            </div>
            {bean.flavor_notes.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {bean.flavor_notes.map((note) => (
                  <span
                    key={note}
                    className="text-[10px] px-1.5 py-0.5 rounded-full"
                    style={{ background: "var(--surface)", color: "var(--text-tertiary)" }}
                  >
                    {t(`sommelier.note_${note}` as TranslationKey)}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => { setEditBean(bean.id); setDialogOpen(true); }}
              className="p-1.5 rounded-lg text-tertiary hover:text-secondary transition"
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={() => assignHopper(1, bean.id)}
              className="p-1.5 rounded-lg text-tertiary hover:text-secondary transition"
              title="Hopper 1"
            >
              <Pin size={14} />
              <span className="text-[9px]">1</span>
            </button>
            <button
              onClick={() => assignHopper(2, bean.id)}
              className="p-1.5 rounded-lg text-tertiary hover:text-secondary transition"
              title="Hopper 2"
            >
              <Pin size={14} />
              <span className="text-[9px]">2</span>
            </button>
            <button
              onClick={() => deleteBean(bean.id)}
              className="p-1.5 rounded-lg text-tertiary hover:text-red-400 transition"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Search + Add */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-tertiary" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("sommelier.search_beans" as TranslationKey)}
            className="w-full rounded-xl pl-9 pr-3 py-2.5 text-sm ring-1 ring-border outline-none"
            style={{ background: "var(--surface-card)", color: "var(--text-primary)" }}
          />
        </div>
        <button
          onClick={() => { setEditBean(null); setDialogOpen(true); }}
          className="rounded-xl px-4 py-2.5 text-sm font-semibold transition active:scale-95"
          style={{ background: "var(--btn-primary-bg)", color: "var(--btn-primary-text)" }}
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Current beans */}
      {currentBeans.length > 0 && (
        <div>
          <div className="text-[10px] font-medium text-tertiary uppercase tracking-wider mb-2">
            {t("sommelier.current_beans" as TranslationKey)}
          </div>
          <div className="space-y-2">{currentBeans.map(renderBeanCard)}</div>
        </div>
      )}

      {/* All beans */}
      <div>
        <div className="text-[10px] font-medium text-tertiary uppercase tracking-wider mb-2">
          {t("sommelier.all_beans" as TranslationKey)} ({otherBeans.length})
        </div>
        {otherBeans.length === 0 ? (
          <div className="text-center py-8 text-sm text-tertiary">
            {t("sommelier.no_beans" as TranslationKey)}
          </div>
        ) : (
          <div className="space-y-2">{otherBeans.map(renderBeanCard)}</div>
        )}
      </div>

      {/* Milk types */}
      <div>
        <div className="text-[10px] font-medium text-tertiary uppercase tracking-wider mb-2">
          {t("sommelier.milk_types" as TranslationKey)}
        </div>
        <div className="flex flex-wrap gap-2">
          {MILK_OPTIONS.map((m) => {
            const active = milkTypes.includes(m);
            return (
              <button
                key={m}
                onClick={() => toggleMilk(m)}
                className="rounded-full px-3 py-1.5 text-xs font-medium transition active:scale-95 ring-1"
                style={{
                  background: active ? "var(--btn-primary-bg)" : "var(--surface-card)",
                  color: active ? "var(--btn-primary-text)" : "var(--text-secondary)",
                  "--tw-ring-color": active ? "transparent" : "var(--border)",
                } as React.CSSProperties}
              >
                {t(`sommelier.milk_${m}` as TranslationKey)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bean dialog */}
      <SommelierBeanDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditBean(null); }}
        onSave={handleSave}
        presets={presets}
        initial={editBean ? (() => {
          const b = beans.find((x) => x.id === editBean);
          return b ? { brand: b.brand, product: b.product, roast: b.roast, bean_type: b.bean_type, origin: b.origin, origin_country: b.origin_country ?? undefined, flavor_notes: b.flavor_notes, composition: b.composition ?? undefined, preset_id: b.preset_id ?? undefined } : undefined;
        })() : undefined}
      />
    </div>
  );
}
