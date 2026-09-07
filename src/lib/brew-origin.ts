import type { RecipeDetails } from "./entities";

/**
 * Who started the pour that is running.
 *
 * The machine's status frame says what PHASE it is in — grinding, coffee,
 * steam, water, prepare — and nothing about WHICH DRINK it is making. There is
 * no product identity in the protocol. So a client can only name the drink
 * when the client itself asked for it: press Cappuccino here and we know; press
 * hot water on the machine's own panel, or brew from another client, and the
 * only honest thing to say is what phase the machine reports.
 *
 * The app used to show the recipe selected in its own picker for every pour,
 * which made a hot water dispense look like a cappuccino with a composition
 * strip full of millilitres nobody asked for.
 *
 * This module holds the one fact that fixes it: the drink THIS app last asked
 * for, and only while that request can still plausibly be the running pour.
 */

export interface BrewOrigin {
  /** The drink's display name, as the user saw it when they pressed. */
  name: string;
  /** Its composition, when the caller had it — for the value strip. */
  details?: RecipeDetails;
  /** When the request went out. */
  at: number;
}

/**
 * How long a request stays claimable. A machine that never starts (offline,
 * blocked, cancelled at the spout) must not leave the next pour — which may be
 * someone else's hot water — wearing this label.
 */
export const ORIGIN_TTL_MS = 90_000;

let origin: BrewOrigin | null = null;

/** Record that this app asked for a drink. Call it as the command goes out. */
export function noteBrewStarted(name: string, details?: RecipeDetails, now = Date.now()): void {
  if (!name) return;
  origin = { name, details, at: now };
}

/**
 * The drink this app asked for, if the claim is still fresh. Returns null once
 * the TTL lapses — at which point the app knows a pour is running but not what
 * it is, which is the truth.
 */
export function brewOrigin(now = Date.now()): BrewOrigin | null {
  if (origin === null) return null;
  if (now - origin.at > ORIGIN_TTL_MS) {
    origin = null;
    return null;
  }
  return origin;
}

/** Forget the claim — the pour ended, or was cancelled. */
export function clearBrewOrigin(): void {
  origin = null;
}
