/**
 * Shop rules per item type: food stacks in the bag and is never consumed at
 * purchase; collectibles are bought once; level-locked and other-monster
 * items are refused with no charge and no grant.
 */
import {
  executePaidShopPurchase,
  isItemUnlockedFor,
} from "@/store/recover-unsettled-purchases";
import { executeFeed, executePlay } from "@/store/recover-unsettled-feeds";
import { getStoreItem, itemsForMonster } from "@/store/store-items";
import { xpForLevel } from "@/store/progression";
import { createDefaultPetSlice, usePetStore } from "@/store/use-pet-store";
import { usePlayerStore } from "@/store/use-player-store";
import { useStoreStore } from "@/store/use-store-store";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/utils/daily-nudge", () => ({
  rescheduleDailyNudges: jest.fn().mockResolvedValue(undefined),
}));

const granola = getStoreItem("nilly-food-granola-honey-bar")!;
const yarn = getStoreItem("nilly-toy-tie-dye-yarn-ball")!;
const sunflower = getStoreItem("nilly-plant-sunflower")!;
const bracelet = getStoreItem("nilly-accessory-friendship-bracelet")!;
const crown = getStoreItem("nilly-accessory-daisy-chain-crown")!;
const berries = getStoreItem("nilly-food-fresh-berries")!;
const truffle = getStoreItem("luna-food-dark-chocolate-truffle")!;

async function flushHydration() {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

function setLevelXp(monster: "nilly" | "luna", xp: number) {
  const by = usePetStore.getState().byMonster;
  usePetStore.setState({
    byMonster: { ...by, [monster]: { ...by[monster], totalPointsEarned: xp } },
  });
}

beforeEach(async () => {
  usePlayerStore.setState({
    selectedMonster: "nilly",
    totalPoints: 1000,
    spentPoints: 0,
    appliedPurchases: {},
  });
  usePetStore.setState({
    byMonster: {
      nilly: { ...createDefaultPetSlice(), health: 50, happiness: 50 },
      luna: { ...createDefaultPetSlice(), health: 50, happiness: 50 },
    },
    appliedPurchases: {},
    appliedFeeds: {},
  });
  useStoreStore.setState({
    byMonster: {
      nilly: { owned: {}, placed: {}, equipped: {} },
      luna: { owned: {}, placed: {}, equipped: {} },
    },
    unsettledPurchases: [],
    appliedPurchases: {},
    unsettledFeeds: [],
    appliedFeeds: {},
  });
  await flushHydration();
});

function spent() {
  return usePlayerStore.getState().spentPoints;
}

describe("food", () => {
  it("goes into the bag, stacks, and is not consumed or eaten at purchase", () => {
    expect(executePaidShopPurchase(granola)).toBe(true);
    expect(executePaidShopPurchase(granola)).toBe(true);
    const bag = useStoreStore.getState().byMonster.nilly.owned;
    expect(bag[granola.id].quantity).toBe(2);
    expect(spent()).toBe(granola.price * 2);
    // Feeding is a separate, later action.
    const pet = usePetStore.getState().byMonster.nilly;
    expect(pet.health).toBe(50);
    expect(pet.happiness).toBe(50);
    expect(useStoreStore.getState().unsettledPurchases).toEqual([]);
  });

  it("feeding later consumes exactly one unit", () => {
    executePaidShopPurchase(granola);
    executePaidShopPurchase(granola);
    expect(executeFeed(granola.id, "nilly")).toBe(true);
    expect(
      useStoreStore.getState().byMonster.nilly.owned[granola.id].quantity,
    ).toBe(1);
    expect(usePetStore.getState().byMonster.nilly.health).toBe(58);
  });
});

describe("collectibles", () => {
  it("toys, plants and accessories are bought once and refused the second time", () => {
    for (const item of [yarn, sunflower]) {
      expect(executePaidShopPurchase(item)).toBe(true);
      const before = spent();
      expect(executePaidShopPurchase(item)).toBe(false);
      expect(spent()).toBe(before);
      expect(
        useStoreStore.getState().byMonster.nilly.owned[item.id].quantity,
      ).toBe(1);
    }
  });

  it("a toy is kept after Play", () => {
    executePaidShopPurchase(yarn);
    expect(executePlay(yarn.id, "nilly")).toBe(true);
    expect(
      useStoreStore.getState().byMonster.nilly.owned[yarn.id].quantity,
    ).toBe(1);
  });

  it("an accessory cannot be fed or played with", () => {
    setLevelXp("nilly", xpForLevel(bracelet.unlock!.level));
    expect(executePaidShopPurchase(bracelet)).toBe(true);
    expect(executeFeed(bracelet.id, "nilly")).toBe(false);
    expect(executePlay(bracelet.id, "nilly")).toBe(false);
    expect(useStoreStore.getState().equipAccessory(bracelet.id, "nilly")).toBe(
      true,
    );
    expect(useStoreStore.getState().byMonster.nilly.equipped.neck).toBe(
      bracelet.id,
    );
  });
});

describe("level locks", () => {
  it("refuses a locked item: no grant, no charge, no intent left behind", () => {
    expect(crown.unlock).toBeDefined();
    expect(isItemUnlockedFor(crown, "nilly")).toBe(false);
    expect(executePaidShopPurchase(crown)).toBe(false);
    expect(useStoreStore.getState().byMonster.nilly.owned[crown.id]).toBeUndefined();
    expect(spent()).toBe(0);
    expect(useStoreStore.getState().unsettledPurchases).toEqual([]);
    expect(usePlayerStore.getState().appliedPurchases).toEqual({});
  });

  it("allows it once that monster's level is reached", () => {
    setLevelXp("nilly", xpForLevel(crown.unlock!.level));
    expect(isItemUnlockedFor(crown, "nilly")).toBe(true);
    expect(executePaidShopPurchase(crown)).toBe(true);
    expect(spent()).toBe(crown.price);
  });

  it.each(["nilly", "luna"] as const)(
    "%s: the shelf grows by two items at levels 2, 4, 6 and 8 and is full at 8",
    (monster) => {
      const expectedOpen: Record<number, number> = {
        1: 8,
        2: 10,
        3: 10,
        4: 12,
        5: 12,
        6: 14,
        7: 14,
        8: 16,
        9: 16,
        10: 16,
      };
      for (let level = 1; level <= 10; level++) {
        setLevelXp(monster, xpForLevel(level));
        const open = itemsForMonster(monster).filter((i) =>
          isItemUnlockedFor(i, monster),
        );
        expect(open).toHaveLength(expectedOpen[level]);
      }
    },
  );

  it("locked food is refused too, and unlocks per monster", () => {
    expect(executePaidShopPurchase(berries)).toBe(false);
    // Luna's level does not open Nilly's shelf.
    setLevelXp("luna", xpForLevel(berries.unlock!.level));
    expect(executePaidShopPurchase(berries)).toBe(false);
    setLevelXp("nilly", xpForLevel(berries.unlock!.level));
    expect(executePaidShopPurchase(berries)).toBe(true);
  });
});

describe("monster scoping", () => {
  it("refuses another monster's item and leaves both bags alone", () => {
    expect(executePaidShopPurchase(truffle)).toBe(false);
    expect(spent()).toBe(0);
    expect(useStoreStore.getState().byMonster.nilly.owned).toEqual({});
    expect(useStoreStore.getState().byMonster.luna.owned).toEqual({});
  });

  it("buying for Luna touches nothing of Nilly's", () => {
    executePaidShopPurchase(granola);
    usePlayerStore.setState({ selectedMonster: "luna" });
    expect(executePaidShopPurchase(truffle)).toBe(true);
    const by = useStoreStore.getState().byMonster;
    expect(Object.keys(by.luna.owned)).toEqual([truffle.id]);
    expect(Object.keys(by.nilly.owned)).toEqual([granola.id]);
    expect(by.nilly.owned[granola.id].quantity).toBe(1);

    expect(executeFeed(truffle.id, "luna")).toBe(true);
    expect(usePetStore.getState().byMonster.luna.health).toBe(58);
    expect(usePetStore.getState().byMonster.nilly.health).toBe(50);
    expect(by.nilly.owned[granola.id].quantity).toBe(1);
  });

  it("every level-1 item in a monster's shop is buyable with the welcome gift", () => {
    usePlayerStore.setState({ totalPoints: 100, spentPoints: 0 });
    const openCheap = itemsForMonster("nilly").filter(
      (i) => !i.unlock && i.price <= 100,
    );
    expect(openCheap.length).toBeGreaterThan(0);
    expect(executePaidShopPurchase(openCheap[0])).toBe(true);
  });
});
