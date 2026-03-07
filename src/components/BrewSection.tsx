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

const PROCESS_LABELS: Record<string, string> = {
  coffee: "Coffee",
  milk: "Milk",
  water: "Water",
  none: "",
};

const INTENSITY_LABELS: Record<string, string> = {
  very_mild: "Very Mild",
  mild: "Mild",
  medium: "Medium",
  strong: "Strong",
  very_strong: "V. Strong",
};

const TEMP_LABELS: Record<string, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
};

interface RecipeDetails {
  c1_process: string;
  c1_intensity: string;
  c1_temperature: string;
  c1_shots: number;
  c1_portion_ml: number;
  c2_process: string;
  c2_intensity: string;
  c2_temperature: string;
  c2_shots: number;
  c2_portion_ml: number;
}

function RecipeInfo({ details, vertical }: { details: RecipeDetails; vertical?: boolean }) {
  const components: { process: string; intensity: string; temp: string; shots: number; ml: number }[] = [];
  if (details.c1_process && details.c1_process !== "none") {
    components.push({
      process: details.c1_process,
      intensity: details.c1_intensity,
      temp: details.c1_temperature,
      shots: details.c1_shots,
      ml: details.c1_portion_ml,
    });
  }
  if (details.c2_process && details.c2_process !== "none") {
    components.push({
      process: details.c2_process,
      intensity: details.c2_intensity,
      temp: details.c2_temperature,
      shots: details.c2_shots,
      ml: details.c2_portion_ml,
    });
  }
  if (components.length === 0) return null;

  return (
    <div className={vertical ? "flex flex-col gap-0.5 text-[9px]" : "flex gap-3 text-[10px] text-neutral-400 mt-0.5"}>
      {components.map((c, i) => (
        <div key={i} className={vertical ? "flex items-center gap-1 text-neutral-300" : "flex items-center gap-1"}>
          <span className={vertical ? "text-white font-medium" : "text-neutral-300 font-medium"}>{PROCESS_LABELS[c.process] || c.process}</span>
          <span>{c.ml}ml</span>
          {c.process === "coffee" && (
            <>
              <span className="text-neutral-500">·</span>
              <span>{INTENSITY_LABELS[c.intensity] || c.intensity}</span>
              {c.shots > 0 && <span>×{c.shots}</span>}
            </>
          )}
          <span className="text-neutral-500">·</span>
          <span>{TEMP_LABELS[c.temp] || c.temp}</span>
        </div>
      ))}
    </div>
  );
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

  // Recipe details from entity attributes
  const recipeEntity = getEntity(entities, prefix, "select", "recipe");
  const recipeDetails = recipeEntity?.attributes as RecipeDetails | undefined;
  const hasRecipeDetails = recipeDetails?.c1_process !== undefined;

  const brewId = `button.${prefix}_brew`;
  const cancelId = `button.${prefix}_cancel`;

  const [profileOpen, setProfileOpen] = useState(false);

  // Brewing state
  if (isBrewing) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-8 px-6">
        <CoffeeIcon recipe={activity || "Espresso"} size={260} />

        <div className="flex flex-col items-center gap-4 w-full max-w-xs">
          {/* Recipe info card — blurred dark glass */}
          <div className="w-full rounded-2xl backdrop-blur-xl bg-white/[0.04] ring-1 ring-white/[0.08] px-5 py-4">
            <div className="text-lg font-light text-white tracking-wide text-center">{activity}</div>
            {hasRecipeDetails && recipeDetails && (
              <div className="flex justify-center mt-2">
                <RecipeInfo details={recipeDetails} />
              </div>
            )}
            {progress && (
              <div className="mt-3 flex items-center gap-3">
                <div className="flex-1 h-px bg-neutral-800 overflow-hidden rounded-full">
                  <div
                    className="h-full bg-white transition-all duration-500"
                    style={{ width: `${progressNum}%` }}
                  />
                </div>
                <span className="text-neutral-500 text-xs tabular-nums w-8 text-right">{progressNum}%</span>
              </div>
            )}
          </div>

          <button
            onClick={() => pressButton(conn, cancelId)}
            className="rounded-lg px-8 py-2.5 text-sm font-medium text-neutral-500 ring-1 ring-neutral-700 hover:bg-neutral-900 transition active:scale-[0.98]"
          >
            Cancel
          </button>
        </div>
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
                  {/* Recipe details overlay on selected card */}
                  {isSelected && hasRecipeDetails && recipeDetails && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center backdrop-blur-md bg-black/60 transition-all">
                      <RecipeInfo details={recipeDetails} vertical />
                    </div>
                  )}
                  <span className={`absolute bottom-0 left-0 right-0 text-center text-xs font-semibold py-1.5 transition-all z-10 ${
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
