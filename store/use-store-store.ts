import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { STORE_ITEMS, StoreItem } from "./store-items";

export type UnsettledPurchase = {
  id: string;
  itemId: string;
  price: number;
  autoConsume: boolean;
};

export type StorePurchaseReceipt = {
  granted?: true;
  consumed?: true;
};

export type StoreGrantReceipt = {
  freeItem?: true;
};

// Exported for tests.
export function migrateStoreState(persistedState: any, version: number): any {
  const migrated = {
    ...persistedState,
    // v0 → v1: decor placement added. Items owned before this feature
    // simply become placeable (unplaced); nothing is lost.
    placed: persistedState?.placed ?? {},
    unsettledPurchases: persistedState?.unsettledPurchases ?? [],
    appliedPurchases: persistedState?.appliedPurchases ?? {},
    appliedRewardGrants: persistedState?.appliedRewardGrants ?? {},
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
      const catalogItem = STORE_ITEMS.find((i) => i.id === id);
      if (catalogItem?.category === "toys") {
        owned[id] = {
          ...entry,
          item: catalogItem,
          quantity: entry.quantity === 0 ? 1 : entry.quantity,
        };
      } else {
        owned[id] = entry;
      }
    }
    migrated.owned = owned;
  }
  return migrated;
}

export interface OwnedEntry {
  item: StoreItem;
  /** Units in inventory (repeatable items can stack) */
  quantity: number;
  /** Unix ms of first purchase */
  purchasedAt: number;
}

function upsertUnsettled(
  list: UnsettledPurchase[] | undefined,
  purchase: UnsettledPurchase,
): UnsettledPurchase[] {
  const current = list ?? [];
  if (current.some((p) => p.id === purchase.id)) return current;
  return [...current, purchase];
}

interface StoreStore {
  owned: Record<string, OwnedEntry>;

  /** Item ids currently placed in the habitat room (decor and toys). */
  placed: Record<string, true>;

  unsettledPurchases: UnsettledPurchase[];
  appliedPurchases: Record<string, StorePurchaseReceipt>;
  /** Gift receipts for reward grants, keyed by grant id. */
  appliedRewardGrants: Record<string, StoreGrantReceipt>;

  /** Add an item to the owned collection. Returns true on success. */
  buyItem: (item: StoreItem) => boolean;

  /** Returns true if a non-repeatable item has been purchased (or repeatable qty > 0). */
  isOwned: (id: string) => boolean;

  /** Consume one unit of a repeatable item. Returns true if successful. */
  useItem: (id: string) => boolean;

  /** Get all owned entries with quantity > 0. */
  getOwnedItems: () => OwnedEntry[];

  /** Place or remove an owned item in the habitat room. No-op if not owned. */
  togglePlaced: (id: string) => void;

  /** Returns true if the item is currently placed in the room. */
  isPlaced: (id: string) => boolean;

  grantPurchase: (purchase: UnsettledPurchase) => void;
  consumePurchase: (purchaseId: string, itemId: string) => void;
  clearUnsettledPurchase: (purchaseId: string) => void;
  applyRewardGrantFreeItem: (grantId: string, itemId: string) => void;
}

export const useStoreStore = create<StoreStore>()(
  persist(
    (set, get) => ({
      owned: {},
      placed: {},
      unsettledPurchases: [],
      appliedPurchases: {},
      appliedRewardGrants: {},

      buyItem: (item) => {
        set((s) => {
          const existing = s.owned[item.id];
          return {
            owned: {
              ...s.owned,
              [item.id]: {
                item,
                quantity: (existing?.quantity ?? 0) + 1,
                purchasedAt: existing?.purchasedAt ?? Date.now(),
              },
            },
          };
        });
        return true;
      },

      isOwned: (id) => {
        const entry = get().owned[id];
        return !!entry && entry.quantity > 0;
      },

      useItem: (id) => {
        const entry = get().owned[id];
        if (!entry || entry.quantity <= 0) return false;
        set((s) => ({
          owned: {
            ...s.owned,
            [id]: { ...s.owned[id], quantity: s.owned[id].quantity - 1 },
          },
        }));
        return true;
      },

      getOwnedItems: () =>
        Object.values(get().owned).filter((e) => e.quantity > 0),

      togglePlaced: (id) => {
        const entry = get().owned[id];
        if (!entry || entry.quantity <= 0) return;
        set((s) => {
          const placed = { ...s.placed };
          if (placed[id]) {
            delete placed[id];
          } else {
            placed[id] = true;
          }
          return { placed };
        });
      },

      isPlaced: (id) => !!get().placed[id],

      grantPurchase: (purchase) => {
        set((s) => {
          const receipts = s.appliedPurchases ?? {};
          const unsettled = upsertUnsettled(s.unsettledPurchases, purchase);
          if (receipts[purchase.id]?.granted) {
            return { unsettledPurchases: unsettled };
          }
          const catalogItem = STORE_ITEMS.find((i) => i.id === purchase.itemId);
          if (!catalogItem) return { unsettledPurchases: unsettled };
          const existing = s.owned[purchase.itemId];
          const alreadyOwned =
            !catalogItem.repeatable && (existing?.quantity ?? 0) > 0;
          const owned = alreadyOwned
            ? s.owned
            : {
                ...s.owned,
                [purchase.itemId]: {
                  item: catalogItem,
                  quantity: (existing?.quantity ?? 0) + 1,
                  purchasedAt: existing?.purchasedAt ?? Date.now(),
                },
              };
          return {
            owned,
            unsettledPurchases: unsettled,
            appliedPurchases: {
              ...receipts,
              [purchase.id]: { ...receipts[purchase.id], granted: true },
            },
          };
        });
      },

      consumePurchase: (purchaseId, itemId) => {
        set((s) => {
          const receipts = s.appliedPurchases ?? {};
          if (receipts[purchaseId]?.consumed) return {};
          const entry = s.owned[itemId];
          const nextOwned =
            entry && entry.quantity > 0
              ? {
                  ...s.owned,
                  [itemId]: { ...entry, quantity: entry.quantity - 1 },
                }
              : s.owned;
          return {
            owned: nextOwned,
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

      applyRewardGrantFreeItem: (grantId, itemId) => {
        set((s) => {
          const receipts = s.appliedRewardGrants ?? {};
          if (receipts[grantId]?.freeItem) return {};
          const catalogItem = STORE_ITEMS.find((i) => i.id === itemId);
          const nextReceipts = {
            ...receipts,
            [grantId]: { ...receipts[grantId], freeItem: true as const },
          };
          if (!catalogItem) {
            return { appliedRewardGrants: nextReceipts };
          }
          const existing = s.owned[itemId];
          return {
            owned: {
              ...s.owned,
              [itemId]: {
                item: catalogItem,
                quantity: (existing?.quantity ?? 0) + 1,
                purchasedAt: existing?.purchasedAt ?? Date.now(),
              },
            },
            appliedRewardGrants: nextReceipts,
          };
        });
      },
    }),
    {
      name: "mm-store-owned",
      storage: createJSONStorage(() => AsyncStorage),
      version: 3,
      migrate: migrateStoreState,
    },
  ),
);
