import type { Connection, HassEntities } from "home-assistant-js-websocket";
import { getState, getOptions, getEntity } from "../lib/entities";
import { selectOption, pressButton } from "../lib/ha";

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
  const progressNum = progress ? Math.min(100, Math.max(0, parseFloat(progress))) : 0;

  // Profile
  const profileOptions = getOptions(entities, prefix, "profile");
  const selectedProfile = getState(entities, prefix, "select", "profile");

  // Recipe
  const recipeOptions = getOptions(entities, prefix, "recipe");
  const selectedRecipe = getState(entities, prefix, "select", "recipe");

  const brewId = `button.${prefix}_brew`;
  const cancelId = `button.${prefix}_cancel`;

  return (
    <div className="space-y-4 px-6">
      {/* Progress */}
      {isBrewing && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-amber-300 font-medium">{activity}</span>
            {progress && <span className="text-coffee-400">{progressNum}%</span>}
          </div>
          {progress && (
            <div className="h-2 rounded-full bg-coffee-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-amber-400 transition-all duration-500"
                style={{ width: `${progressNum}%` }}
              />
            </div>
          )}
          <button
            onClick={() => pressButton(conn, cancelId)}
            className="w-full rounded-xl py-3 text-sm font-medium text-red-400 ring-1 ring-red-800 hover:bg-red-900/30 transition active:scale-[0.98]"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Action required */}
      {hasAction && (
        <div className="flex items-center gap-2 rounded-xl bg-red-900/20 px-4 py-3 text-sm text-red-300 ring-1 ring-red-800">
          <span className="text-lg">⚠️</span>
          <span>{actionRequired}</span>
        </div>
      )}

      {/* Profile selector */}
      {isReady && profileOptions.length > 1 && (
        <div>
          <label className="block text-xs font-medium text-coffee-400 mb-1.5 uppercase tracking-wider">
            Profile
          </label>
          <div className="flex gap-2 flex-wrap">
            {profileOptions.map((opt) => (
              <button
                key={opt}
                onClick={() =>
                  selectOption(conn, `select.${prefix}_profile`, opt)
                }
                className={`rounded-xl px-4 py-2.5 text-sm font-medium transition active:scale-[0.96] ${
                  opt === selectedProfile
                    ? "bg-coffee-600 text-coffee-50"
                    : "bg-coffee-800/50 text-coffee-300 ring-1 ring-coffee-700 hover:bg-coffee-700/50"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Recipe selector */}
      {isReady && recipeOptions.length > 0 && (
        <div>
          <label className="block text-xs font-medium text-coffee-400 mb-1.5 uppercase tracking-wider">
            Recipe
          </label>
          <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
            {recipeOptions.map((opt) => (
              <button
                key={opt}
                onClick={() =>
                  selectOption(conn, `select.${prefix}_recipe`, opt)
                }
                className={`rounded-xl px-3 py-2.5 text-sm font-medium transition active:scale-[0.96] ${
                  opt === selectedRecipe
                    ? "bg-coffee-600 text-coffee-50 ring-2 ring-coffee-400"
                    : "bg-coffee-800/50 text-coffee-300 ring-1 ring-coffee-700 hover:bg-coffee-700/50"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Brew button */}
      {isReady && (
        <button
          onClick={() => pressButton(conn, brewId)}
          disabled={!selectedRecipe || !getEntity(entities, prefix, "button", "brew")}
          className="w-full rounded-2xl bg-coffee-500 py-4 text-lg font-bold text-coffee-950 shadow-lg shadow-coffee-500/20 transition hover:bg-coffee-400 active:scale-[0.97] disabled:opacity-30 disabled:cursor-not-allowed"
        >
          ☕ Brew {selectedRecipe || ""}
        </button>
      )}
    </div>
  );
}
