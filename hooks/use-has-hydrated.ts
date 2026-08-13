import { useEffect, useState } from "react";

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
 *
 * Uses persist.hasHydrated / onFinishHydration (Zustand's supported
 * lifecycle). Do not wrap those in useSyncExternalStore: React 19 + the
 * compiler treats hasHydrated() as an uncached getSnapshot and loops into
 * maximum update depth on cold start and Claim Reward.
 */
export function useHasHydrated(store: PersistedStore): boolean {
  const [hydrated, setHydrated] = useState(() => store.persist.hasHydrated());

  useEffect(() => {
    const markHydrated = () => setHydrated(true);
    const unsub = store.persist.onFinishHydration(markHydrated);

    // Already finished, or finished between render and this effect.
    if (store.persist.hasHydrated()) {
      markHydrated();
    }

    return unsub;
  }, [store]);

  return hydrated;
}
