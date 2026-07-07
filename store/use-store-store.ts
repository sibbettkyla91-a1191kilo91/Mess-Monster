import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { StoreItem } from "./store-items";

export interface OwnedEntry {
  item: StoreItem;
  /** Units in inventory (repeatable items can stack) */
  quantity: number;
  /** Unix ms of first purchase */
  purchasedAt: number;
}

interface StoreStore {
  owned: Record<string, OwnedEntry>;

  /** Add an item to the owned collection. Returns true on success. */
  buyItem: (item: StoreItem) => boolean;

  /** Returns true if a non-repeatable item has been purchased (or repeatable qty > 0). */
  isOwned: (id: string) => boolean;

  /** Consume one unit of a repeatable item. Returns true if successful. */
  useItem: (id: string) => boolean;

  /** Get all owned entries with quantity > 0. */
  getOwnedItems: () => OwnedEntry[];
}

export const useStoreStore = create<StoreStore>()(
  persist(
    (set, get) => ({
      owned: {},

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
    }),
    {
      name: "mm-store-owned",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
