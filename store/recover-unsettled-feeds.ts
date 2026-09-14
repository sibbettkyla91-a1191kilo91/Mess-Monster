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
 * a crash between those writes. itemId and monsterId are written onto both
 * store and pet receipts from the first write so a lost unsettled list can
 * still consume. Stats are applied first so a crash after the bump still
 * leaves the player with the care; recovery then consumes the snack.
 *
 * One successful Feed = one consume + one +8/+8. If consume cannot finish
 * because the item is unknown, the feed is still settled so stats cannot
 * apply a second time. Repeated recovery is a no-op.
 */

function storesHydrated(): boolean {
  return (
    useStoreStore.persist.hasHydrated() &&
    usePetStore.persist.hasHydrated() &&
    usePlayerStore.persist.hasHydrated()
  );
}

let feedInFlight = false;

// Same-millisecond feeds must not share an id, or the second one would
// settle against the first one's receipts and silently do nothing.
let feedSeq = 0;
function nextFeedId(itemId: string): string {
  feedSeq += 1;
  return `${Date.now()}:${feedSeq}:feed:${itemId}`;
}

function applyOneFeed(feed: UnsettledFeed): void {
  const storeReceipt = useStoreStore.getState().appliedFeeds[feed.id];
  const petReceipt = usePetStore.getState().appliedFeeds[feed.id];
  const itemId =
    feed.itemId || storeReceipt?.itemId || petReceipt?.itemId || "";
  const monsterId =
    feed.monsterId || storeReceipt?.monsterId || petReceipt?.monsterId;
  if (!monsterId) return;

  const resolved: UnsettledFeed = { id: feed.id, itemId, monsterId };
  useStoreStore.getState().beginFeed(resolved);
  // Unknown item: never grant +8/+8. Settle consume so this feed cannot replay.
  if (itemId) {
    usePetStore.getState().applyFeed(resolved.id, monsterId, itemId);
    useStoreStore.getState().consumeFeed(resolved.id, itemId, monsterId);
  } else {
    useStoreStore.getState().consumeFeed(resolved.id, "", monsterId);
  }
  useStoreStore.getState().clearUnsettledFeed(resolved.id);
}

function feedsToRecover(): UnsettledFeed[] {
  const store = useStoreStore.getState();
  const pet = usePetStore.getState();
  const ids = new Set<string>();

  for (const feed of store.unsettledFeeds ?? []) ids.add(feed.id);
  for (const id of Object.keys(store.appliedFeeds ?? {})) ids.add(id);
  for (const id of Object.keys(pet.appliedFeeds ?? {})) ids.add(id);

  const unsettledById = new Map(
    (store.unsettledFeeds ?? []).map((feed) => [feed.id, feed]),
  );

  const out: UnsettledFeed[] = [];
  for (const id of ids) {
    const intent = unsettledById.get(id);
    const storeReceipt = store.appliedFeeds?.[id];
    const petReceipt = pet.appliedFeeds?.[id];
    if (storeReceipt?.consumed && petReceipt?.fed && !intent) continue;

    const itemId = intent?.itemId || storeReceipt?.itemId || petReceipt?.itemId;
    const monsterId =
      intent?.monsterId || storeReceipt?.monsterId || petReceipt?.monsterId;
    if (!monsterId) continue;

    out.push({ id, itemId: itemId ?? "", monsterId });
  }
  return out;
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
      id: nextFeedId(itemId),
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
