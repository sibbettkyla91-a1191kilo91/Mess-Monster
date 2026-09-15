/**
 * Reproduces the cold-start hydration race behind vanishing decor purchases.
 *
 * zustand's persist middleware rehydrates from AsyncStorage asynchronously.
 * Its hydration merge is shallow — the persisted `owned` map replaces the
 * in-memory one wholesale — so a purchase written in the gap between app
 * launch and rehydration completing is clobbered when the merge lands.
 * The Store screen now gates buying on persist.hasHydrated(); these tests
 * pin down both the race itself and the gate that closes it.
 */

// Deferred AsyncStorage: each store creation kicks off getItem, and the test
// decides when "disk" responds — simulating the cold-start hydration window.
let mockResolveGetItem: (value: string | null) => void;

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(
    () =>
      new Promise((resolve) => {
        mockResolveGetItem = resolve;
      }),
  ),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

// A prior session's save with no purchases — what any returning player's
// disk looks like (the persist key exists after the first session).
const EMPTY_SAVE = JSON.stringify({
  state: { owned: {}, placed: {} },
  version: 1,
});

/** Fresh store instance whose rehydration is still in flight. */
function coldStart() {
  jest.resetModules();
  /* eslint-disable @typescript-eslint/no-require-imports */
  const { useStoreStore } = require("@/store/use-store-store");
  const { STORE_ITEMS } = require("@/store/store-items");
  /* eslint-enable @typescript-eslint/no-require-imports */
  const decorItem = STORE_ITEMS.find((i: any) => i.id === "nilly-plant-sunflower")!;
  return { useStoreStore, decorItem };
}

/** Drain the getItem → migrate → merge → setItem promise chain. */
async function flushHydration() {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

describe("cold-start hydration race", () => {
  it("clobbers a purchase written before rehydration completes (the bug)", async () => {
    const { useStoreStore, decorItem } = coldStart();

    // Cold start: rehydration is still in flight.
    expect(useStoreStore.persist.hasHydrated()).toBe(false);

    // Fast tap: buy before AsyncStorage has resolved.
    expect(useStoreStore.getState().buyItem(decorItem)).toBe(true);
    expect(useStoreStore.getState().owned["nilly-plant-sunflower"]).toBeDefined();

    // Rehydration lands with the previous session's save.
    mockResolveGetItem(EMPTY_SAVE);
    await flushHydration();

    // The purchase is gone — this is why the Store screen gates on hydration.
    expect(useStoreStore.persist.hasHydrated()).toBe(true);
    expect(useStoreStore.getState().owned["nilly-plant-sunflower"]).toBeUndefined();
  });

  it("hasHydrated() is false while AsyncStorage is pending and true after", async () => {
    const { useStoreStore } = coldStart();

    expect(useStoreStore.persist.hasHydrated()).toBe(false);

    mockResolveGetItem(EMPTY_SAVE);
    await flushHydration();

    expect(useStoreStore.persist.hasHydrated()).toBe(true);
  });

  it("the Store screen's gate blocks the doomed write; a post-hydration purchase sticks and reaches Collection", async () => {
    const { useStoreStore, decorItem } = coldStart();

    // Mirrors handleBuy's guard: no writes until hydration is confirmed.
    const attemptBuy = () => {
      if (!useStoreStore.persist.hasHydrated()) return false;
      return useStoreStore.getState().buyItem(decorItem);
    };

    // Pre-hydration tap: prevented, nothing written to clobber.
    expect(attemptBuy()).toBe(false);
    expect(useStoreStore.getState().owned["nilly-plant-sunflower"]).toBeUndefined();

    mockResolveGetItem(EMPTY_SAVE);
    await flushHydration();

    // Retry after hydration: succeeds and survives.
    expect(attemptBuy()).toBe(true);
    expect(useStoreStore.getState().owned["nilly-plant-sunflower"]).toBeDefined();

    // Collection screen read: quantity > 0, non-repeatable.
    const collectionIds = Object.values(useStoreStore.getState().owned)
      .filter((e: any) => e.quantity > 0)
      .filter((e: any) => !e.item.repeatable)
      .map((e: any) => e.item.id);
    expect(collectionIds).toEqual(["nilly-plant-sunflower"]);
  });
});
