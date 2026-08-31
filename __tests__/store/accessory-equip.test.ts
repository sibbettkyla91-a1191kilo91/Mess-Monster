import {
  isAccessorySlotLocked,
  LUNA_HEAD_SLOT_LOCKED,
} from "@/store/accessory-config";
import { STORE_ITEMS } from "@/store/store-items";
import { migrateStoreState, useStoreStore } from "@/store/use-store-store";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

const bow = STORE_ITEMS.find((i) => i.id === "acc-bow")!;
const crown = STORE_ITEMS.find((i) => i.id === "acc-crown")!;
const shades = STORE_ITEMS.find((i) => i.id === "acc-sunglasses")!;
const scarf = STORE_ITEMS.find((i) => i.id === "acc-scarf")!;

beforeEach(() => {
  useStoreStore.setState({ owned: {}, placed: {}, equipped: {} });
});

describe("equip / unequip", () => {
  it("wears an owned accessory on its slot", () => {
    useStoreStore.getState().buyItem(bow);
    expect(useStoreStore.getState().equipAccessory("acc-bow", "nilly")).toBe(
      true,
    );
    expect(useStoreStore.getState().equipped.head).toBe("acc-bow");
  });

  it("replaces another item in the same slot", () => {
    useStoreStore.getState().buyItem(bow);
    useStoreStore.getState().buyItem(crown);
    useStoreStore.getState().equipAccessory("acc-bow", "nilly");
    useStoreStore.getState().equipAccessory("acc-crown", "nilly");
    expect(useStoreStore.getState().equipped.head).toBe("acc-crown");
    expect(useStoreStore.getState().equipped.face).toBeUndefined();
  });

  it("allows one item per slot at the same time", () => {
    useStoreStore.getState().buyItem(bow);
    useStoreStore.getState().buyItem(shades);
    useStoreStore.getState().buyItem(scarf);
    useStoreStore.getState().equipAccessory("acc-bow", "nilly");
    useStoreStore.getState().equipAccessory("acc-sunglasses", "nilly");
    useStoreStore.getState().equipAccessory("acc-scarf", "nilly");
    expect(useStoreStore.getState().equipped).toEqual({
      head: "acc-bow",
      face: "acc-sunglasses",
      neck: "acc-scarf",
    });
  });

  it("refuses items that are not owned", () => {
    expect(useStoreStore.getState().equipAccessory("acc-bow", "nilly")).toBe(
      false,
    );
    expect(useStoreStore.getState().equipped.head).toBeUndefined();
  });

  it("unequips a slot", () => {
    useStoreStore.getState().buyItem(bow);
    useStoreStore.getState().equipAccessory("acc-bow", "nilly");
    useStoreStore.getState().unequipSlot("head");
    expect(useStoreStore.getState().equipped.head).toBeUndefined();
  });

  it("blocks Luna head items while the temporary lock is on", () => {
    expect(isAccessorySlotLocked("luna", "head")).toBe(LUNA_HEAD_SLOT_LOCKED);
    expect(isAccessorySlotLocked("nilly", "head")).toBe(false);
    expect(isAccessorySlotLocked("luna", "face")).toBe(false);

    useStoreStore.getState().buyItem(bow);
    const ok = useStoreStore.getState().equipAccessory("acc-bow", "luna");
    expect(ok).toBe(!LUNA_HEAD_SLOT_LOCKED);
    if (LUNA_HEAD_SLOT_LOCKED) {
      expect(useStoreStore.getState().equipped.head).toBeUndefined();
    }
  });
});

describe("migrateStoreState equipped", () => {
  it("adds an empty equipped map to older saves", () => {
    const out = migrateStoreState({ owned: {}, placed: {} }, 2);
    expect(out.equipped).toEqual({});
  });
});
