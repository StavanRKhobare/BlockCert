import '@testing-library/jest-dom/vitest'

// @xyflow/react measures its container and nodes with ResizeObserver,
// which jsdom does not provide. The stub reports a fixed plausible size
// synchronously on observe(): node/edge rendering (what the SD3/SD5
// assertions check) does not depend on real measured dimensions, but edge
// geometry cannot be computed at all with zero-size internals, so with a
// no-op stub edges never render in jsdom. Production is unaffected.
class ResizeObserverStub {
  private callback: ResizeObserverCallback
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
  }
  observe(target: Element): void {
    this.callback(
      [
        {
          target,
          contentRect: {
            width: 120,
            height: 40,
          } as DOMRectReadOnly,
        } as ResizeObserverEntry,
      ],
      this as unknown as ResizeObserver,
    )
  }
  unobserve(): void {}
  disconnect(): void {}
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver =
    ResizeObserverStub as unknown as typeof ResizeObserver
}
