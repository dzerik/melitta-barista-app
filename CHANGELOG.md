# Changelog

## [2.3.0] — 2026-09-04

### Added

- **The app follows your device's colour scheme.** Theme now has a third setting, System, and it is the default: a device set to light opens the app in porcelain instead of forcing dark, and a scheme that flips mid-session repaints immediately. Picking Dark or Light still pins it, and a theme chosen before this release stays chosen. The browser's own chrome (status bar, address bar) now takes the same ground as the page.

## [2.2.1] — 2026-09-04

### Fixed

- The sign-in screen offered three languages out of the 29 the app ships, as three flag tiles. It now lists every language by its own name — that screen is where someone who does not read English arrives first. (Auto-detection from the browser already covered all 29; only the manual override was short.)

## [2.2.0] — 2026-09-04

The sommelier's own words, shown as written.

### Added

- **Recipes read like a recipe.** Expanding a suggestion now shows why the sommelier chose it, followed by the full preparation sequence in order — the chilled glass, the ice, each pour named by what it dispenses ("Coffee · 40 ml · Strong"), and what to do after. Previously the expander printed the machine's own tokens (`coffee / medium / standard / normal / two / 40ml`), which said nothing a person could act on.
- **Favorites open up too.** Saved drinks gained the same details view. Reasoning is kept with the favorite from integration 0.94 onward; drinks saved before that show their steps alone.

### Fixed

- The hopper line said "Blend: 1%". `blend` is the hopper selector, not a ratio — it now reads as hopper 1 or hopper 2, and says nothing when the value is neither.
- The bundle check only compared English, Russian and German, so a key could be missing from the other 26 languages and still pass. It now reads every shipped bundle.

## [2.1.0] — 2026-09-04

Ships the design pass together with the shared-strings adoption.

### Changed

- Machine wording now comes from the integration (0.94+) over `i18n/get`: brew-guide vocabulary, machine-state descriptions, sommelier error hints and labels for known milk kinds, syrups, toppings, liqueurs and flavour notes are translated once, server-side, in all 29 languages. The app's bundles remain the offline and pre-0.94 fallback, and text a user typed themselves still renders exactly as typed.

- **Design pass.** The interface is rebuilt around the drink photography: a warm espresso ground (never pure black) with a single crema accent, sentence-case type instead of tracked-out capitals, and recipe cards laid out in fixed bands so names and compositions line up across a row. Light theme becomes porcelain rather than paper.
- **Touch and pointer parity.** Every control now honours a 48px minimum target (60px for primary actions and the tab bar) without inflating its painted size; icons start at 16px, text at 13px. Brew is a single wide bar instead of a small floating pill, page dots keep a full-size reach, and the language picker is a list of native language names rather than three flag tiles.
- **Sommelier is user-facing only.** Bean, milk, add-in and taste-profile management moved out of the app — those belong to the Melitta panel in Home Assistant. The tab keeps Generate, Favorites and History; hopper cards now say where beans are configured.

### Added

- All 29 integration languages ship in the app (was English, Russian, German). Machine-domain wording is reused from the integration's own translations; remaining app-specific strings fall back to English per key until translated.

### Fixed

- Multi-phase favorites open the step wizard instead of one-shot brewing (recipe cards already did).
- The sommelier loader no longer writes `undefined` into its state when a backend answers only some commands — the tab used to crash instead of degrading.
- Removed the intense-aroma toggle: it was never sent anywhere, so it silently did nothing.
- View-mode buttons announce localized names instead of raw tokens; known milk and add-in values render localized instead of raw.


## [2.0.0] - 2026-09-04

Full UI Contract port (v1 + v2 + v3): the app is now a first-class contract client of the Melitta Barista integration (0.93+), with per-feature fallback to its previous hardcoded tables against any contract-serving integration that omits a block.

### Features

- **Contract core** — `ui_contract/get` fetch over the existing WebSocket connection with durable/transient failure classification, a session cache keyed by `entry_id + contract_fingerprint`, automatic refetch on fingerprint changes, one bounded retry per reconnect, and per-entry last-good persistence rendered stale-marked while offline
- **Version gate** — the two compatibility screens: integrations older than the contract show "Update the integration", integrations newer than the app understands show "Update the app"
- **Token-mode status** — machine state from stable attribute tokens instead of localized string matching; legacy string matching kept as the pre-contract fallback in demo mode
- **Icon specs** — recipe icons rendered from server-derived icon descriptions, falling back to the built-in artwork
- **Parameter catalogs** — freestyle pickers, sliders, and limits driven by the served parameter descriptors
- **Action catalog** — the maintenance section renders the served, per-machine verified action list (with confirmation gates for destructive actions); recipe editing adopts served defaults
- **Step-by-step brew wizard** — multi-phase sommelier recipes (and favorites) no longer one-shot brew past their manual steps: each machine phase is brewed via `sommelier/brew_phase` with the recipe's own user actions interleaved and confirmed
- **Settings descriptors** — the settings section renders the served catalog: grouped rows, level tokens, unit numbers, and select controls (Nivona support), with entity-absence gating
- **DirectKey/profile model** — brew categories, profile slots, and slot bindings from the contract; recipe rows joined via `recipes/list` category tokens
- **Sommelier vocabulary** — enum pickers from the served vocabulary; free-form suggestion rows for milk, flavor notes, and extras
- **Server i18n** — machine-domain display strings fetched per locale with `strings_version` caching and revalidation; bundled en/ru/de strings remain the fallback tier
- **Brew-phase wizard** — step-by-step guided brewing for multi-phase sommelier recipes with live progress, confirmation prompts, and 2-hour re-entry
- **Sommelier error hints** — generation/brew failures mapped by error code to localized, actionable guidance
- **Capability-gated tabs** — Freestyle and Stats tabs hide when the machine reports no support for them

### Improvements

- Section visibility, labels, level names, and group headers resolve through a per-key chain: server string → bundled translation → humanized token
- Every contract feature degrades independently; the hardcoded tables remain permanent fallback fixtures
- Test suite expanded to 16+ suites covering the contract lifecycle, catalogs, settings, DirectKey model, vocabulary, wizard, and app wiring; tests now run in CI

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
