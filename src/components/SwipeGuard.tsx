import type { ReactNode } from "react";

/**
 * Stops a touch drag inside an overlay from reaching the app's swipe pager.
 *
 * React routes a portal's events up the COMPONENT tree rather than the DOM
 * tree, so a `Panel` portalled onto `document.body` still bubbles its touches
 * into whatever section rendered it — and from there into `App`'s
 * `onTouchStart`/`onTouchMove`, which would page the tab strip out from under
 * the open modal. Every hand-rolled overlay in the app carried its own three
 * `e.stopPropagation()` handlers for this; `Panel` owns the scrim now, so the
 * guard has to sit outside it, and it is written once here instead of five
 * times.
 *
 * `display: contents` is deliberate: the wrapper exists only to catch synthetic
 * events, and it must not become a box in whatever flex or grid it lands in.
 */
export function SwipeGuard({ children }: { children: ReactNode }) {
  const stop = (e: React.TouchEvent) => e.stopPropagation();

  return (
    <div
      data-ui="swipe-guard"
      style={{ display: "contents" }}
      onTouchStart={stop}
      onTouchMove={stop}
      onTouchEnd={stop}
    >
      {children}
    </div>
  );
}
