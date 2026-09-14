import '@testing-library/jest-dom/vitest'

// @xyflow/react measures its container with ResizeObserver, which jsdom
// does not provide. A no-op stub is enough: node/edge rendering (what the
// SD3 assertions will check) does not depend on measured dimensions.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver =
    ResizeObserverStub as unknown as typeof ResizeObserver
}
