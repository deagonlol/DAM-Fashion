/**
 * Minimal in-memory store for mock data, compatible with useSyncExternalStore.
 * Goes away once data comes from Supabase.
 */
export function createStore<T>(initial: T) {
  let state = initial;
  const listeners = new Set<() => void>();

  return {
    get: () => state,
    set(next: T) {
      state = next;
      listeners.forEach((listener) => listener());
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
