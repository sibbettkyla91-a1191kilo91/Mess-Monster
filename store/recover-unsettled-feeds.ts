import { MonsterId, resolveMonsterId } from "./monster-id";
import { STORE_ITEMS } from "./store-items";
import {
  assignLegacyInventoryToSelectedMonster,
  UnsettledFeed,
  useStoreStore,
} from "./use-store-store";
import { assignLegacyPetToSelectedMonster, usePetStore } from "./use-pet-store";
import { usePlayerStore } from "./use-player-store";

/**
 * Feed writes two persisted stores: the snack leaves the bag (store) and
 * that monster's health/happiness go up (pet). Intent + receipts recover
 * a crash between those writes. Stats are applied first so a crash after
 * the bump still leaves the player with the care; recovery then consumes
 * the snack. Repeated recovery is a no-op.
 */

function storesHydrated(): boolean {
  return (
    useStoreStore.persist.hasHydrated() &&
    usePetStore.persist.hasHydrated() &&
    usePlayerStore.persist.hasHydrated()
  );
}

let feedInFlight = false;

function applyOneFeed(feed: UnsettledFeed): void {
  useStoreStore.getState().beginFeed(feed);
  usePetStore.getState().applyFeed(feed.id, feed.monsterId);
  useStoreStore.getState().consumeFeed(feed.id, feed.itemId, feed.monsterId);
  useStoreStore.getState().clearUnsettledFeed(feed.id);
}

function feedsToRecover(): UnsettledFeed[] {
  const store = useStoreStore.getState();
  const pet = usePetStore.getState();
  const byId = new Map<string, UnsettledFeed>();

  for (const feed of store.unsettledFeeds ?? []) {
    byId.set(feed.id, feed);
  }

  for (const [id, receipt] of Object.entries(store.appliedFeeds ?? {})) {
    const fed = !!pet.appliedFeeds[id]?.fed;
    if (receipt.consumed && fed) continue;
    if (byId.has(id)) continue;
    byId.set(id, {
      id,
      itemId: receipt.itemId,
      monsterId: receipt.monsterId,
    });
  }

  for (const [id, receipt] of Object.entries(pet.appliedFeeds ?? {})) {
    const consumed = !!store.appliedFeeds[id]?.consumed;
    if (receipt.fed && consumed) continue;
    if (byId.has(id)) continue;
    const itemId = store.appliedFeeds[id]?.itemId;
    if (!itemId) continue;
    byId.set(id, {
      id,
      itemId,
      monsterId: receipt.monsterId,
    });
  }

  return [...byId.values()];
}

export function recoverUnsettledFeeds(): void {
  if (!storesHydrated()) return;
  assignLegacyPetToSelectedMonster();
  assignLegacyInventoryToSelectedMonster();
  if (feedInFlight) return;
  for (const feed of feedsToRecover()) {
    applyOneFeed(feed);
  }
}

export function executeFeed(itemId: string, monster?: MonsterId): boolean {
  if (!storesHydrated()) return false;
  if (feedInFlight) return false;
  feedInFlight = true;
  try {
    const monsterId = resolveMonsterId(
      monster ?? usePlayerStore.getState().selectedMonster,
    );
    const catalog = STORE_ITEMS.find((i) => i.id === itemId);
    if (!catalog || catalog.category !== "food") return false;
    if (!useStoreStore.getState().isOwned(itemId, monsterId)) return false;

    const feed: UnsettledFeed = {
      id: `${Date.now()}:feed:${itemId}`,
      itemId,
      monsterId,
    };
    applyOneFeed(feed);
    return true;
  } finally {
    feedInFlight = false;
  }
}

export function executePlay(itemId: string, monster?: MonsterId): boolean {
  if (!storesHydrated()) return false;
  const monsterId = resolveMonsterId(
    monster ?? usePlayerStore.getState().selectedMonster,
  );
  const catalog = STORE_ITEMS.find((i) => i.id === itemId);
  if (!catalog || catalog.category !== "toys") return false;
  if (!useStoreStore.getState().isOwned(itemId, monsterId)) return false;
  usePetStore.getState().applyPlay(monsterId);
  return true;
}

export function subscribeUnsettledFeedRecovery(): () => void {
  const unsubs: (() => void)[] = [];
  let finished = false;

  const onReady = () => {
    if (finished) return;
    if (!storesHydrated()) return;
    finished = true;
    while (unsubs.length > 0) unsubs.pop()?.();
    recoverUnsettledFeeds();
  };

  if (!useStoreStore.persist.hasHydrated()) {
    unsubs.push(useStoreStore.persist.onFinishHydration(onReady));
  }
  if (!usePetStore.persist.hasHydrated()) {
    unsubs.push(usePetStore.persist.onFinishHydration(onReady));
  }
  if (!usePlayerStore.persist.hasHydrated()) {
    unsubs.push(usePlayerStore.persist.onFinishHydration(onReady));
  }

  onReady();

  return () => {
    finished = true;
    while (unsubs.length > 0) unsubs.pop()?.();
  };
}
