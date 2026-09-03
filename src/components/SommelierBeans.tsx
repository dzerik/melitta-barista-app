import { useState } from "react";
import { Search, Plus, Pencil, Trash2, Pin, User, ChevronDown } from "lucide-react";
import { usePreferences } from "../lib/preferences";
import type { TranslationKey } from "../lib/i18n";
import type { useSommelier } from "../hooks/useSommelier";
import type { CoffeeBeanInput, ProfileInput } from "../hooks/useSommelier";
import { sommelierLabel, suggestionLabel, mergeSuggestions } from "../lib/sommelier-vocab";
import { SommelierBeanDialog } from "./SommelierBeanDialog";
import { SommelierProfileDialog } from "./SommelierProfileDialog";

type SommelierHook = ReturnType<typeof useSommelier>;

interface Props {
  sommelier: SommelierHook;
}

// Client-local *suggestions* over free-form fields (§9.2.4) — milk types and
// extras item names are deliberately not vocab: the server stores free TEXT so
// users can keep localized names. User input is never restricted to these.
const MILK_SUGGESTIONS = ["whole", "oat", "almond", "soy", "coconut", "lactose_free"];

const SYRUP_SUGGESTIONS = ["vanilla", "caramel", "hazelnut", "chocolate", "maple", "lavender", "peppermint"];
const TOPPING_SUGGESTIONS = ["cinnamon_powder", "whipped_cream", "cocoa_powder", "marshmallow", "caramel_drizzle"];
const LIQUEUR_SUGGESTIONS = ["baileys", "kahlua", "amaretto", "frangelico"];

/** Free-form add row under a suggestion-chip list (Enter or blur commits). */
function AddCustomInput({ placeholder, onAdd }: { placeholder: string; onAdd: (value: string) => void }) {
  const [value, setValue] = useState("");
  const commit = () => {
    const trimmed = value.trim();
    if (trimmed) onAdd(trimmed);
    setValue("");
  };
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } }}
      onBlur={commit}
      placeholder={placeholder}
      className="mt-2 w-full rounded-xl px-3 py-2 text-xs ring-1 ring-border outline-none"
      style={{ background: "var(--surface-card)", color: "var(--text-primary)" }}
    />
  );
}

export function SommelierBeans({ sommelier }: Props) {
  const { t, locale } = usePreferences();
  const {
    beans, hoppers, milkTypes, presets, extras, profiles,
    addBean, updateBean, deleteBean, assignHopper, setMilk, setExtras,
    addProfile, updateProfile, deleteProfile, activateProfile,
  } = sommelier;
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editBean, setEditBean] = useState<string | null>(null);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [editProfileId, setEditProfileId] = useState<string | null>(null);

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

  const handleProfileSave = async (data: ProfileInput) => {
    if (editProfileId) {
      await updateProfile(editProfileId, data);
    } else {
      await addProfile(data);
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

  const toggleExtra = (category: "syrups" | "toppings" | "liqueurs", item: string) => {
    const current = extras[category];
    const next = current.includes(item)
      ? current.filter((i) => i !== item)
      : [...current, item];
    setExtras(category, next);
  };

  // Suggestions + any stored free-form values, each rendered as a toggleable
  // chip ("ice" stays on its dedicated toggle, never in the toppings row).
  const milkChips = mergeSuggestions(MILK_SUGGESTIONS, milkTypes);
  const syrupChips = mergeSuggestions(SYRUP_SUGGESTIONS, extras.syrups);
  const toppingChips = mergeSuggestions(TOPPING_SUGGESTIONS, extras.toppings.filter((i) => i !== "ice"));
  const liqueurChips = mergeSuggestions(LIQUEUR_SUGGESTIONS, extras.liqueurs);

  const chipStyle = (active: boolean) => ({
    background: active ? "var(--btn-primary-bg)" : "var(--surface-card)",
    color: active ? "var(--btn-primary-text)" : "var(--text-secondary)",
    "--tw-ring-color": active ? "transparent" : "var(--border)",
  } as React.CSSProperties);

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
              {sommelierLabel(locale, "roast", bean.roast)} · {sommelierLabel(locale, "bean_type", bean.bean_type)} · {sommelierLabel(locale, "origin", bean.origin)}
            </div>
            {bean.flavor_notes.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {bean.flavor_notes.map((note) => (
                  <span
                    key={note}
                    className="text-[10px] px-1.5 py-0.5 rounded-full"
                    style={{ background: "var(--surface)", color: "var(--text-tertiary)" }}
                  >
                    {suggestionLabel(locale, "note_", note)}
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
              title={t("sommelier.hopper1" as TranslationKey)}
            >
              <Pin size={14} />
              <span className="text-[9px]">1</span>
            </button>
            <button
              onClick={() => assignHopper(2, bean.id)}
              className="p-1.5 rounded-lg text-tertiary hover:text-secondary transition"
              title={t("sommelier.hopper2" as TranslationKey)}
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
          {milkChips.map((m) => {
            const active = milkTypes.includes(m);
            return (
              <button
                key={m}
                onClick={() => toggleMilk(m)}
                className="rounded-full px-3 py-1.5 text-xs font-medium transition active:scale-95 ring-1"
                style={chipStyle(active)}
              >
                {suggestionLabel(locale, "milk_", m)}
              </button>
            );
          })}
        </div>
        <AddCustomInput
          placeholder={t("sommelier.add_custom" as TranslationKey)}
          onAdd={(value) => { if (!milkTypes.includes(value)) setMilk([...milkTypes, value]); }}
        />
      </div>

      {/* Extras — Syrups */}
      <div>
        <div className="text-[10px] font-medium text-tertiary uppercase tracking-wider mb-2">
          {t("sommelier.syrups" as TranslationKey)}
        </div>
        <div className="flex flex-wrap gap-2">
          {syrupChips.map((s) => (
            <button
              key={s}
              onClick={() => toggleExtra("syrups", s)}
              className="rounded-full px-3 py-1.5 text-xs font-medium transition active:scale-95 ring-1"
              style={chipStyle(extras.syrups.includes(s))}
            >
              {suggestionLabel(locale, "syrup_", s)}
            </button>
          ))}
        </div>
        <AddCustomInput
          placeholder={t("sommelier.add_custom" as TranslationKey)}
          onAdd={(value) => { if (!extras.syrups.includes(value)) toggleExtra("syrups", value); }}
        />
      </div>

      {/* Extras — Toppings */}
      <div>
        <div className="text-[10px] font-medium text-tertiary uppercase tracking-wider mb-2">
          {t("sommelier.toppings" as TranslationKey)}
        </div>
        <div className="flex flex-wrap gap-2">
          {toppingChips.map((tp) => (
            <button
              key={tp}
              onClick={() => toggleExtra("toppings", tp)}
              className="rounded-full px-3 py-1.5 text-xs font-medium transition active:scale-95 ring-1"
              style={chipStyle(extras.toppings.includes(tp))}
            >
              {suggestionLabel(locale, "topping_", tp)}
            </button>
          ))}
        </div>
        <AddCustomInput
          placeholder={t("sommelier.add_custom" as TranslationKey)}
          onAdd={(value) => { if (value !== "ice" && !extras.toppings.includes(value)) toggleExtra("toppings", value); }}
        />
      </div>

      {/* Extras — Liqueurs */}
      <div>
        <div className="text-[10px] font-medium text-tertiary uppercase tracking-wider mb-2">
          {t("sommelier.liqueurs" as TranslationKey)}
        </div>
        <div className="flex flex-wrap gap-2">
          {liqueurChips.map((lq) => (
            <button
              key={lq}
              onClick={() => toggleExtra("liqueurs", lq)}
              className="rounded-full px-3 py-1.5 text-xs font-medium transition active:scale-95 ring-1"
              style={chipStyle(extras.liqueurs.includes(lq))}
            >
              {suggestionLabel(locale, "liqueur_", lq)}
            </button>
          ))}
        </div>
        <AddCustomInput
          placeholder={t("sommelier.add_custom" as TranslationKey)}
          onAdd={(value) => { if (!extras.liqueurs.includes(value)) toggleExtra("liqueurs", value); }}
        />
      </div>

      {/* Extras — Ice toggle */}
      <div>
        <div className="text-[10px] font-medium text-tertiary uppercase tracking-wider mb-2">
          {t("sommelier.ice" as TranslationKey)}
        </div>
        <button
          onClick={() => {
            const has = extras.toppings.includes("ice");
            const next = has
              ? extras.toppings.filter((i) => i !== "ice")
              : [...extras.toppings, "ice"];
            setExtras("toppings", next);
          }}
          className="rounded-full px-3 py-1.5 text-xs font-medium transition active:scale-95 ring-1"
          style={chipStyle(extras.toppings.includes("ice"))}
        >
          {t("sommelier.ice" as TranslationKey)}
        </button>
      </div>

      {/* Profiles */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] font-medium text-tertiary uppercase tracking-wider">
            {t("sommelier.profiles" as TranslationKey)}
          </div>
          <button
            onClick={() => { setEditProfileId(null); setProfileDialogOpen(true); }}
            className="flex items-center gap-1 text-[11px] font-medium transition"
            style={{ color: "var(--text-secondary)" }}
          >
            <Plus size={12} />
            {t("sommelier.add_profile" as TranslationKey)}
          </button>
        </div>

        {profiles.length === 0 ? (
          <div className="text-center py-4 text-xs text-tertiary">
            {t("sommelier.no_profiles" as TranslationKey)}
          </div>
        ) : (
          <div className="space-y-2">
            {profiles.map((profile) => (
              <div
                key={profile.id}
                className="rounded-xl ring-1 p-3 flex items-center gap-3 transition-all duration-200"
                style={{
                  background: profile.is_active ? "var(--btn-primary-bg)" : "var(--surface-card)",
                  color: profile.is_active ? "var(--btn-primary-text)" : "var(--text-primary)",
                  "--tw-ring-color": profile.is_active ? "transparent" : "var(--border)",
                } as React.CSSProperties}
              >
                <User size={16} className="shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{profile.name}</div>
                  <div className="text-[11px] opacity-70">
                    {sommelierLabel(locale, "cup_size", profile.cup_size)} · {sommelierLabel(locale, "caffeine", profile.caffeine_pref)}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!profile.is_active && (
                    <button
                      onClick={() => activateProfile(profile.id)}
                      className="p-1.5 rounded-lg transition hover:opacity-80"
                      title={t("sommelier.activate" as TranslationKey)}
                    >
                      <ChevronDown size={14} />
                    </button>
                  )}
                  <button
                    onClick={() => { setEditProfileId(profile.id); setProfileDialogOpen(true); }}
                    className="p-1.5 rounded-lg transition hover:opacity-80"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => deleteProfile(profile.id)}
                    className="p-1.5 rounded-lg transition hover:opacity-80"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
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

      {/* Profile dialog */}
      <SommelierProfileDialog
        open={profileDialogOpen}
        onClose={() => { setProfileDialogOpen(false); setEditProfileId(null); }}
        onSave={handleProfileSave}
        initial={editProfileId ? (() => {
          const p = profiles.find((x) => x.id === editProfileId);
          return p ? { name: p.name, cup_size: p.cup_size, temperature_pref: p.temperature_pref, dietary: p.dietary, caffeine_pref: p.caffeine_pref, machine_profile: p.machine_profile ?? undefined } : undefined;
        })() : undefined}
      />
    </div>
  );
}
