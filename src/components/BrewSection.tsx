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

/** Monochrome SVG pictograms for process types */
function ProcessIcon({ process, className }: { process: string; className?: string }) {
  const cls = className || "w-4 h-4";
  if (process === "coffee") {
    // Coffee bean
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className={cls}>
        <path d="M12 2C9.5 2 7.1 3.3 5.8 5.5c-1.7 2.9-1.4 6.6.8 9.1C8.4 16.6 10.1 18 12 18s3.6-1.4 5.4-3.4c2.2-2.5 2.5-6.2.8-9.1C16.9 3.3 14.5 2 12 2zm0 14c-1.3 0-2.7-1-4.2-2.8-1.8-2-2-4.9-.7-7.2C8.2 4.2 10 3.2 12 3.2S15.8 4.2 16.9 6c1.3 2.3 1.1 5.2-.7 7.2C14.7 15 13.3 16 12 16z" />
        <path d="M12 5c-1.1 0-2.1.6-2.7 1.5-.8 1.2-.8 2.8.1 4C10.3 11.7 11.1 12.5 12 12.5s1.7-.8 2.6-2c.9-1.2.9-2.8.1-4C14.1 5.6 13.1 5 12 5z" />
      </svg>
    );
  }
  if (process === "milk") {
    // Milk drop
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className={cls}>
        <path d="M12 2.5c-.3 0-.5.1-.7.3C9.5 5 7 8.5 7 12c0 2.8 2.2 5 5 5s5-2.2 5-5c0-3.5-2.5-7-4.3-9.2-.2-.2-.4-.3-.7-.3zM12 16c-2.2 0-4-1.8-4-4 0-2.8 2-5.8 4-8.2 2 2.4 4 5.4 4 8.2 0 2.2-1.8 4-4 4z" />
      </svg>
    );
  }
  if (process === "water") {
    // Water droplet
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={cls}>
        <path d="M12 3L7 11.5C5.8 13.6 6.5 16.3 8.5 17.7 9.5 18.4 10.7 18.8 12 18.8s2.5-.4 3.5-1.1c2-1.4 2.7-4.1 1.5-6.2L12 3z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return null;
}

const INTENSITY_DOTS: Record<string, number> = {
  very_mild: 1,
  mild: 2,
  medium: 3,
  strong: 4,
  very_strong: 5,
};

function TempIcon({ temp, className }: { temp: string; className?: string }) {
  const cls = className || "w-3.5 h-3.5";
  if (temp === "low") {
    // Snowflake
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className={cls}>
        <path d="M12 2v20M2 12h20M4.9 4.9l14.2 14.2M19.1 4.9L4.9 19.1M12 2l-2 3h4l-2-3zM12 22l2-3h-4l2 3zM2 12l3 2v-4l-3 2zM22 12l-3-2v4l3-2z" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (temp === "high") {
    // Flame
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className={cls}>
        <path d="M12 2c0 4-4 6-4 10a4 4 0 008 0c0-4-4-6-4-10zm0 14a2 2 0 01-2-2c0-1.5 2-3 2-5 0 2 2 3.5 2 5a2 2 0 01-2 2z" />
      </svg>
    );
  }
  return null;
}

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

function IntensityDots({ level }: { level: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className={`inline-block w-2 h-2 rounded-full ${
            n <= level ? "bg-white" : "bg-neutral-600"
          }`}
        />
      ))}
    </span>
  );
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

  const textCls = vertical ? "text-neutral-200" : "text-neutral-400";

  return (
    <div className={vertical ? "flex flex-col gap-3" : "flex gap-6"}>
      {components.map((c, i) => (
        <div key={i} className={`flex flex-col gap-1 text-sm ${textCls}`}>
          {/* Row 1: icon + volume + temperature */}
          <div className="flex items-center gap-2">
            <ProcessIcon process={c.process} className="w-5 h-5 shrink-0" />
            <span className="font-semibold tabular-nums text-white">{c.ml}<span className="text-neutral-500 text-xs font-normal">ml</span></span>
            <TempIcon temp={c.temp} className="w-4 h-4 shrink-0" />
          </div>
          {/* Row 2: intensity + shots (coffee) or empty line */}
          <div className="flex items-center gap-2 pl-7">
            {c.process === "coffee" ? (
              <>
                <IntensityDots level={INTENSITY_DOTS[c.intensity] || 3} />
                {c.shots > 0 && <span className="text-neutral-400 font-medium">×{c.shots}</span>}
              </>
            ) : (
              <span className="text-neutral-500 text-xs">
                {c.process === "milk" ? "steamed" : "hot water"}
              </span>
            )}
          </div>
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
