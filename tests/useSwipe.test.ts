import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSwipePager } from "../src/hooks/useSwipe";

function createTouchEvent(clientX: number, clientY: number, target?: HTMLElement) {
  return {
    touches: [{ clientX, clientY }],
    target: target || document.createElement("div"),
  } as unknown as React.TouchEvent;
}

describe("useSwipePager", () => {
  const defaultOpts = {
    pageCount: 5,
    currentPage: 0,
    onPageChange: vi.fn(),
    pageWidth: 375,
  };

  it("returns initial state", () => {
    const { result } = renderHook(() => useSwipePager(defaultOpts));
    expect(result.current.state.offsetPx).toBe(0);
    expect(result.current.state.dragging).toBe(false);
  });

  it("calculates offset from current page", () => {
    const { result } = renderHook(() =>
      useSwipePager({ ...defaultOpts, currentPage: 2 }),
    );
    expect(result.current.state.offsetPx).toBe(-750);
  });

  it("handles horizontal swipe left to change page", () => {
    const onPageChange = vi.fn();
    const { result } = renderHook(() =>
      useSwipePager({ ...defaultOpts, onPageChange }),
    );

    act(() => {
      result.current.handlers.onTouchStart(createTouchEvent(200, 100));
    });
    act(() => {
      result.current.handlers.onTouchMove(createTouchEvent(100, 100));
    });
    act(() => {
      result.current.handlers.onTouchEnd();
    });

    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it("does not trigger page change for small swipes", () => {
    const onPageChange = vi.fn();
    const { result } = renderHook(() =>
      useSwipePager({ ...defaultOpts, onPageChange }),
    );

    act(() => {
      result.current.handlers.onTouchStart(createTouchEvent(200, 100));
    });
    act(() => {
      result.current.handlers.onTouchMove(createTouchEvent(190, 100));
    });
    act(() => {
      result.current.handlers.onTouchEnd();
    });

    expect(onPageChange).not.toHaveBeenCalled();
  });

  it("ignores vertical swipes", () => {
    const onPageChange = vi.fn();
    const { result } = renderHook(() =>
      useSwipePager({ ...defaultOpts, onPageChange }),
    );

    act(() => {
      result.current.handlers.onTouchStart(createTouchEvent(200, 100));
    });
    act(() => {
      result.current.handlers.onTouchMove(createTouchEvent(200, 0));
    });
    act(() => {
      result.current.handlers.onTouchEnd();
    });

    expect(onPageChange).not.toHaveBeenCalled();
    expect(result.current.state.dragging).toBe(false);
  });

  it("ignores touches on range inputs", () => {
    const onPageChange = vi.fn();
    const { result } = renderHook(() =>
      useSwipePager({ ...defaultOpts, onPageChange }),
    );

    const rangeInput = document.createElement("input");
    rangeInput.type = "range";
    document.body.appendChild(rangeInput);

    act(() => {
      result.current.handlers.onTouchStart(createTouchEvent(200, 100, rangeInput));
    });
    act(() => {
      result.current.handlers.onTouchMove(createTouchEvent(100, 100, rangeInput));
    });
    act(() => {
      result.current.handlers.onTouchEnd();
    });

    expect(onPageChange).not.toHaveBeenCalled();
    document.body.removeChild(rangeInput);
  });

  it("ignores touches inside embla carousel", () => {
    const onPageChange = vi.fn();
    const { result } = renderHook(() =>
      useSwipePager({ ...defaultOpts, onPageChange }),
    );

    const carouselContainer = document.createElement("div");
    carouselContainer.setAttribute("data-embla-carousel", "");
    const slideEl = document.createElement("div");
    carouselContainer.appendChild(slideEl);
    document.body.appendChild(carouselContainer);

    act(() => {
      result.current.handlers.onTouchStart(createTouchEvent(200, 100, slideEl));
    });
    act(() => {
      result.current.handlers.onTouchMove(createTouchEvent(100, 100, slideEl));
    });
    act(() => {
      result.current.handlers.onTouchEnd();
    });

    expect(onPageChange).not.toHaveBeenCalled();
    document.body.removeChild(carouselContainer);
  });

  it("does not go before first page", () => {
    const onPageChange = vi.fn();
    const { result } = renderHook(() =>
      useSwipePager({ ...defaultOpts, currentPage: 0, onPageChange }),
    );

    act(() => {
      result.current.handlers.onTouchStart(createTouchEvent(100, 100));
    });
    act(() => {
      result.current.handlers.onTouchMove(createTouchEvent(200, 100));
    });
    act(() => {
      result.current.handlers.onTouchEnd();
    });

    expect(onPageChange).not.toHaveBeenCalled();
  });

  it("does not go past last page", () => {
    const onPageChange = vi.fn();
    const { result } = renderHook(() =>
      useSwipePager({ ...defaultOpts, currentPage: 4, onPageChange }),
    );

    act(() => {
      result.current.handlers.onTouchStart(createTouchEvent(200, 100));
    });
    act(() => {
      result.current.handlers.onTouchMove(createTouchEvent(100, 100));
    });
    act(() => {
      result.current.handlers.onTouchEnd();
    });

    expect(onPageChange).not.toHaveBeenCalled();
  });

  it("sets dragging to true during horizontal swipe", () => {
    const { result } = renderHook(() => useSwipePager(defaultOpts));

    act(() => {
      result.current.handlers.onTouchStart(createTouchEvent(200, 100));
    });
    act(() => {
      result.current.handlers.onTouchMove(createTouchEvent(100, 100));
    });

    expect(result.current.state.dragging).toBe(true);
  });

  it("resets dragging after touch end", () => {
    const { result } = renderHook(() => useSwipePager(defaultOpts));

    act(() => {
      result.current.handlers.onTouchStart(createTouchEvent(200, 100));
    });
    act(() => {
      result.current.handlers.onTouchMove(createTouchEvent(100, 100));
    });
    act(() => {
      result.current.handlers.onTouchEnd();
    });

    expect(result.current.state.dragging).toBe(false);
  });
});
