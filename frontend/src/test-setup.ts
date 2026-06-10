import "@testing-library/jest-dom";

// jsdom doesn't provide localStorage in Node 22+; stub it globally
const localStorageStore: Record<string, string> = {};
const localStorageMock = {
  getItem: (k: string) => localStorageStore[k] ?? null,
  setItem: (k: string, v: string) => { localStorageStore[k] = v; },
  removeItem: (k: string) => { delete localStorageStore[k]; },
  clear: () => { Object.keys(localStorageStore).forEach(k => delete localStorageStore[k]); },
  get length() { return Object.keys(localStorageStore).length; },
  key: (i: number) => Object.keys(localStorageStore)[i] ?? null,
};

Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  writable: true,
});

// ResizeObserver is used by Recharts but not available in jsdom
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
