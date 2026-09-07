# Changelog

## [3.1.3] — 2026-09-07 (not released)

### Fixed

- **A drink is drawn at its real size again.** The 25 recipe drawings share one 1080×720 canvas and stand on one baseline, and the glasses inside them are already to scale — an espresso measures 0.44× a latte macchiato in the artwork, and 0.43× on the counter. The app was then rescaling those files by the recipe's volume, so the truth was applied twice and small drinks came out smaller than they are. Sizing now belongs to the file; only a procedural drawing, which fills whatever box it is given, is still scaled by us. The freestyle placeholder was the one drawing on a canvas of its own (900×873) and has been redrawn onto the shared one, so it stands with the family instead of towering over it.
- **The light now sits on the glass rather than beside it.** Because the canvas is shared, the drawn glass occupies between 11% and 68% of its frame and is not always centred in it — a hot water glass sits 12% of the canvas to the right. The halo, the contact line and the reflection were all sized and placed by the frame, which put them around the empty air next to the cup. Each drawing's glass is now measured (`scripts/drink-metrics.mjs`, checked in as `src/lib/drink-metrics.ts`) and the light is placed on it.
- The statistics grid no longer shrinks a glass by how often it was poured: how often is the wash behind the tile, and one fact is encoded once.

## [3.1.2] — 2026-09-07

### Fixed

- CI's lint gate was red on the 3.1.1 tree: two hook dependency lists omitted a value the React Compiler infers, so it stopped optimising those components, and the maintenance row built its icon component during render. The row icon now goes through one shared helper that Settings and Maintenance both call — which is the shape C28 asked for in the first place — and the dependency lists say what they use.

## [3.1.1] — 2026-09-07 (not released)

### Fixed

- **The brewing screen no longer claims a drink it cannot know.** Start hot water at the machine and the app used to show whatever its own picker happened to hold — a cappuccino, with a composition strip of millilitres nobody had asked for. The machine's status frame carries a phase (grinding, coffee, steam, water, prepare) and no product identity at all, and the recipe selector is written by this app and never read back, so the drink is knowable only when this app asked for it. It now names the drink for a pour it started, and for anyone else's pour it draws the phase the machine reports — water as water, steam as milk — with no name and no composition.

## [3.1.0] — 2026-09-07 (not released)

### Added

- **Three themes, chosen by material rather than by colour.** *Cappuccino* is what the app has been: porcelain and paper, flat rules, crema accent. *Obsidian* is glass and chrome — a graded near-black ground, chrome hairlines, a commit rectangle that reads as a reflection with a 1px light edge, platinum accents and thin type, so the only warm thing on the screen is the drink itself; it is dark-only, because a glossy black light theme is a contradiction. *Caramel* is the opposite of obsidian: matte molasses with no gloss anywhere, dense rules, burnt-sugar accent, a warm close glow with almost no reflection, and type one step heavier — caramel is thick, and the type says so. The three are separable on a black-and-white screenshot.
- Theme and mode are now two axes. Picking a dark-only family paints dark without overwriting the mode you chose, so switching back restores it. New keys in all 29 languages.

### Changed

- The rule against fills is amended, deliberately and narrowly: a gradient is legal on the page ground, a rule, a selection underline, the one commit rectangle, and the drink's own imagery. Containers and controls still paint nothing, in every family, and a test pins it.
- Weight becomes a theme axis; the four-step size scale stays frozen.

### Fixed

- **Contrast.** Measuring every ink against every ground turned up failures the app already shipped: tertiary text was 4.06:1 on the dark ground and 2.99:1 on porcelain, and the light accent 3.62:1 — all below WCAG AA at the sizes they are set in. Every ink in every family now clears 4.5:1.
- The drink's reflection keeps its 1px floor, which it lost when its ratio became a token.
- An armed DirectKey tile takes the family's commit material, so the same act is not painted two ways.

## [3.0.1] — 2026-09-07 (not released)

### Fixed

- The consistency pass over the design language: the app now solves each problem one way. Six hand-rolled copies of the "bare word" action, three hairline colours for the same input rule, four modal headers, five panel measures, four close controls and three pager dots collapse into shared shapes — `Word`, `Field`, `Panel`, `ActionBand`, `Dot`, `Heading`, `Glyph`, `SettingsRow`, `Mosaic`.
- One verb for one act: the sommelier's separate "brew" string is gone from all 29 languages, so the same button no longer reads two different words in two tabs.
- One brewing screen. Two of them used to mount on the same state, one occluding the other.
- Settings rows and maintenance rows are the same row: one label treatment, one pitch, one gutter.
- Selection in the recipe list is the name over a lit underline, like everywhere else, instead of an accent-filled gutter. The settings row glyph stops using the accent to mean "on" — a toggled state is not one of the accent's four jobs.
- The three hairline mosaics are one component with a fixed column count that completes its last row, so a half-empty row can no longer leave the divider ground showing as a tinted slab.
- The drink glass keeps one implementation of its reflection, and truth-scale by volume moved into `CoffeeIcon` instead of being hand-rolled in statistics.
- Dead CSS that re-enabled banned treatments one class away is gone, along with token names nothing read.
- Hardcoded English in pager labels, the ALL-CAPS "2x ON", and Title Case in English settings strings are fixed; 9 new keys landed in all 29 languages.
- The test suite's hard-rule walk had grown seven copies that disagreed on whether `transparent` counts as a fill. One definition now, imported everywhere.

## [3.0.0] — 2026-09-07

The app is drawn the way a coffee machine's own panel is drawn.

### Changed

- **No rounded frames, anywhere.** Every rectangle in the app is square. The only curves left are true circles — pagination dots, step markers — and the drawn contour of a glass. The capsule chips that carried every choice, and the rounded bordered cards that held every drink, are gone.
- **No background fills.** A control is a word, a glyph, a meter or a rule; a container is bounded by a hairline, by the 1px gap of its own grid, or by nothing at all. Four things may still paint: the scrim under a modal, one flat neutral panel per modal, the single committing rectangle on a screen, and the filled segments of a meter — where the paint *is* the value being shown.
- **Selection is the word, not a box.** The chosen option turns white over a lit 1px accent underline, in a slot that is always reserved so nothing shifts when you choose. The accent is spent in four places — the one commit, the lit underline, position and progress marks, and the label half of a value pair — and withheld everywhere else.
- **One set of controls for the whole app.** Option, OptionRow, Commit, Meter, TickRing, DrinkStage and Rule live in one place, and all six tabs are built on them, so the same choice is drawn the same way whether it sits in Settings, in a recipe or in the sommelier.
- **Drinks are lit against the ground.** Each one gets a neutral glow, a reflection and a contact shading — never a plate, a ring or a shadow — and is sized by its role: 280px as the hero of a page, 140px in a grid cell, 64px in a mosaic tile. The drink never carries the selection state; that is what the name and its underline are for.
- **Progress follows the machine.** Brewing keeps the drink, its name and its composition on screen and adds a segmented meter along the bottom, exactly as the Barista TS does; the tick ring is reserved for maintenance programmes, where the duration is known and announced before you commit to it.
- Settings, service and the sommelier are laid out as rows separated by hairlines at one pitch, rather than as stacks of cards.

### Why

The interface had drifted into the default shapes of a generic UI kit. Read against the panels of Franke, WMF, Jura, De'Longhi and Melitta's own machine, not one of them draws a drink in a tile, a fill or a bordered box: cells are separated by 1px hairlines, filled shapes are rationed to one or two per screen, and selection is a fill swap on the same shape or a marker in the gutter. The app's own Recipes and "Свой рецепт" pages already worked that way; this release brings the rest of the app to them.

## [2.5.1] — 2026-09-06

### Changed

- **The sommelier drops the outlined capsules.** Mood, occasion, temperature, servings and the number of suggestions were rounded chips with a ring each — the default shape of a generic UI kit, and nothing a coffee machine's own screen has ever drawn. They are now plain words in ruled rows, the chosen one lit in crema and underlined. The tabs lost their filled buttons for the same reason: three words with a rule beneath them, the current one lit.
- **Recipes read as a machine sheet.** A drink is separated from the next by a hairline rather than wrapped in a bordered box; the name is set large and light, and what it is made of runs as one strip of values divided by rules. Caffeine and calories moved into the details, where the steps are now numbered in crema.
- The wish field is a line to write on instead of a rounded input, and the commit button is a plain rectangle.

## [2.5.0] — 2026-09-06

The sommelier looks like the rest of the app, and history is a place you can order from.

### Added

- **Brew from history.** Past suggestions were a read-only log — a grey name with a cross beside it — so a drink you liked on Tuesday could only be had again by generating until it came back. Every row is now a full recipe card with the same Brew and the same ♥ as everywhere else, multi-phase drinks included (they open the step wizard, as they should).
- **Drinks are drawn.** Every sommelier recipe now shows the glass its composition describes, using the icon the integration has been serving since 0.91 and the app was ignoring. Suggestions, favourites and history look like the machine's own recipes because they are described the same way.

### Changed

- **One card for all three tabs.** Suggestions, favourites and history each drew their own thing from the same data; they now share a card with one hierarchy — drink, name, what it is, what it is made of, and an action bar that lines up across a row.
- **Generate reads as a brief, not a form.** The two hopper cards and the milk row collapse into one quiet strip of what the machine is loaded with; the free-text wish leads; mood, occasion, temperature, servings and the number of suggestions became labelled rows of the same rank. The bare native dropdown for the suggestion count is gone, as are the two competing primary buttons — Generate is primary, Surprise me is secondary.
- The sommelier content column is capped and laid out in a responsive grid, so descriptions stop running the full width of a desktop screen.

### Fixed

- Dates and times in history and favourites followed the browser's language, not the app's — a Russian interface printed `9/3/2026`. They now read `3 сентября 2026 г.`
- A favourite's brew count was a cryptic `x1`; it now says how many times it was brewed and when it was last made.
- The delete button on a favourite sat outside the card's frame, and the Brew button was dark-on-dark in the dark theme.

## [2.4.1] — 2026-09-05

### Fixed

- Installing the app asked the browser for `/icon-192.png` at the site root, which is a 404 anywhere the app is not served from `/` — GitHub Pages and the `/melitta/` deployment both. The manifest now points at its icons relatively, so they resolve wherever the app lives.
- The manifest's theme and background colours were black; they are the espresso ground the app actually paints, so the splash screen no longer flashes a different colour than the app.

## [2.4.0] — 2026-09-04

### Added

- **The sign-in screen speaks all 29 languages.** Its wording — the form, the token hint, the security note, the "screen too small" gate and the two version-mismatch screens — existed only in English, Russian and German, so picking any other language on that screen changed the list and nothing else. All of it is now translated. This is the one surface the integration cannot serve strings for, since nothing is connected yet, so the bundles carry it and a test keeps every locale complete.

## [2.3.1] — 2026-09-04

### Fixed

- The language list on the sign-in screen was a native dropdown, so it opened as a system menu in the system's colours — white against the dark app. It is now the app's own list: same surface, border and accent as the form around it, every row a full-size target, the current language checked and scrolled into view, and it closes on Escape or a press outside.
- Rows in that list and in the preferences language list read from the left edge again; the shared tap-target utility had been centring them.

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
