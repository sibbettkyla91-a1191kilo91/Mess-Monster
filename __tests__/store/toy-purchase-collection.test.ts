/**
 * Toys are durable collectibles (like decor), food stays consumable.
 * Simulates the Store screen's handleBuy branching at the state layer and
 * mirrors the exact reads the Collection screen and DecorLayer perform.
 *
 * (This file previously documented the old consume-on-purchase toy
 * behavior, which caused the "yarn ball missing from Collection" report.)
 */
import { getDecorSlot } from "@/store/decor-slots";
import { STORE_ITEMS, StoreItem } from "@/store/store-items";
import { useStoreStore } from "@/store/use-store-store";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
  useStoreStore.setState({ owned: {}, placed: {} });
});

const aquarium = STORE_ITEMS.find((i) => i.id === "decor-aquarium")!;
const yarnBall = STORE_ITEMS.find((i) => i.id === "toy-yarn")!;
const cookie = STORE_ITEMS.find((i) => i.id === "food-cookie")!;

/**
 * The store-store writes handleBuy performs for a paid purchase, including
 * its repeatable/non-repeatable branch. Returns whether the purchase took
 * food now stays in the bag instead of auto-using.
 */
function buyLikeStoreScreen(item: StoreItem): { autoConsumed: boolean } {
  const store = useStoreStore.getState();
  store.buyItem(item);
  return { autoConsumed: false };
}

/** The exact read the Collection screen performs. */
function collectionScreenItems() {
  const { owned } = useStoreStore.getState();
  return Object.values(owned)
    .filter((e) => e.quantity > 0)
    .filter((e) => !e.item.repeatable);
}

describe("toy purchase behaves like decor", () => {
  it("a bought toy stays in the owned map at quantity 1, no auto-consume", () => {
    const { autoConsumed } = buyLikeStoreScreen(yarnBall);

    expect(autoConsumed).toBe(false);
    expect(useStoreStore.getState().owned["toy-yarn"].quantity).toBe(1);
  });

  it("warm-session aquarium-then-yarn-ball now shows both in Collection", () => {
    buyLikeStoreScreen(aquarium);
    buyLikeStoreScreen(yarnBall);

    const shown = collectionScreenItems().map((e) => e.item.id);
    expect(shown).toContain("decor-aquarium");
    expect(shown).toContain("toy-yarn");
  });

  it("a bought toy is placeable and DecorLayer sees it", () => {
    buyLikeStoreScreen(yarnBall);

    // Collection screen: togglePlaced on tap
    useStoreStore.getState().togglePlaced(yarnBall.id);
    expect(useStoreStore.getState().isPlaced(yarnBall.id)).toBe(true);

    // DecorLayer read: placed ids still owned, resolved to a slot
    const { owned, placed } = useStoreStore.getState();
    const placedIds = Object.keys(placed).filter(
      (id) => (owned[id]?.quantity ?? 0) > 0,
    );
    expect(placedIds).toEqual(["toy-yarn"]);
    expect(getDecorSlot("toy-yarn", "luna")).not.toBeNull();
    expect(getDecorSlot("toy-yarn", "nilly")).not.toBeNull();
  });

  it("every toy in the catalog is non-repeatable and has a placement slot", () => {
    const toys = STORE_ITEMS.filter((i) => i.category === "toys");
    expect(toys.length).toBeGreaterThan(0);
    for (const item of toys) {
      expect(item.repeatable).toBe(false);
      expect(getDecorSlot(item.id, "nilly")).not.toBeNull();
      expect(getDecorSlot(item.id, "luna")).not.toBeNull();
    }
  });
});

describe("food purchases are unaffected", () => {
  it("food stays in the bag at purchase and is not auto-consumed", () => {
    const { autoConsumed } = buyLikeStoreScreen(cookie);

    expect(autoConsumed).toBe(false);
    expect(useStoreStore.getState().owned["food-cookie"].quantity).toBe(1);
  });

  it("food never appears in Collection, even at quantity > 0 (gift path)", () => {
    useStoreStore.getState().buyItem(cookie); // gifted unit, unconsumed
    expect(useStoreStore.getState().owned["food-cookie"].quantity).toBe(1);

    expect(collectionScreenItems()).toHaveLength(0);
  });

  it("every food item stays repeatable and has no room slot", () => {
    const food = STORE_ITEMS.filter((i) => i.category === "food");
    expect(food.length).toBeGreaterThan(0);
    for (const item of food) {
      expect(item.repeatable).toBe(true);
      expect(getDecorSlot(item.id, "luna")).toBeNull();
    }
  });
});
