import type { HassEntities } from "home-assistant-js-websocket";
import { getEntity } from "../lib/entities";
import { usePreferences } from "../lib/preferences";
import { CoffeeIcon } from "./CoffeeIcon";

interface Props {
  entities: HassEntities;
  prefix: string;
}

interface CounterEntry {
  name: string;
  count: number;
}

export function StatsSection({ entities, prefix }: Props) {
  const { t } = usePreferences();
  const entity = getEntity(entities, prefix, "sensor", "total_cups");
  const total = entity?.state ? parseInt(entity.state, 10) : null;
  const attrs = entity?.attributes || {};

  const counters: CounterEntry[] = [];
  for (const [name, val] of Object.entries(attrs)) {
    if (
      typeof val === "number" &&
      name !== "friendly_name" &&
      name !== "unit_of_measurement" &&
      name !== "state_class" &&
      name !== "icon"
    ) {
      counters.push({ name, count: val });
    }
  }
  counters.sort((a, b) => b.count - a.count);
  const maxCount = counters.length > 0 ? counters[0].count : 1;

  if (total === null || isNaN(total)) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-secondary text-sm">{t("stats.not_available")}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="flex flex-col items-center gap-1 py-8 border-b border-border">
        <span className="text-6xl font-extralight text-primary tabular-nums tracking-tight">
          {total.toLocaleString()}
        </span>
        <span className="text-[10px] font-medium text-tertiary uppercase tracking-[0.2em]">
          {t("stats.total_cups")}
        </span>
      </div>

      <div className="flex-1 p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
          {counters.map(({ name, count }, i) => {
            const fraction = count / maxCount;
            const isTop = i === 0;
            return (
              <div
                key={name}
                className="relative flex flex-col items-center rounded-xl overflow-hidden transition ring-1"
                style={{
                  "--tw-ring-color": isTop ? "var(--border-hover)" : "var(--border)",
                  background: isTop ? "var(--surface-card-active)" : "var(--surface-card)",
                } as React.CSSProperties}
              >
                <div
                  className="absolute bottom-0 left-0 right-0 transition-all duration-700"
                  style={{ height: `${fraction * 100}%`, background: "var(--surface-card)" }}
                />
                <div className="relative z-10 flex flex-col items-center px-3 pt-3 pb-2.5 w-full">
                  <CoffeeIcon recipe={name} size={64} />
                  <span className="text-[11px] text-secondary font-medium mt-1 truncate w-full text-center leading-tight">
                    {name}
                  </span>
                  <span className={`text-lg tabular-nums font-light mt-0.5 ${isTop ? "text-primary" : "text-secondary"}`}>
                    {count}
                  </span>
                </div>
                {isTop && (
                  <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full" style={{ background: "var(--accent)" }} />
                )}
              </div>
            );
          })}
        </div>

        {counters.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-4 py-16">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="w-16 h-16 text-tertiary">
              <path d="M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8zM6 1v3M10 1v3M14 1v3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p className="text-tertiary text-sm">{t("stats.no_cups")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
