import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

function getSnapshot(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia(QUERY).matches;
}

/**
 * Whether the viewer has asked for less movement.
 *
 * index.css already collapses every animation and transition under the same
 * media query, so this hook exists only where a component must make the
 * decision in JS rather than in CSS — DrinkStage cross-fades its glow with an
 * inline transition, which that stylesheet rule can only reach by fighting it
 * with `!important`.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
