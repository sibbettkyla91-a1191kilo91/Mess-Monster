import { create } from "zustand";
import { persist } from "zustand/middleware";

import {
  ACCESSORY_SLOTS,
  AccessorySlot,
  getAccessoryDef,
  isAccessorySlotLocked,
  type AccessoryMonster,
} from "./accessory-config";
import {
  INVENTORY_SLICE_KEYS,
  MONSTER_IDS,
  MonsterId,
  resolveMonsterId,
} from "./monster-id";
import {
  arrayOr,
  booleanOr,
  countOr,
  createSafeStorage,
  finiteNumberOr,
  guardHydrationStep,
  isRecord,
  oneOfOrNull,
  recordOfRecords,
  recordOr,
  safeMigrate,
} from "./safe-persist";
import { getItemType, getStoreItem, StoreItem } from "./store-items";
import { usePlayerStore } from "./use-player-store";

export type UnsettledPurchase = {
  id: string;
  itemId: string;
  price: number;
  autoConsume: boolean;
  monsterId?: MonsterId;
};

export type UnsettledFeed = {
  id: string;
  itemId: string;
  monsterId: MonsterId;
};

export type StorePurchaseReceipt = {
  granted?: true;
  consumed?: true;
};

export type StoreGrantReceipt = {
  freeItem?: true;
};

export type StoreFeedReceipt = {
  consumed?: true;
  itemId?: string;
  monsterId?: MonsterId;
};

export interface OwnedEntry {
  item: StoreItem;
  /** Units in inventory (repeatable items can stack) */
  quantity: number;
  /** Unix ms of first purchase */
  purchasedAt: number;
}

/** One item id per slot. Watch this map from screens; never expose a filtered helper. */
export type EquippedMap = Partial<Record<AccessorySlot, string>>;

export interface InventorySlice {
  owned: Record<string, OwnedEntry>;
  placed: Record<string, true>;
  equipped: EquippedMap;
}

export const EMPTY_OWNED: Record<string, OwnedEntry> = {};
export const EMPTY_PLACED: Record<string, true> = {};
export const EMPTY_EQUIPPED: EquippedMap = {};

export function createEmptyInventory(): InventorySlice {
  return { owned: {}, placed: {}, equipped: {} };
}

function activeMonsterId(): MonsterId {
  return resolveMonsterId(usePlayerStore.getState().selectedMonster);
}

function targetMonster(monster?: MonsterId | null): MonsterId {
  return resolveMonsterId(monster ?? usePlayerStore.getState().selectedMonster);
}

function writeInventory(
  s: { byMonster: Record<MonsterId, InventorySlice> },
  monster: MonsterId,
  patch: Partial<InventorySlice>,
): { byMonster: Record<MonsterId, InventorySlice> } & Partial<InventorySlice> {
  const nextSlice = { ...s.byMonster[monster], ...patch };
  const byMonster = { ...s.byMonster, [monster]: nextSlice };
  if (monster === activeMonsterId()) {
    return { byMonster, ...nextSlice };
  }
  return { byMonster };
}

/**
 * Shared v3 inventory lands on Nilly first. After the player store says who
 * was selected, a Luna player keeps those items and Nilly starts empty.
 */
export function assignLegacyInventoryToSelectedMonster(): void {
  const state = useStoreStore.getState();
  if (!state.legacySharedInventory) return;
  const target = resolveMonsterId(usePlayerStore.getState().selectedMonster);
  if (target === "nilly") {
    useStoreStore.setState({ legacySharedInventory: null });
    return;
  }
  const staged = state.byMonster.nilly;
  useStoreStore.setState({
    byMonster: { nilly: createEmptyInventory(), luna: staged },
    legacySharedInventory: null,
    ...staged,
  });
}

function assignLegacyOncePlayerReady(): void {
  const run = () =>
    guardHydrationStep(
      "mm-store-owned",
      assignLegacyInventoryToSelectedMonster,
    );
  if (usePlayerStore.persist.hasHydrated()) {
    run();
    return;
  }
  const stop = usePlayerStore.persist.onFinishHydration(() => {
    stop();
    run();
  });
}

// Exported for tests.
export function migrateStoreState(persistedState: any, version: number): any {
  const migrated = {
    ...persistedState,
    // v0 → v1: decor placement added. Items owned before this feature
    // simply become placeable (unplaced); nothing is lost.
    placed: persistedState?.placed ?? {},
    // v2 → v3: accessories can be worn. Older saves start unequipped.
    equipped: persistedState?.equipped ?? {},
    unsettledPurchases: persistedState?.unsettledPurchases ?? [],
    appliedPurchases: persistedState?.appliedPurchases ?? {},
    appliedRewardGrants: persistedState?.appliedRewardGrants ?? {},
    unsettledFeeds: persistedState?.unsettledFeeds ?? [],
    appliedFeeds: persistedState?.appliedFeeds ?? {},
  };
  // v1 → v2: toys changed from consumables (auto-used at purchase, so their
  // owned entry sat at quantity 0) to permanent collectibles like decor.
  // Restore one unit to every toy bought under the old behavior so players
  // keep what they paid for. Two parts, both needed:
  //  - refresh the persisted item snapshot from the catalog, because old
  //    snapshots have repeatable: true frozen in and the Collection screen
  //    filters on the snapshot, not the catalog;
  //  - bump quantity-0 toy entries to 1. Food stays untouched — quantity 0
  //    there means correctly consumed.
  if (version < 2 && migrated.owned) {
    const owned: Record<string, OwnedEntry> = {};
    for (const [id, entry] of Object.entries<any>(migrated.owned)) {
      // The v1 toys are no longer in the catalog; their snapshot category
      // still says "toys", which is all this needs.
      const catalogItem = getStoreItem(id);
      const isToy =
        catalogItem !== undefined
          ? catalogItem.itemType === "toy"
          : isRecord(entry?.item) && getItemType(entry.item) === "toy";
      if (isToy) {
        owned[id] = {
          ...entry,
          item: catalogItem ?? { ...entry.item, repeatable: false },
          quantity: entry.quantity === 0 ? 1 : entry.quantity,
        };
      } else {
        owned[id] = entry;
      }
    }
    migrated.owned = owned;
  }

  if (persistedState?.byMonster?.nilly && persistedState?.byMonster?.luna) {
    migrated.byMonster = persistedState.byMonster;
    migrated.legacySharedInventory =
      persistedState.legacySharedInventory ?? null;
    const active = migrated.byMonster.nilly;
    migrated.owned = active.owned ?? migrated.owned ?? {};
    migrated.placed = active.placed ?? migrated.placed ?? {};
    migrated.equipped = active.equipped ?? migrated.equipped ?? {};
    return migrated;
  }

  const legacy: InventorySlice = {
    owned: migrated.owned ?? {},
    placed: migrated.placed ?? {},
    equipped: migrated.equipped ?? {},
  };
  migrated.byMonster = {
    nilly: { ...legacy },
    luna: createEmptyInventory(),
  };
  migrated.legacySharedInventory = version < 4 ? legacy : null;
  return migrated;
}

/**
 * One owned entry the shop, bag, and Collection can trust. The item snapshot
 * is refreshed from the live catalog whenever the id is still sold — the
 * Collection filters on the snapshot, and a stale one is exactly how the toy
 * bug happened. Ids the catalog no longer knows keep their snapshot if it
 * still looks like an item; entries with nothing usable are dropped.
 */
function pickOwnedEntry(itemId: string, source: unknown): OwnedEntry | null {
  const src = recordOr(source);
  const catalogItem = getStoreItem(itemId);
  const snapshot = recordOr(src.item);
  const item =
    catalogItem ??
    (typeof snapshot.id === "string" && typeof snapshot.name === "string"
      ? (snapshot as unknown as StoreItem)
      : null);
  if (!item) return null;
  return {
    item,
    quantity: countOr(src.quantity, 0),
    purchasedAt: finiteNumberOr(src.purchasedAt, Date.now()),
  };
}

function sanitizeInventory(source: unknown): InventorySlice {
  const src = recordOr(source);
  const owned: Record<string, OwnedEntry> = {};
  for (const [itemId, entry] of Object.entries(recordOr(src.owned))) {
    const clean = pickOwnedEntry(itemId, entry);
    if (clean) owned[itemId] = clean;
  }
  const has = (itemId: unknown): itemId is string =>
    typeof itemId === "string" && (owned[itemId]?.quantity ?? 0) > 0;

  const placed: Record<string, true> = {};
  for (const [itemId, flag] of Object.entries(recordOr(src.placed))) {
    if (flag && has(itemId)) placed[itemId] = true;
  }
  const equipped: EquippedMap = {};
  for (const [slot, itemId] of Object.entries(recordOr(src.equipped))) {
    if ((ACCESSORY_SLOTS as string[]).includes(slot) && has(itemId)) {
      equipped[slot as AccessorySlot] = itemId;
    }
  }
  return { owned, placed, equipped };
}

function pickUnsettledPurchase(source: unknown): UnsettledPurchase | null {
  if (!isRecord(source)) return null;
  if (typeof source.id !== "string" || typeof source.itemId !== "string") {
    return null;
  }
  const price = finiteNumberOr(source.price, -1);
  if (price < 0) return null;
  const monsterId = oneOfOrNull(source.monsterId, MONSTER_IDS);
  return {
    id: source.id,
    itemId: source.itemId,
    price,
    autoConsume: booleanOr(source.autoConsume, false),
    ...(monsterId ? { monsterId } : {}),
  };
}

function pickUnsettledFeed(source: unknown): UnsettledFeed | null {
  if (!isRecord(source)) return null;
  if (typeof source.id !== "string" || typeof source.itemId !== "string") {
    return null;
  }
  const monsterId = oneOfOrNull(source.monsterId, MONSTER_IDS);
  if (!monsterId) return null;
  return { id: source.id, itemId: source.itemId, monsterId };
}

type PersistedStoreState = ReturnType<typeof partializeStore>;

function partializeStore(s: StoreStore) {
  return {
    byMonster: s.byMonster,
    legacySharedInventory: s.legacySharedInventory,
    unsettledPurchases: s.unsettledPurchases,
    appliedPurchases: s.appliedPurchases,
    appliedRewardGrants: s.appliedRewardGrants,
    unsettledFeeds: s.unsettledFeeds,
    appliedFeeds: s.appliedFeeds,
  };
}

/**
 * Give a persisted inventory record — same version, migrated, or damaged —
 * a shape the store can run on. Exported for tests.
 */
export function sanitizeStorePersisted(
  persisted: unknown,
): PersistedStoreState {
  const src = recordOr(persisted);
  const by = recordOr(src.byMonster);
  return {
    byMonster: {
      nilly: sanitizeInventory(by.nilly),
      luna: sanitizeInventory(by.luna),
    },
    legacySharedInventory: isRecord(src.legacySharedInventory)
      ? sanitizeInventory(src.legacySharedInventory)
      : null,
    unsettledPurchases: arrayOr(src.unsettledPurchases)
      .map(pickUnsettledPurchase)
      .filter((p): p is UnsettledPurchase => p !== null),
    appliedPurchases: recordOfRecords(
      src.appliedPurchases,
    ) as StoreStore["appliedPurchases"],
    appliedRewardGrants: recordOfRecords(
      src.appliedRewardGrants,
    ) as StoreStore["appliedRewardGrants"],
    unsettledFeeds: arrayOr(src.unsettledFeeds)
      .map(pickUnsettledFeed)
      .filter((f): f is UnsettledFeed => f !== null),
    appliedFeeds: recordOfRecords(
      src.appliedFeeds,
    ) as StoreStore["appliedFeeds"],
  };
}

function mergeStoreState(persisted: unknown, current: StoreStore): StoreStore {
  if (persisted === undefined) return current;
  const clean = sanitizeStorePersisted(persisted);
  // Flat fields mirror the selected monster; re-flattened after the player
  // store hydrates (afterHydrate / the selectedMonster subscription).
  return { ...current, ...clean, ...clean.byMonster[activeMonsterId()] };
}

function upsertUnsettled(
  list: UnsettledPurchase[] | undefined,
  purchase: UnsettledPurchase,
): UnsettledPurchase[] {
  const current = list ?? [];
  if (current.some((p) => p.id === purchase.id)) return current;
  return [...current, purchase];
}

function upsertUnsettledFeed(
  list: UnsettledFeed[] | undefined,
  feed: UnsettledFeed,
): UnsettledFeed[] {
  const current = list ?? [];
  if (current.some((f) => f.id === feed.id)) return current;
  return [...current, feed];
}

interface StoreStore extends InventorySlice {
  byMonster: Record<MonsterId, InventorySlice>;
  legacySharedInventory: InventorySlice | null;

  unsettledPurchases: UnsettledPurchase[];
  appliedPurchases: Record<string, StorePurchaseReceipt>;
  /** Gift receipts for reward grants, keyed by grant id. */
  appliedRewardGrants: Record<string, StoreGrantReceipt>;
  unsettledFeeds: UnsettledFeed[];
  appliedFeeds: Record<string, StoreFeedReceipt>;

  /** Add an item to the owned collection. Returns true on success. */
  buyItem: (item: StoreItem, monster?: MonsterId) => boolean;

  /** Returns true if a non-repeatable item has been purchased (or repeatable qty > 0). */
  isOwned: (id: string, monster?: MonsterId) => boolean;

  /** Consume one unit of a repeatable item. Returns true if successful. */
  useItem: (id: string, monster?: MonsterId) => boolean;

  /** Place or remove an owned item in the habitat room. No-op if not owned. */
  togglePlaced: (id: string, monster?: MonsterId) => void;

  /** Returns true if the item is currently placed in the room. */
  isPlaced: (id: string, monster?: MonsterId) => boolean;

  /** Wear an owned accessory. Replaces anything already in that slot. */
  equipAccessory: (itemId: string, monster: AccessoryMonster) => boolean;

  /** Take off whatever is in this slot. */
  unequipSlot: (slot: AccessorySlot, monster?: MonsterId) => void;

  grantPurchase: (purchase: UnsettledPurchase) => void;
  consumePurchase: (purchaseId: string, itemId: string) => void;
  clearUnsettledPurchase: (purchaseId: string) => void;
  applyRewardGrantFreeItem: (
    grantId: string,
    itemId: string,
    monster?: MonsterId,
  ) => void;
  beginFeed: (feed: UnsettledFeed) => void;
  consumeFeed: (feedId: string, itemId: string, monster: MonsterId) => void;
  clearUnsettledFeed: (feedId: string) => void;
}

const emptyNilly = createEmptyInventory();
const emptyLuna = createEmptyInventory();

export const useStoreStore = create<StoreStore>()(
  persist(
    (set, get) => ({
      owned: {},
      placed: {},
      equipped: {},
      byMonster: { nilly: emptyNilly, luna: emptyLuna },
      legacySharedInventory: null,
      unsettledPurchases: [],
      appliedPurchases: {},
      appliedRewardGrants: {},
      unsettledFeeds: [],
      appliedFeeds: {},

      buyItem: (item, monster) => {
        const id = targetMonster(monster);
        set((s) => {
          const bag = s.byMonster[id].owned;
          const existing = bag[item.id];
          return writeInventory(s, id, {
            owned: {
              ...bag,
              [item.id]: {
                item,
                quantity: (existing?.quantity ?? 0) + 1,
                purchasedAt: existing?.purchasedAt ?? Date.now(),
              },
            },
          });
        });
        return true;
      },

      isOwned: (itemId, monster) => {
        const id = targetMonster(monster);
        const entry = get().byMonster[id].owned[itemId];
        return !!entry && entry.quantity > 0;
      },

      useItem: (itemId, monster) => {
        const id = targetMonster(monster);
        const entry = get().byMonster[id].owned[itemId];
        if (!entry || entry.quantity <= 0) return false;
        set((s) => ({
          ...writeInventory(s, id, {
            owned: {
              ...s.byMonster[id].owned,
              [itemId]: {
                ...s.byMonster[id].owned[itemId],
                quantity: s.byMonster[id].owned[itemId].quantity - 1,
              },
            },
          }),
        }));
        return true;
      },

      togglePlaced: (itemId, monster) => {
        const id = targetMonster(monster);
        const entry = get().byMonster[id].owned[itemId];
        if (!entry || entry.quantity <= 0) return;
        set((s) => {
          const placed = { ...s.byMonster[id].placed };
          if (placed[itemId]) {
            delete placed[itemId];
          } else {
            placed[itemId] = true;
          }
          return writeInventory(s, id, { placed });
        });
      },

      isPlaced: (itemId, monster) =>
        !!get().byMonster[targetMonster(monster)].placed[itemId],

      equipAccessory: (itemId, monster) => {
        const def = getAccessoryDef(itemId);
        if (!def) return false;
        const id = targetMonster(monster);
        const entry = get().byMonster[id].owned[itemId];
        if (!entry || entry.quantity <= 0) return false;
        if (isAccessorySlotLocked(monster, def.slot)) return false;
        set((s) =>
          writeInventory(s, id, {
            equipped: { ...s.byMonster[id].equipped, [def.slot]: itemId },
          }),
        );
        return true;
      },

      unequipSlot: (slot, monster) => {
        const id = targetMonster(monster);
        set((s) => {
          if (!s.byMonster[id].equipped[slot]) return {};
          const equipped = { ...s.byMonster[id].equipped };
          delete equipped[slot];
          return writeInventory(s, id, { equipped });
        });
      },

      grantPurchase: (purchase) => {
        const id = targetMonster(purchase.monsterId);
        set((s) => {
          const receipts = s.appliedPurchases ?? {};
          const unsettled = upsertUnsettled(s.unsettledPurchases, {
            ...purchase,
            monsterId: id,
          });
          if (receipts[purchase.id]?.granted) {
            return { unsettledPurchases: unsettled };
          }
          const catalogItem = getStoreItem(purchase.itemId);
          if (!catalogItem) {
            // Nothing to hand out for an item the catalog no longer knows.
            // Still write the receipt so a durable charge for it does not
            // re-enter recovery on every cold start.
            return {
              unsettledPurchases: unsettled,
              appliedPurchases: {
                ...receipts,
                [purchase.id]: { ...receipts[purchase.id], granted: true },
              },
            };
          }
          const bag = s.byMonster[id].owned;
          const existing = bag[purchase.itemId];
          const alreadyOwned =
            !catalogItem.repeatable && (existing?.quantity ?? 0) > 0;
          const owned = alreadyOwned
            ? bag
            : {
                ...bag,
                [purchase.itemId]: {
                  item: catalogItem,
                  quantity: (existing?.quantity ?? 0) + 1,
                  purchasedAt: existing?.purchasedAt ?? Date.now(),
                },
              };
          return {
            ...writeInventory(s, id, { owned }),
            unsettledPurchases: unsettled,
            appliedPurchases: {
              ...receipts,
              [purchase.id]: { ...receipts[purchase.id], granted: true },
            },
          };
        });
      },

      consumePurchase: (purchaseId, itemId) => {
        const monster = activeMonsterId();
        set((s) => {
          const receipts = s.appliedPurchases ?? {};
          if (receipts[purchaseId]?.consumed) return {};
          const bag = s.byMonster[monster].owned;
          const entry = bag[itemId];
          const nextOwned =
            entry && entry.quantity > 0
              ? {
                  ...bag,
                  [itemId]: { ...entry, quantity: entry.quantity - 1 },
                }
              : bag;
          return {
            ...writeInventory(s, monster, { owned: nextOwned }),
            appliedPurchases: {
              ...receipts,
              [purchaseId]: { ...receipts[purchaseId], consumed: true },
            },
          };
        });
      },

      clearUnsettledPurchase: (purchaseId) => {
        set((s) => ({
          unsettledPurchases: (s.unsettledPurchases ?? []).filter(
            (p) => p.id !== purchaseId,
          ),
        }));
      },

      applyRewardGrantFreeItem: (grantId, itemId, monster) => {
        const id = targetMonster(monster);
        set((s) => {
          const receipts = s.appliedRewardGrants ?? {};
          if (receipts[grantId]?.freeItem) return {};
          const catalogItem = getStoreItem(itemId);
          const nextReceipts = {
            ...receipts,
            [grantId]: { ...receipts[grantId], freeItem: true as const },
          };
          if (!catalogItem) {
            return { appliedRewardGrants: nextReceipts };
          }
          const bag = s.byMonster[id].owned;
          const existing = bag[itemId];
          return {
            ...writeInventory(s, id, {
              owned: {
                ...bag,
                [itemId]: {
                  item: catalogItem,
                  quantity: (existing?.quantity ?? 0) + 1,
                  purchasedAt: existing?.purchasedAt ?? Date.now(),
                },
              },
            }),
            appliedRewardGrants: nextReceipts,
          };
        });
      },

      beginFeed: (feed) => {
        set((s) => {
          const receipts = s.appliedFeeds ?? {};
          const existing = receipts[feed.id];
          const itemId = feed.itemId || existing?.itemId;
          const monsterId = feed.monsterId || existing?.monsterId;
          return {
            unsettledFeeds: upsertUnsettledFeed(s.unsettledFeeds, feed),
            appliedFeeds: {
              ...receipts,
              [feed.id]: {
                ...existing,
                ...(itemId ? { itemId } : {}),
                ...(monsterId ? { monsterId } : {}),
              },
            },
          };
        });
      },

      consumeFeed: (feedId, itemId, monster) => {
        set((s) => {
          const receipts = s.appliedFeeds ?? {};
          if (receipts[feedId]?.consumed) return {};
          const resolvedItemId = itemId || receipts[feedId]?.itemId || "";
          const bag = s.byMonster[monster].owned;
          const entry = resolvedItemId ? bag[resolvedItemId] : undefined;
          const nextOwned =
            entry && entry.quantity > 0
              ? {
                  ...bag,
                  [resolvedItemId]: { ...entry, quantity: entry.quantity - 1 },
                }
              : bag;
          return {
            ...writeInventory(s, monster, { owned: nextOwned }),
            appliedFeeds: {
              ...receipts,
              [feedId]: {
                ...receipts[feedId],
                consumed: true,
                ...(resolvedItemId ? { itemId: resolvedItemId } : {}),
                monsterId: monster,
              },
            },
          };
        });
      },

      clearUnsettledFeed: (feedId) => {
        set((s) => ({
          unsettledFeeds: (s.unsettledFeeds ?? []).filter(
            (f) => f.id !== feedId,
          ),
        }));
      },
    }),
    {
      name: "mm-store-owned",
      storage: createSafeStorage(),
      version: 4,
      migrate: safeMigrate("mm-store-owned", migrateStoreState),
      partialize: partializeStore,
      merge: mergeStoreState,
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const after = () =>
          guardHydrationStep("mm-store-owned", () => {
            assignLegacyOncePlayerReady();
            const live = useStoreStore.getState();
            const slice = live.byMonster[activeMonsterId()];
            useStoreStore.setState({ ...slice });
          });
        if (typeof setImmediate !== "undefined") {
          setImmediate(after);
        } else {
          setTimeout(after, 0);
        }
      },
    },
  ),
);

function pickInventoryPatch(
  patch: Record<string, unknown>,
): Partial<InventorySlice> {
  const out: Partial<InventorySlice> = {};
  for (const key of INVENTORY_SLICE_KEYS) {
    if (key in patch && patch[key] !== undefined) {
      (out as Record<string, unknown>)[key] = patch[key];
    }
  }
  return out;
}

const innerStoreSetState = useStoreStore.setState.bind(useStoreStore);
useStoreStore.setState = ((
  partial: Parameters<typeof useStoreStore.setState>[0],
  replace?: boolean,
) => {
  if (replace === true) {
    innerStoreSetState(partial as StoreStore, true);
    return;
  }
  const project = (s: StoreStore, patch: Partial<StoreStore>) => {
    if (
      patch.byMonster &&
      Object.keys(pickInventoryPatch(patch)).length === 0
    ) {
      return { ...patch, ...patch.byMonster[activeMonsterId()] };
    }
    const slicePatch = pickInventoryPatch(patch);
    if (Object.keys(slicePatch).length === 0) return patch;
    const id = activeMonsterId();
    const currentBy = patch.byMonster ?? s.byMonster;
    const nextSlice = { ...currentBy[id], ...slicePatch };
    return {
      ...patch,
      byMonster: { ...currentBy, [id]: nextSlice },
      ...nextSlice,
    };
  };
  if (typeof partial === "function") {
    innerStoreSetState((s) => {
      const next = partial(s);
      if (!next) return next;
      return project(s, next);
    });
  } else {
    innerStoreSetState((s) => project(s, partial));
  }
}) as typeof useStoreStore.setState;

usePlayerStore.subscribe((state, prev) => {
  if (state.selectedMonster === prev.selectedMonster) return;
  const slice = useStoreStore.getState().byMonster[activeMonsterId()];
  if (slice) innerStoreSetState({ ...slice });
});
