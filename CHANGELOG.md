# Changelog

## [1.2.0] - 2026-03-08

### Features

- **Swipe navigation** — full pager between Brew / Freestyle / Stats / Settings with real-time touch tracking, rubber-band edges, and smooth snap animation
- **Freestyle: local-first state** — all freestyle parameter changes stored in localStorage, zero API/BLE calls until brew; single `brew_freestyle` service call sends all 11 params at once
- **Freestyle: recipe as base** — "Use recipe as base" button opens a modal grid of mini recipe cards; selecting one pre-fills all freestyle parameters
- **Settings: batch apply** — settings changes accumulate locally with visual diff highlighting; "Apply Changes" button sends only modified values, "Reset" reverts to backend state
- **Recipe caching** — recipe metadata (profiles, recipes, details) cached in localStorage; instant load on subsequent opens
- **Stats redesign** — premium card grid with CoffeeIcon per recipe, fill-bar proportional to max, hero total counter

### Improvements

- **Reduced API/BLE load** — eliminated ~95% of freestyle API calls; settings no longer fire on every slider move
- **Entity filtering** — `useHA` now filters to Melitta-related entities only, preventing unnecessary re-renders from other HA entities
- **Prefix caching** — device prefix detected once and cached in useRef
- **Error handling** — all service calls wrapped in `safeCall()` fire-and-forget with error logging
- **Premium animations** — staggered card entrance in Settings, slide-up Apply bar, smooth tab transitions
- **Icons** — added `lucide-react` for Settings icons (Zap, Bean, Droplets, Clock, Thermometer, ShieldOff, Check, RotateCcw)
- **Tab bar indicator** — sliding active indicator synced with swipe position in real-time

### Fixes

- **Temperature mismatch** — backend sends `"cold"`, frontend now handles both `"cold"` and `"low"` in all display/icon/heat mappings
- **Toggle thumb** — enlarged to `h-7 w-12` with correct `translate-x-5` offset so thumb reaches the edge
- **Settings level labels** — Water Hardness shows Soft/Medium/Hard/Very Hard, Brew Temperature shows Low/Normal/High instead of raw numbers
- **Modal positioning** — recipe picker modal rendered via `createPortal` to fix `position: fixed` broken by pager `transform`
- **Modal swipe blocking** — touch events on modal backdrop stopped from propagating to swipe pager

### Removed

- `useDebouncedAction` hook — replaced by batch apply pattern in Settings
- Redundant `toggleSwitch` ternary (`"switch" : "switch"`)

## [1.1.0] - 2026-03-07

- Initial premium UI with README and screenshots
