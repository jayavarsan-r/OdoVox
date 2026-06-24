/**
 * Minimal `window.sessionStorage` for node-env tests that import zustand
 * `persist` stores (e.g. the onboarding store). Import this FIRST, before the
 * store module, so the storage exists when the store is created/rehydrated.
 */
if (typeof (globalThis as { window?: unknown }).window === 'undefined') {
  const mem = new Map<string, string>();
  (globalThis as { window?: unknown }).window = {
    sessionStorage: {
      getItem: (k: string) => (mem.has(k) ? (mem.get(k) as string) : null),
      setItem: (k: string, v: string) => void mem.set(k, v),
      removeItem: (k: string) => void mem.delete(k),
      clear: () => mem.clear(),
      key: () => null,
      length: 0,
    },
  };
}
