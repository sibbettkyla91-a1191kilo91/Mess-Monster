/**
 * Shop grant/charge durability. Grant (mm-store-owned) and charge (mm-player)
 * persist independently. Recovery grants a missing item after a durable
 * charge, and never retroactively charges after a durable grant.
 */
import {
  executePaidShopPurchase,
  recoverUnsettledPurchases,
} from "@/store/recover-unsettled-purchases";
import { STORE_ITEMS } from "@/store/store-items";
import { UnsettledPurchase, useStoreStore } from "@/store/use-store-store";
import { usePlayerStore } from "@/store/use-player-store";
import { usePetStore } from "@/store/use-pet-store";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/utils/daily-nudge", () => ({
  rescheduleDailyNudges: jest.fn().mockResolvedValue(undefined),
}));

const plant = STORE_ITEMS.find((i) => i.id === "decor-plant")!;
const cookie = STORE_ITEMS.find((i) => i.id === "food-cookie")!;

const purchase = (
  item: (typeof STORE_ITEMS)[number],
  id = `tx:${item.id}`,
): UnsettledPurchase => ({
  id,
  itemId: item.id,
  price: item.price,
  autoConsume: item.repeatable,
});

async function flushHydration() {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

function resetStores() {
  useStoreStore.setState({
    owned: {},
    placed: {},
    unsettledPurchases: [],
    appliedPurchases: {},
  });
  usePlayerStore.setState({
    totalPoints: 100,
    spentPoints: 0,
    appliedPurchases: {},
    selectedMonster: "nilly",
  });
  usePetStore.setState({
    health: 50,
    happiness: 50,
    lastCaredAt: Date.now() - 60_000,
    appliedPurchases: {},
  });
}

beforeEach(async () => {
  resetStores();
  await flushHydration();
});

describe("paid collectible persist orders", () => {
  it("keeps the item and does not charge when grant is durable and charge is missing", () => {
    const tx = purchase(plant, "grant-only");
    useStoreStore.getState().grantPurchase(tx);

    expect(useStoreStore.getState().isOwned(plant.id)).toBe(true);
    expect(usePlayerStore.getState().spentPoints).toBe(0);

    recoverUnsettledPurchases();
    recoverUnsettledPurchases();

    expect(useStoreStore.getState().owned[plant.id].quantity).toBe(1);
    expect(usePlayerStore.getState().spentPoints).toBe(0);
    expect(usePlayerStore.getState().appliedPurchases["grant-only"]?.charged).toBeUndefined();
    expect(useStoreStore.getState().unsettledPurchases).toHaveLength(0);
  });

  it("restores the item and does not charge again when charge is durable and grant is missing", () => {
    const tx = purchase(plant, "charge-only");
    usePlayerStore.getState().chargePurchase(tx.id, tx.itemId, tx.price, tx.autoConsume);

    expect(usePlayerStore.getState().spentPoints).toBe(plant.price);
    expect(useStoreStore.getState().owned[plant.id]).toBeUndefined();

    recoverUnsettledPurchases();
    recoverUnsettledPurchases();

    expect(useStoreStore.getState().owned[plant.id].quantity).toBe(1);
    expect(usePlayerStore.getState().spentPoints).toBe(plant.price);
    expect(useStoreStore.getState().appliedPurchases["charge-only"]?.granted).toBe(
      true,
    );
    expect(useStoreStore.getState().unsettledPurchases).toHaveLength(0);
  });
});

describe("paid food stays in the bag", () => {
  it("grants food without consuming or caring, and recovery does not change that", () => {
    expect(executePaidShopPurchase(cookie)).toBe(true);
    expect(useStoreStore.getState().owned[cookie.id].quantity).toBe(1);
    expect(usePlayerStore.getState().spentPoints).toBe(cookie.price);
    expect(usePetStore.getState().health).toBe(50);
    expect(usePetStore.getState().happiness).toBe(50);

    recoverUnsettledPurchases();
    recoverUnsettledPurchases();

    expect(useStoreStore.getState().owned[cookie.id].quantity).toBe(1);
    expect(usePlayerStore.getState().spentPoints).toBe(cookie.price);
    expect(usePetStore.getState().health).toBe(50);
    expect(usePetStore.getState().happiness).toBe(50);
    expect(usePetStore.getState().appliedPurchases[Object.keys(usePlayerStore.getState().appliedPurchases)[0]]?.cared).toBeUndefined();
  });

  it("leaves leftover food in the bag after grant+charge without consume", () => {
    const tx = purchase(cookie, "food-mid");
    useStoreStore.getState().grantPurchase(tx);
    usePlayerStore
      .getState()
      .chargePurchase(tx.id, tx.itemId, tx.price, tx.autoConsume);

    expect(useStoreStore.getState().owned[cookie.id].quantity).toBe(1);
    expect(usePetStore.getState().health).toBe(50);

    recoverUnsettledPurchases();
    recoverUnsettledPurchases();

    expect(useStoreStore.getState().owned[cookie.id].quantity).toBe(1);
    expect(usePlayerStore.getState().spentPoints).toBe(cookie.price);
    expect(usePetStore.getState().health).toBe(50);
    expect(usePetStore.getState().happiness).toBe(50);
    expect(usePetStore.getState().appliedPurchases["food-mid"]?.cared).toBeUndefined();
  });
});

describe("gifted food", () => {
  it("stashes a gifted unit without charging or caring", () => {
    useStoreStore.getState().buyItem(cookie);
    expect(useStoreStore.getState().owned[cookie.id].quantity).toBe(1);
    expect(usePlayerStore.getState().spentPoints).toBe(0);
    expect(usePetStore.getState().health).toBe(50);

    recoverUnsettledPurchases();

    expect(usePlayerStore.getState().spentPoints).toBe(0);
    expect(usePlayerStore.getState().appliedPurchases).toEqual({});
    expect(useStoreStore.getState().owned[cookie.id].quantity).toBe(1);
    expect(usePetStore.getState().health).toBe(50);
    expect(useStoreStore.getState().unsettledPurchases).toHaveLength(0);
  });
});

describe("non-repeatable ownership", () => {
  it("does not add a second unit when recovering a charge against an already-owned item", () => {
    const first = purchase(plant, "owned-first");
    useStoreStore.getState().grantPurchase(first);
    useStoreStore.getState().clearUnsettledPurchase(first.id);
    expect(useStoreStore.getState().owned[plant.id].quantity).toBe(1);

    const second = purchase(plant, "owned-second");
    usePlayerStore
      .getState()
      .chargePurchase(second.id, second.itemId, second.price, false);

    recoverUnsettledPurchases();
    recoverUnsettledPurchases();

    expect(useStoreStore.getState().owned[plant.id].quantity).toBe(1);
    expect(useStoreStore.getState().appliedPurchases["owned-second"]?.granted).toBe(
      true,
    );
  });

  it("does not charge a second live purchase of an already-owned non-repeatable item", () => {
    expect(executePaidShopPurchase(plant)).toBe(true);
    expect(useStoreStore.getState().owned[plant.id].quantity).toBe(1);
    expect(usePlayerStore.getState().spentPoints).toBe(plant.price);

    expect(executePaidShopPurchase(plant)).toBe(false);

    expect(useStoreStore.getState().owned[plant.id].quantity).toBe(1);
    expect(usePlayerStore.getState().spentPoints).toBe(plant.price);
    expect(usePlayerStore.getState().totalPoints - usePlayerStore.getState().spentPoints).toBe(
      100 - plant.price,
    );
  });
});

describe("old autoConsume food mid-recovery", () => {
  const seedPaidFoodConsumed = (id: string, keepUnsettled: boolean) => {
    const tx = purchase(cookie, id);
    useStoreStore.getState().grantPurchase(tx);
    usePlayerStore
      .getState()
      .chargePurchase(tx.id, tx.itemId, tx.price, tx.autoConsume);
    useStoreStore.getState().consumePurchase(tx.id, tx.itemId);
    if (!keepUnsettled) {
      useStoreStore.getState().clearUnsettledPurchase(tx.id);
    }
    return tx;
  };

  it("does not apply the old purchase-care boost when the snack was already consumed", () => {
    seedPaidFoodConsumed("food-care-unsettled", true);

    expect(useStoreStore.getState().owned[cookie.id].quantity).toBe(0);
    expect(usePetStore.getState().health).toBe(50);
    expect(useStoreStore.getState().unsettledPurchases).toHaveLength(1);

    recoverUnsettledPurchases();
    recoverUnsettledPurchases();

    expect(useStoreStore.getState().owned[cookie.id].quantity).toBe(0);
    expect(usePlayerStore.getState().spentPoints).toBe(cookie.price);
    expect(usePetStore.getState().health).toBe(50);
    expect(usePetStore.getState().happiness).toBe(50);
    expect(usePetStore.getState().appliedPurchases["food-care-unsettled"]?.cared).toBeUndefined();
    expect(useStoreStore.getState().unsettledPurchases).toHaveLength(0);
  });

  it("does not invent care after store-side clear persisted before pet care", () => {
    seedPaidFoodConsumed("food-care-cleared", false);

    expect(useStoreStore.getState().unsettledPurchases).toHaveLength(0);
    expect(useStoreStore.getState().appliedPurchases["food-care-cleared"]).toEqual({
      granted: true,
      consumed: true,
    });
    expect(usePlayerStore.getState().appliedPurchases["food-care-cleared"]?.charged).toBe(
      true,
    );
    expect(usePetStore.getState().appliedPurchases["food-care-cleared"]?.cared).toBeUndefined();
    expect(usePetStore.getState().health).toBe(50);

    recoverUnsettledPurchases();
    recoverUnsettledPurchases();

    expect(useStoreStore.getState().owned[cookie.id].quantity).toBe(0);
    expect(usePlayerStore.getState().spentPoints).toBe(cookie.price);
    expect(usePetStore.getState().health).toBe(50);
    expect(usePetStore.getState().happiness).toBe(50);
    expect(usePetStore.getState().appliedPurchases["food-care-cleared"]?.cared).toBeUndefined();
    expect(useStoreStore.getState().unsettledPurchases).toHaveLength(0);
  });
});

describe("hydration gate", () => {
  it("executePaidShopPurchase is a no-op before stores have hydrated", () => {
    const storeHydrated = jest
      .spyOn(useStoreStore.persist, "hasHydrated")
      .mockReturnValue(false);

    expect(executePaidShopPurchase(plant)).toBe(false);
    expect(useStoreStore.getState().owned[plant.id]).toBeUndefined();
    expect(usePlayerStore.getState().spentPoints).toBe(0);

    storeHydrated.mockRestore();
  });
});
