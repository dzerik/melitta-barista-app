import { useState } from "react";
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

  const [profileOpen, setProfileOpen] = useState(false);

  // Brewing state
  if (isBrewing) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6 px-6">
        <CoffeeIcon recipe={activity || "Espresso"} size={240} />
        <div className="text-center">
          <div className="text-xl font-light text-white tracking-wide">{activity}</div>
          {progress && (
            <div className="text-neutral-500 mt-1 text-sm">{progressNum}%</div>
          )}
        </div>
        {progress && (
          <div className="w-64 h-px bg-neutral-800 overflow-hidden">
            <div
              className="h-full bg-white transition-all duration-500"
              style={{ width: `${progressNum}%` }}
            />
          </div>
        )}
        <button
          onClick={() => pressButton(conn, cancelId)}
          className="rounded-lg px-8 py-2.5 text-sm font-medium text-neutral-500 ring-1 ring-neutral-700 hover:bg-neutral-900 transition active:scale-[0.98]"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Action required */}
      {hasAction && (
        <div className="flex items-center gap-2 mx-4 mt-2 rounded-lg bg-red-950/30 px-4 py-2.5 text-sm text-red-400 ring-1 ring-red-900/50 shrink-0">
          <span>{actionRequired}</span>
        </div>
      )}

      {/* Profile menu */}
      {isReady && profileOptions.length > 1 && (
        <div className="relative shrink-0 self-end mr-4 mt-2">
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex flex-col gap-[3px] p-2 rounded-lg hover:bg-neutral-800 transition"
          >
            <span className="block w-4 h-px bg-neutral-400" />
            <span className="block w-4 h-px bg-neutral-400" />
            <span className="block w-4 h-px bg-neutral-400" />
          </button>
          {profileOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setProfileOpen(false)} />
              <div className="absolute right-0 top-full mt-1 z-20 min-w-[140px] rounded-lg bg-neutral-900 ring-1 ring-neutral-700 py-1 shadow-xl">
                {profileOptions.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => {
                      selectOption(conn, `select.${prefix}_profile`, opt);
                      setProfileOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-sm transition ${
                      opt === selectedProfile
                        ? "text-white bg-neutral-800"
                        : "text-neutral-400 hover:text-white hover:bg-neutral-800/60"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Recipe grid */}
      {isReady && recipeOptions.length > 0 && (
        <div className="flex-1 min-h-0">
          <div
            className="h-full grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 auto-rows-fr"
            style={{ gap: "1px", background: "rgba(255,255,255,0.06)" }}
          >
            {recipeOptions.map((opt) => {
              const isSelected = opt === selectedRecipe;
              return (
                <button
                  key={opt}
                  onClick={() => {
                    if (isSelected && getEntity(entities, prefix, "button", "brew")) {
                      pressButton(conn, brewId);
                    } else {
                      selectOption(conn, `select.${prefix}_recipe`, opt);
                    }
                  }}
                  className={`relative flex flex-col items-center justify-center p-2 transition active:scale-[0.97] ${
                    isSelected
                      ? "bg-neutral-900"
                      : "bg-black hover:bg-neutral-950"
                  }`}
                >
                  <CoffeeIcon recipe={opt} size={120} />
                  <span className={`absolute bottom-0 left-0 right-0 text-center text-xs font-semibold py-1.5 transition-all ${
                    isSelected
                      ? "bg-white text-black"
                      : "bg-transparent text-neutral-500 font-medium"
                  }`}>
                    {isSelected ? `Brew ${opt}` : opt}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
