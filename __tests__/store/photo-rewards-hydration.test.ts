/**
 * Cold-start hydration race for the Tasks screen's photo-reward flow
 * (addPhoto + free-item buyItem grant), mirroring store-hydration.test.ts.
 *
 * Snapping a verification photo writes to the photo store, and a lucky
 * reward roll grants a free repeatable item via the store store; persist's
 * shallow hydration merge erases either write if it lands before
 * rehydration completes. The Tasks screen gates on both stores.
 */

// Deferred AsyncStorage keyed by persist name — see tasks-hydration.test.ts.
const mockResolvers: Record<string, (value: string | null) => void> = {};

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(
    (key: string) =>
      new Promise((resolve) => {
        mockResolvers[key] = resolve;
      }),
  ),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

const PHOTOS_SAVE = JSON.stringify({ state: { photos: [] }, version: 0 });
const STORE_SAVE = JSON.stringify({
  state: { owned: {}, placed: {} },
  version: 1,
});

/** Fresh store instances whose rehydration is still in flight. */
function coldStart() {
  jest.resetModules();
  /* eslint-disable @typescript-eslint/no-require-imports */
  const { usePhotoStore } = require("@/store/use-photo-store");
  const { useStoreStore } = require("@/store/use-store-store");
  const { STORE_ITEMS } = require("@/store/store-items");
  /* eslint-enable @typescript-eslint/no-require-imports */
  const freeItem = STORE_ITEMS.find((i: any) => i.repeatable)!;
  return { usePhotoStore, useStoreStore, freeItem };
}

/** Drain the getItem → migrate → merge → setItem promise chain. */
async function flushHydration() {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

// Mirrors handleTakePhoto + handleTimerComplete's free-item grant.
function snapAndWin(usePhotoStore: any, useStoreStore: any, freeItem: any) {
  usePhotoStore.getState().addPhoto({
    taskId: "wipe-counters",
    photoUri: "file:///photo.jpg",
    takenAt: Date.now(),
  });
  useStoreStore.getState().buyItem(freeItem);
}

describe("photo-reward cold-start hydration race", () => {
  it("clobbers a photo and free-item grant written before rehydration completes (the bug)", async () => {
    const { usePhotoStore, useStoreStore, freeItem } = coldStart();

    expect(usePhotoStore.persist.hasHydrated()).toBe(false);
    expect(useStoreStore.persist.hasHydrated()).toBe(false);

    snapAndWin(usePhotoStore, useStoreStore, freeItem);
    expect(usePhotoStore.getState().photos).toHaveLength(1);
    expect(useStoreStore.getState().owned[freeItem.id]).toBeDefined();

    mockResolvers["mm-photos"](PHOTOS_SAVE);
    mockResolvers["mm-store-owned"](STORE_SAVE);
    await flushHydration();

    // The photo record and the gifted item are both gone.
    expect(usePhotoStore.getState().photos).toHaveLength(0);
    expect(useStoreStore.getState().owned[freeItem.id]).toBeUndefined();
  });

  it("the screen's gate blocks the doomed writes; post-hydration they stick and reach downstream reads", async () => {
    const { usePhotoStore, useStoreStore, freeItem } = coldStart();

    // Mirrors the handlers' guard.
    const attempt = () => {
      if (
        !usePhotoStore.persist.hasHydrated() ||
        !useStoreStore.persist.hasHydrated()
      ) {
        return false;
      }
      snapAndWin(usePhotoStore, useStoreStore, freeItem);
      return true;
    };

    expect(attempt()).toBe(false);
    expect(usePhotoStore.getState().photos).toHaveLength(0);

    mockResolvers["mm-photos"](PHOTOS_SAVE);
    mockResolvers["mm-store-owned"](STORE_SAVE);
    await flushHydration();

    expect(attempt()).toBe(true);

    // Downstream reads: photo stats see the record, and the Store screen's
    // gift badge sees the free item in inventory.
    expect(usePhotoStore.getState().todayPhotos()).toHaveLength(1);
    expect(usePhotoStore.getState().totalPhotos()).toBe(1);
    const giftCount =
      useStoreStore.getState().owned[freeItem.id]?.quantity ?? 0;
    expect(giftCount).toBe(1);
  });
});
