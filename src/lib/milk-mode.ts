/** Display the explicit choice, or infer the milk mode from legacy shots. */
export function milkModeFor(shots: string, mode?: string): string {
  return mode === "warm_milk" || mode === "milk_froth"
    ? mode
    : shots === "none" ? "milk_froth" : "warm_milk";
}

/** Resolve an explicit milk choice without changing inactive or legacy shots. */
export function milkShotsFor(process: string, shots: string, mode?: string): string {
  if (process !== "milk") return shots;
  if (mode === "warm_milk") return "one";
  if (mode === "milk_froth") return "none";
  return shots;
}
