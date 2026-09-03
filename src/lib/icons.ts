/**
 * mdi-name → lucide icon resolution.
 *
 * The contract serves icon hints as `mdi:*` names (settings entries, action
 * catalog entries, DirectKey categories), but this app has no mdi renderer —
 * lucide-react only. Served names resolve through a small explicit map with a
 * generic icon as final fallback (§5.3.2-style degradation: the served icon
 * field is a hint, never a hard requirement — an unknown name must render
 * something neutral, never throw or show a broken glyph).
 */
import {
  AirVent,
  BookOpen,
  Circle,
  CircleCheck,
  CircleStop,
  Coffee,
  CupSoda,
  Droplet,
  DropletOff,
  Filter,
  FilterX,
  GlassWater,
  Languages,
  Leaf,
  Milk,
  Pointer,
  Power,
  RefreshCw,
  RotateCcw,
  Save,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Thermometer,
  TimerOff,
  Waves,
  Wheat,
  Zap,
  type LucideIcon,
} from "lucide-react";

/** Neutral fallback for unknown/absent icon hints. */
export const GENERIC_ICON: LucideIcon = Circle;

/**
 * Explicit map for every mdi name the contract spec serves today (§6.2.2
 * action icons, §9.1.5 setting icons, §9.3.3 category icons). Unknown names
 * — including future additive ones — fall through to GENERIC_ICON.
 */
const MDI_TO_LUCIDE: Record<string, LucideIcon> = {
  "mdi:air-humidifier": AirVent,
  "mdi:book-refresh": BookOpen,
  "mdi:check-circle": CircleCheck,
  "mdi:check-circle-outline": CircleCheck,
  "mdi:coffee": Coffee,
  "mdi:coffee-maker": Coffee,
  "mdi:coffee-maker-outline": Coffee,
  "mdi:coffee-outline": Coffee,
  "mdi:cog": Settings,
  "mdi:cog-refresh": RefreshCw,
  "mdi:content-save": Save,
  "mdi:cup": CupSoda,
  "mdi:cup-outline": CupSoda,
  "mdi:cup-water": GlassWater,
  "mdi:dishwasher": Waves,
  "mdi:filter-cog": Filter,
  "mdi:filter-outline": Filter,
  "mdi:filter-plus": Filter,
  "mdi:filter-remove": FilterX,
  "mdi:gesture-tap-button": Pointer,
  "mdi:glass-mug-variant": Milk,
  "mdi:grain": Wheat,
  "mdi:leaf": Leaf,
  "mdi:lightning-bolt": Zap,
  "mdi:power": Power,
  "mdi:restore": RotateCcw,
  "mdi:shimmer": Sparkles,
  "mdi:stop": CircleStop,
  "mdi:stop-circle": CircleStop,
  "mdi:thermometer": Thermometer,
  "mdi:timer-off-outline": TimerOff,
  "mdi:translate": Languages,
  "mdi:tune": SlidersHorizontal,
  "mdi:water-off": DropletOff,
  "mdi:water-opacity": Droplet,
  "mdi:water-sync": RefreshCw,
};

/**
 * Resolve a served mdi icon hint to a lucide component.
 *
 * Absent (null/undefined/empty), non-mdi, or unmapped names return
 * GENERIC_ICON — never null, so call sites can render unconditionally.
 */
export function resolveMdiIcon(name: string | null | undefined): LucideIcon {
  if (!name) return GENERIC_ICON;
  return MDI_TO_LUCIDE[name] ?? GENERIC_ICON;
}

/** True when a served mdi name has an explicit (non-generic) mapping. */
export function hasMdiMapping(name: string | null | undefined): boolean {
  return !!name && name in MDI_TO_LUCIDE;
}
