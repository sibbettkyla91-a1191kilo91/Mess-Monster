import { useSyncExternalStore } from "react";

interface PersistedStore {
  persist: {
    hasHydrated: () => boolean;
    onFinishHydration: (fn: (state: unknown) => void) => () => void;
  };
}

/**
 * Tracks whether a zustand persist store has finished rehydrating from
 * AsyncStorage. On cold start the persisted state loads asynchronously;
 * writes made before that load completes get clobbered when the hydration
 * merge lands. Screens that mutate persisted state should gate on this.
 */
export function useHasHydrated(store: PersistedStore): boolean {
  return useSyncExternalStore(
    (onStoreChange) => store.persist.onFinishHydration(onStoreChange),
    () => store.persist.hasHydrated(),
    () => store.persist.hasHydrated(),
  );
}
