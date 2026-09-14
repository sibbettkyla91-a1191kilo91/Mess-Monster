/**
 * End-to-end simulation of the decor purchase flow at the state layer:
 * Store screen buys → Collection screen lists → place toggle → DecorLayer
 * renders. Mirrors the exact reads each screen performs.
 */
import { getDecorSlot } from "@/store/decor-slots";
import { STORE_ITEMS } from "@/store/store-items";
import { useStoreStore } from "@/store/use-store-store";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
  useStoreStore.setState({ owned: {}, placed: {} });
});

const decorItem = STORE_ITEMS.find((i) => i.id === "nilly-plant-sunflower")!;

describe("decor purchase → collection → placement flow", () => {
  it("a bought decor item appears in the Collection screen's list", () => {
    // Store screen: handleBuy → buyItem(item)
    expect(useStoreStore.getState().buyItem(decorItem)).toBe(true);

    // Collection screen read: owned → quantity > 0 → !repeatable
    const { owned } = useStoreStore.getState();
    const collectionItems = Object.values(owned)
      .filter((e) => e.quantity > 0)
      .filter((e) => !e.item.repeatable);

    expect(collectionItems).toHaveLength(1);
    expect(collectionItems[0].item.id).toBe("nilly-plant-sunflower");
  });

  it("the bought item is immediately placeable and DecorLayer sees it", () => {
    useStoreStore.getState().buyItem(decorItem);

    // Collection screen: togglePlaced on tap
    useStoreStore.getState().togglePlaced(decorItem.id);
    expect(useStoreStore.getState().isPlaced(decorItem.id)).toBe(true);

    // DecorLayer read: placed ids still owned, resolved to a slot
    const { owned, placed } = useStoreStore.getState();
    const placedIds = Object.keys(placed).filter(
      (id) => (owned[id]?.quantity ?? 0) > 0,
    );
    expect(placedIds).toEqual(["nilly-plant-sunflower"]);
    expect(getDecorSlot("nilly-plant-sunflower", "luna")).not.toBeNull();
    expect(getDecorSlot("nilly-plant-sunflower", "nilly")).not.toBeNull();

    // Toggle back off
    useStoreStore.getState().togglePlaced(decorItem.id);
    expect(useStoreStore.getState().isPlaced(decorItem.id)).toBe(false);
  });

  it("every decor item in the catalog has a placement slot", () => {
    const decorIds = STORE_ITEMS.filter((i) => i.category === "decor").map(
      (i) => i.id,
    );
    for (const id of decorIds) {
      expect(getDecorSlot(id, "nilly")).not.toBeNull();
    }
  });

  it("every decor item in the catalog is non-repeatable (Collection filter)", () => {
    const decor = STORE_ITEMS.filter((i) => i.category === "decor");
    for (const item of decor) {
      expect(item.repeatable).toBe(false);
    }
  });
});
