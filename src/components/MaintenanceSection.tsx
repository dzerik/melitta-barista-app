import { useState, useCallback } from "react";
import { callService, type Connection, type HassEntities } from "home-assistant-js-websocket";
import { getState, getEntity } from "../lib/entities";
import { pressButton, safeCall } from "../lib/ha";
import { usePreferences } from "../lib/preferences";
import type { UiContract } from "../lib/contract";
import { deriveMachineStatus } from "../lib/status";
import {
  resolveActionCatalog,
  maintenanceActionGroups,
  requiresContextFromStatus,
  evalRequires,
  needsConfirm,
  planActionInvocation,
  actionIconName,
  actionLabel,
  actionDescription,
  actionGroupLabel,
  type CatalogAction,
} from "../lib/actions";
import { serverString } from "../lib/server-strings";
import { resolveMdiIcon } from "../lib/icons";
import type { TranslationKey } from "../lib/i18n";
import { Glyph, GLYPH_PX, HANG, Heading, Rule, Word } from "./ui";
import {
  ROW_DESC_CLASS,
  ROW_GUTTER,
  ROW_LABEL_CLASS,
  settingsRowStyle,
} from "./SettingsRow";
import iconMaintenance from "../assets/icons/maintenance.png";
import iconWater from "../assets/icons/water.png";
import iconTemperature from "../assets/icons/temperature.png";
import iconSettings from "../assets/icons/settings.png";

/**
 * The row mark, at the shared `row` rung (C28).
 *
 * It used to be a bare `w-6 h-6` raster with a hardcoded English `alt`, while
 * SettingsSection drew the SAME assets at `w-5 h-5` with the §6.6 opacity
 * knock-down. One ladder now: 20px, decorative, hidden from the accessibility
 * tree because the label beside it already says the word.
 */
function MelittaIcon({ src }: { src: string }) {
  return <Glyph src={src} alt="" />;
}

/**
 * The catalog row's mark — a served mdi name resolved to a lucide node (C27).
 *
 * It goes through `Glyph` for the same reason the settings tab's does: a raw
 * `<Icon size={20}>` in a hand-rolled span is a THIRD way of drawing the one
 * role, and it occupies a box the raster mark beside it does not, so two rows
 * of the same list line their labels up differently. `Glyph` owns the box, the
 * 20px rung and the shrink; this only says what to draw and in what ink.
 */
function ActionIcon({ icon }: { icon: string }) {
  const Icon = resolveMdiIcon(icon);
  return (
    <Glyph alt="" style={{ color: "var(--text-tertiary)" }}>
      <Icon size={GLYPH_PX.row} strokeWidth={1.75} />
    </Glyph>
  );
}

interface Props {
  conn: Connection;
  entities: HassEntities;
  prefix: string;
  /** UI Contract document (P-I wiring); null/omitted → legacy tables. */
  contract?: UiContract | null;
}

interface MaintenanceAction {
  key: string;
  suffix: string;
  labelKey: TranslationKey;
  descKey: TranslationKey;
  icon: React.ReactNode;
  confirm?: boolean;
}

/**
 * Legacy hardcoded action tables — the permanent §6.2.5.1 fallback rendered
 * whenever the contract serves no action catalog (pre-0.92 integrations).
 */
const CLEANING_ACTIONS: MaintenanceAction[] = [
  {
    key: "easy_clean",
    suffix: "easy_clean",
    labelKey: "maint.easy_clean",
    descKey: "maint.easy_clean_desc",
    icon: <MelittaIcon src={iconMaintenance} />,
    confirm: true,
  },
  {
    key: "intensive_clean",
    suffix: "intensive_clean",
    labelKey: "maint.intensive_clean",
    descKey: "maint.intensive_clean_desc",
    icon: <MelittaIcon src={iconMaintenance} />,
    confirm: true,
  },
  {
    key: "descaling",
    suffix: "descaling",
    labelKey: "maint.descaling",
    descKey: "maint.descaling_desc",
    icon: <MelittaIcon src={iconWater} />,
    confirm: true,
  },
  {
    key: "evaporating",
    suffix: "evaporating",
    labelKey: "maint.evaporating",
    descKey: "maint.evaporating_desc",
    icon: <MelittaIcon src={iconTemperature} />,
    confirm: true,
  },
];

const FILTER_ACTIONS: MaintenanceAction[] = [
  {
    key: "filter_insert",
    suffix: "filter_insert",
    labelKey: "maint.filter_insert",
    descKey: "maint.filter_insert_desc",
    icon: <MelittaIcon src={iconWater} />,
  },
  {
    key: "filter_replace",
    suffix: "filter_replace",
    labelKey: "maint.filter_replace",
    descKey: "maint.filter_replace_desc",
    icon: <MelittaIcon src={iconWater} />,
  },
  {
    key: "filter_remove",
    suffix: "filter_remove",
    labelKey: "maint.filter_remove",
    descKey: "maint.filter_remove_desc",
    icon: <MelittaIcon src={iconWater} />,
  },
];

const OTHER_ACTIONS: MaintenanceAction[] = [
  {
    key: "switch_off",
    suffix: "switch_off",
    labelKey: "maint.switch_off",
    descKey: "maint.switch_off_desc",
    icon: <MelittaIcon src={iconSettings} />,
    confirm: true,
  },
];

const stagger = (index: number) => ({ animationDelay: `${index * 60}ms` });

/**
 * The programme's announced duration, when the machine's own vocabulary
 * carries one (`actions.<action>.duration`, e.g. "примерно 20 минут").
 *
 * Disclosing duration BEFORE the user commits is the single most consistent
 * rule in the maintenance flows of every panel studied ("the cleaning
 * programme lasts approximately 20 minutes"). The sentence is machine-domain
 * truth, so it is served like every other machine string rather than composed
 * here: an unserved key renders nothing at all instead of inventing a figure.
 */
function actionDuration(action: string): string | null {
  return serverString(`actions.${action}.duration`) ?? null;
}

/**
 * One rendered maintenance row — shared markup for both catalog and legacy
 * modes.
 *
 * §G2.7 draws it as a hairline row on the page ground: a bare glyph, the
 * label with its description and duration beneath it, and the action as the
 * shared `Word` on the right. No card, no fill, no ring, no radius, no icon
 * plate.
 *
 * ONE ROW, DECLARED ONCE (C4). The settings tab and this tab draw the same
 * role, and the audit found them disagreeing on every measure of it: the label
 * was `t-body` here against a raw 14px `text-sm` there, the gutter `gap-4`
 * here against `gap-3` there, and the 10px hang a `px-2.5` class here against
 * an inline constant there. All three decisions now come from `SettingsRow` —
 * `settingsRowStyle` for the frame (the 80px pitch, the opening hairline, the
 * hang and the arrival delay), `ROW_GUTTER` for the gutter, `ROW_LABEL_CLASS`
 * and `ROW_DESC_CLASS` for the type — so the two lists are one shape and a
 * change to the pitch or the label step lands in both at once.
 *
 * The label block is composed here rather than through `RowHeading` for one
 * reason: a maintenance row has a THIRD line the settings row does not — the
 * programme's announced duration — and `RowHeading` renders exactly label and
 * description (its `children` prop is declared but not rendered). It takes the
 * same two class constants, so the type is identical either way.
 *
 * ARMING IS INK, NOT A RULE (C5). This row used to be the one action in the
 * app wearing a reserved underline slot: transparent at rest, `--accent` once
 * armed, `--error-border` once armed on a destructive entry. In this language
 * an underline means CHOSEN, and an action is not chosen — so the slot is gone
 * and arming is said the way §10 says it, by inking the word `--error-text`.
 * The second, quieter armed style went with it: every armed row already reads
 * "Confirm", and the two arming looks existed only because the underline was
 * carrying a distinction the word itself makes. That also retires the last
 * caller of `isDestructive` here — a confirming action and a destructive one
 * are armed identically because both are one tap from happening.
 */
function ActionCard({
  index,
  icon,
  label,
  description,
  duration,
  isConfirming,
  isBusy,
  disabled,
  onPress,
  confirmText,
  startText,
}: {
  index: number;
  icon: React.ReactNode;
  label: string;
  description: string | null;
  duration: string | null;
  isConfirming: boolean;
  isBusy: boolean;
  disabled: boolean;
  onPress: () => void;
  confirmText: string;
  startText: string;
}) {
  return (
    <div
      className={`settings-card-enter flex items-center ${ROW_GUTTER} py-3`}
      // C4/C23: the frame, the 80px pitch and the one spelling of the 10px
      // hang all come from the shared row module — never re-decided here.
      style={settingsRowStyle(index)}
    >
      {icon}

      <div className="flex-1 min-w-0">
        <div className={ROW_LABEL_CLASS}>{label}</div>
        {description !== null && (
          <div className={`${ROW_DESC_CLASS} mt-0.5`}>{description}</div>
        )}
        {duration !== null && (
          <div
            data-ui="action-duration"
            className={`${ROW_DESC_CLASS} num mt-0.5`}
          >
            {duration}
          </div>
        )}
      </div>

      {/* §10: in-flight dims the acting control only (0.5); disabled is 0.35. */}
      <Word
        label={isConfirming ? confirmText : startText}
        tone={isConfirming ? "destructive" : "quiet"}
        onClick={onPress}
        busy={isBusy}
        disabled={disabled && !isBusy}
        className="shrink-0"
      />
    </div>
  );
}

/** A quiet line of type between two hairlines — §10's no-box notice form. */
function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <Rule />
      <div
        className="py-4 text-center t-label text-tertiary"
        style={{ paddingLeft: HANG, paddingRight: HANG }}
      >
        {children}
      </div>
      <Rule />
    </div>
  );
}

/**
 * The maintenance tab: one 80px row per programme, grouped under quiet
 * headings, each disclosing its duration before the user commits.
 *
 * WHY THIS TAB SCROLLS AND THE DRINK SHELVES PAGE (C32). Paging works on the
 * recipe grid because a drink cell has a FIXED size — eight of them fill a
 * page exactly, so a page boundary can never land inside a cell. A maintenance
 * row does not: its height is content-driven, since the label, the served
 * description and the served duration each wrap to one, two or three lines
 * depending on the locale, so no rows-per-page exists that neither clips a row
 * nor leaves half a page of bare ground. The list is also read as one ordered
 * whole — "which programme do I want" is a comparison across the whole tab —
 * and a pager would hide half the options behind a gesture while the user is
 * making it. A shelf of drinks has neither problem.
 *
 * So the rule is not "tabs page" but: FIXED-SIZE CELLS PAGE, CONTENT-HEIGHT
 * ROWS SCROLL. This tab, settings and stats all take the same single
 * `.custom-scroll` scroller; recipes and the sommelier shelf page.
 */
export function MaintenanceSection({ conn, entities, prefix, contract = null }: Props) {
  const { t, locale } = usePreferences();
  const [confirmKey, setConfirmKey] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const catalog = resolveActionCatalog(contract);

  // Legacy flags — kept byte-identical to the pre-contract app for the
  // fallback tables (missing state sensor defaults to ready, as before).
  const machineState = (
    getState(entities, prefix, "sensor", "state") || "ready"
  ).toLowerCase();
  const legacyReady = machineState === "ready";
  const legacyConnected =
    getState(entities, prefix, "sensor", "connection") === "Connected";

  // Catalog mode gates per entry via `requires` (§6.2.4) — no blanket
  // ready-gate, so switch_off stays usable while connected-not-ready (PR #42
  // as data). The banners reflect the same context.
  const view = deriveMachineStatus(entities, prefix, locale);
  const ctx = requiresContextFromStatus(view);
  const isConnected = catalog !== null ? ctx.connected : legacyConnected;
  const isReady = catalog !== null ? ctx.ready : legacyReady;

  const finishPress = useCallback(
    (key: string, run: () => Promise<unknown>) => {
      setConfirmKey(null);
      setBusyKey(key);
      safeCall(async () => {
        await run();
        // Clear busy state after a short delay
        setTimeout(() => setBusyKey(null), 2000);
      });
    },
    [],
  );

  const handleLegacyPress = useCallback(
    (action: MaintenanceAction) => {
      if (action.confirm && confirmKey !== action.key) {
        setConfirmKey(action.key);
        return;
      }
      const entityId = `button.${prefix}_${action.suffix}`;
      finishPress(action.key, () => pressButton(conn, entityId));
    },
    [conn, prefix, confirmKey, finishPress],
  );

  const handleCatalogPress = useCallback(
    (entry: CatalogAction) => {
      if (needsConfirm(entry) && confirmKey !== entry.action) {
        setConfirmKey(entry.action);
        return;
      }
      const plan = planActionInvocation(entry, prefix);
      finishPress(entry.action, () =>
        "button" in plan
          ? pressButton(conn, `button.${prefix}_${plan.button}`)
          : callService(conn, plan.domain, plan.service, plan.data),
      );
    },
    [conn, prefix, confirmKey, finishPress],
  );

  const renderLegacySection = (
    title: TranslationKey,
    actions: MaintenanceAction[],
    startIndex: number,
  ) => (
    <>
      <Heading hang="inner" className="settings-header-enter" style={stagger(startIndex)}>
        {t(title)}
      </Heading>
      <div className="mb-6">
        {actions.map((action, i) => {
          const exists = getEntity(entities, prefix, "button", action.suffix);
          if (!exists) return null;
          return (
            <ActionCard
              key={action.key}
              index={startIndex + i + 1}
              icon={action.icon}
              label={t(action.labelKey)}
              description={t(action.descKey)}
              duration={actionDuration(action.key)}
              isConfirming={confirmKey === action.key}
              isBusy={busyKey === action.key}
              disabled={!legacyConnected || !legacyReady || busyKey === action.key}
              onPress={() => handleLegacyPress(action)}
              confirmText={t("maint.confirm")}
              startText={t("maint.start")}
            />
          );
        })}
      </div>
    </>
  );

  const renderCatalogGroup = (
    group: string,
    entries: CatalogAction[],
    startIndex: number,
  ) => (
    <div key={group}>
      <Heading hang="inner" className="settings-header-enter" style={stagger(startIndex)}>
        {actionGroupLabel(locale, group)}
      </Heading>
      <div className="mb-6">
        {entries.map((entry, i) => {
          const isBusy = busyKey === entry.action;
          return (
            <ActionCard
              key={entry.action}
              index={startIndex + i + 1}
              icon={<ActionIcon icon={actionIconName(entry)} />}
              label={actionLabel(locale, entry.action)}
              description={actionDescription(locale, entry.action)}
              duration={actionDuration(entry.action)}
              isConfirming={confirmKey === entry.action}
              isBusy={isBusy}
              disabled={!evalRequires(entry.requires, ctx) || isBusy}
              onPress={() => handleCatalogPress(entry)}
              confirmText={t("maint.confirm")}
              startText={t("maint.start")}
            />
          );
        })}
      </div>
    </div>
  );

  // Reset confirm state on tap outside
  const handleContainerClick = useCallback(() => {
    if (confirmKey) setConfirmKey(null);
  }, [confirmKey]);

  const cleaningStart = 0;
  const filterStart = CLEANING_ACTIONS.length + 1;
  const otherStart = filterStart + FILTER_ACTIONS.length + 1;

  // Catalog mode: served groups minus the informational brew/control ones
  // (§6.2.5.2), with entries lacking their anchor button entity hidden.
  const catalogGroups =
    catalog === null
      ? null
      : maintenanceActionGroups(catalog)
          .map((g) => ({
            group: g.group,
            entries: g.entries.filter((e) =>
              getEntity(entities, prefix, "button", e.invocation.entity_suffix),
            ),
          }))
          .filter((g) => g.entries.length > 0);

  return (
    <div
      className="flex h-full flex-col"
      // §G2.1: rows and their rules run rail to rail; text hangs 10px inside.
      style={{ paddingLeft: "var(--rail)", paddingRight: "var(--rail)" }}
      onClick={handleContainerClick}
    >
      {/* The tab body is ONE scroller, and it is the same one the settings tab
          uses: a `flex-1 min-h-0` child of a rail-padded root, scrolled with
          `.custom-scroll` (§G2.2's sanctioned scroll) and nothing else. It was
          the root itself here and an inner box there, which is why the two
          lists behaved differently at the top and bottom edges. Overscroll is
          left at the browser default on purpose, which is the same decision
          the other two scrolling tabs make: `body` is `overflow: hidden`
          (index.css:217), so there is no ancestor for a scroll to chain into
          and `overscroll-behavior` would be a property that reads as a rule
          while changing nothing. See SettingsSection's header for WHY this tab
          scrolls where the drink shelves page (C32). */}
      <div className="flex-1 min-h-0 flex flex-col overflow-y-auto custom-scroll py-5">
        {!isConnected && <Notice>{t("maint.offline")}</Notice>}

        {isConnected && !isReady && <Notice>{t("maint.not_ready")}</Notice>}

        {catalogGroups !== null ? (
          (() => {
            let start = 0;
            return catalogGroups.map((g) => {
              const rendered = renderCatalogGroup(g.group, g.entries, start);
              start += g.entries.length + 1;
              return rendered;
            });
          })()
        ) : (
          <>
            {renderLegacySection("maint.section_cleaning", CLEANING_ACTIONS, cleaningStart)}
            {renderLegacySection("maint.section_filter", FILTER_ACTIONS, filterStart)}
            {renderLegacySection("maint.section_other", OTHER_ACTIONS, otherStart)}
          </>
        )}
      </div>
    </div>
  );
}
