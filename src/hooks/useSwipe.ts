import { useRef, useState, useCallback } from "react";

export interface SwipePagerState {
  /** Current visual offset in px (driven by touch or animation). */
  offsetPx: number;
  /** Whether a touch gesture is active (disables CSS transition). */
  dragging: boolean;
}

export interface SwipePagerHandlers {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: () => void;
}

/**
 * Full swipe pager — drives a horizontal strip of pages.
 * Returns pixel offset and drag state for the container transform,
 * plus touch handlers to attach to the pager element.
 */
export function useSwipePager({
  pageCount,
  currentPage,
  onPageChange,
  pageWidth,
}: {
  pageCount: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  /** Width of one page in px (typically window.innerWidth). */
  pageWidth: number;
}): { state: SwipePagerState; handlers: SwipePagerHandlers } {
  const startX = useRef(0);
  const startY = useRef(0);
  const currentX = useRef(0);
  const tracking = useRef(false);
  const decided = useRef(false);
  const isHorizontal = useRef(false);

  const [dragOffset, setDragOffset] = useState(0);
  const [dragging, setDragging] = useState(false);

  const baseOffset = -currentPage * pageWidth;

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("input[type=range]")) return;

    const touch = e.touches[0];
    startX.current = touch.clientX;
    startY.current = touch.clientY;
    currentX.current = touch.clientX;
    tracking.current = true;
    decided.current = false;
    isHorizontal.current = false;
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!tracking.current) return;

    const touch = e.touches[0];
    currentX.current = touch.clientX;
    const dx = touch.clientX - startX.current;
    const dy = touch.clientY - startY.current;

    if (!decided.current && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      decided.current = true;
      isHorizontal.current = Math.abs(dx) > Math.abs(dy);
      if (isHorizontal.current) {
        setDragging(true);
      }
    }

    if (!isHorizontal.current) return;

    // Resist at edges (rubber band)
    let offset = dx;
    const atStart = currentPage === 0 && dx > 0;
    const atEnd = currentPage === pageCount - 1 && dx < 0;
    if (atStart || atEnd) {
      offset = dx * 0.2;
    }

    setDragOffset(offset);
  }, [currentPage, pageCount]);

  const onTouchEnd = useCallback(() => {
    if (!tracking.current) return;
    tracking.current = false;

    if (!isHorizontal.current) return;

    const dx = currentX.current - startX.current;
    const threshold = pageWidth * 0.2;

    let nextPage = currentPage;
    if (dx < -threshold && currentPage < pageCount - 1) {
      nextPage = currentPage + 1;
    } else if (dx > threshold && currentPage > 0) {
      nextPage = currentPage - 1;
    }

    setDragOffset(0);
    setDragging(false);

    if (nextPage !== currentPage) {
      onPageChange(nextPage);
    }
  }, [currentPage, pageCount, pageWidth, onPageChange]);

  const offsetPx = baseOffset + (dragging ? dragOffset : 0);

  return {
    state: { offsetPx, dragging },
    handlers: { onTouchStart, onTouchMove, onTouchEnd },
  };
}
