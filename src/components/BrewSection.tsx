import { useRef, useState, useEffect } from "react";
import type { Connection, HassEntities } from "home-assistant-js-websocket";
import { getState, getOptions, getEntity } from "../lib/entities";
import { selectOption, pressButton } from "../lib/ha";
import { CoffeeIcon } from "./CoffeeIcon";

interface Props {
  conn: Connection;
  entities: HassEntities;
  prefix: string;
}

export function BrewSection({ conn, entities, prefix }: Props) {
  const machineState = getState(entities, prefix, "sensor", "state");
  const isReady = machineState === "Ready";
  const isBrewing = machineState === "Brewing";
  const activity = getState(entities, prefix, "sensor", "activity") || "";
  const progress = getState(entities, prefix, "sensor", "progress");
  const actionRequired = getState(entities, prefix, "sensor", "action_required");
  const hasAction = actionRequired && actionRequired !== "None";
  const progressNum = progress
    ? Math.min(100, Math.max(0, parseFloat(progress)))
    : 0;

  const profileOptions = getOptions(entities, prefix, "profile");
  const selectedProfile = getState(entities, prefix, "select", "profile");
  const recipeOptions = getOptions(entities, prefix, "recipe");
  const selectedRecipe = getState(entities, prefix, "select", "recipe");

  const brewId = `button.${prefix}_brew`;
  const cancelId = `button.${prefix}_cancel`;

  // Tooltip position
  const gridRef = useRef<HTMLDivElement>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!selectedRecipe || !gridRef.current) {
      setTooltipPos(null);
      return;
    }
    const btn = gridRef.current.querySelector<HTMLElement>(`[data-recipe="${selectedRecipe}"]`);
    if (!btn) { setTooltipPos(null); return; }
    const gridRect = gridRef.current.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    setTooltipPos({
      x: btnRect.left - gridRect.left + btnRect.width / 2,
      y: btnRect.top - gridRect.top - 8,
    });
  }, [selectedRecipe, recipeOptions]);

  // Brewing state
  if (isBrewing) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6 px-6">
        <CoffeeIcon recipe={activity || "Espresso"} size={96} />
        <div className="text-center">
          <div className="text-xl font-bold text-amber-300">{activity}</div>
          {progress && (
            <div className="text-coffee-400 mt-1">{progressNum}%</div>
          )}
        </div>
        {progress && (
          <div className="w-64 h-2 rounded-full bg-coffee-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-amber-400 transition-all duration-500"
              style={{ width: `${progressNum}%` }}
            />
          </div>
        )}
        <button
          onClick={() => pressButton(conn, cancelId)}
          className="rounded-xl px-8 py-3 text-sm font-medium text-red-400 ring-1 ring-red-800 hover:bg-red-900/30 transition active:scale-[0.98]"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3 px-4 py-2">
      {/* Action required */}
      {hasAction && (
        <div className="flex items-center gap-2 rounded-xl bg-red-900/20 px-4 py-2.5 text-sm text-red-300 ring-1 ring-red-800 shrink-0">
          <span>⚠️</span>
          <span>{actionRequired}</span>
        </div>
      )}

      {/* Profile chips */}
      {isReady && profileOptions.length > 1 && (
        <div className="flex gap-1.5 shrink-0 overflow-x-auto">
          {profileOptions.map((opt) => (
            <button
              key={opt}
              onClick={() =>
                selectOption(conn, `select.${prefix}_profile`, opt)
              }
              className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition active:scale-[0.96] ${
                opt === selectedProfile
                  ? "bg-coffee-600 text-coffee-50"
                  : "bg-coffee-800/50 text-coffee-400 ring-1 ring-coffee-700"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      {/* Recipe grid — fills remaining space */}
      {isReady && recipeOptions.length > 0 && (
        <div className="flex-1 min-h-0 relative" ref={gridRef}>
          <div className="h-full grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 auto-rows-fr gap-2">
            {recipeOptions.map((opt) => (
              <button
                key={opt}
                data-recipe={opt}
                onClick={() =>
                  selectOption(conn, `select.${prefix}_recipe`, opt)
                }
                className={`aspect-square flex flex-col items-center justify-center gap-1 rounded-2xl p-1.5 transition active:scale-[0.95] ${
                  opt === selectedRecipe
                    ? "bg-coffee-600 ring-2 ring-coffee-400 shadow-lg shadow-coffee-400/20"
                    : "bg-coffee-700/60 ring-1 ring-coffee-600/40 hover:bg-coffee-600/50 hover:ring-coffee-500/50"
                }`}
              >
                <CoffeeIcon recipe={opt} size={40} />
                <span
                  className={`text-[10px] leading-tight text-center font-medium ${
                    opt === selectedRecipe ? "text-coffee-50" : "text-coffee-300"
                  }`}
                >
                  {opt}
                </span>
              </button>
            ))}
          </div>

          {/* Brew tooltip */}
          {selectedRecipe && tooltipPos && (
            <div
              className="absolute z-10 transition-all duration-200"
              style={{
                left: tooltipPos.x,
                top: tooltipPos.y,
                transform: "translate(-50%, -100%)",
              }}
            >
              <button
                onClick={() => {
                  if (getEntity(entities, prefix, "button", "brew")) {
                    pressButton(conn, brewId);
                  }
                }}
                className="flex items-center gap-2 rounded-2xl bg-coffee-400 px-8 py-4 text-lg font-bold text-coffee-950 shadow-xl shadow-coffee-400/30 transition hover:bg-coffee-300 active:scale-[0.95] whitespace-nowrap"
              >
                ☕ Brew
              </button>
              {/* Arrow */}
              <div className="flex justify-center">
                <div className="w-4 h-4 bg-coffee-400 rotate-45 -mt-2.5" />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
