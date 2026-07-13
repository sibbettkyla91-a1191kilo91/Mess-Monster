/**
 * v1 → v2 store migration: toys bought under the old consume-on-purchase
 * behavior (owned entry at quantity 0) are restored to quantity 1, and
 * their persisted item snapshot — which has repeatable: true frozen in —
 * is refreshed from the catalog so the Collection filter accepts them.
 * Food entries are untouched: quantity 0 there means correctly consumed.
 */
import { STORE_ITEMS } from "@/store/store-items";
import { migrateStoreState } from "@/store/use-store-store";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

const catalogYarn = STORE_ITEMS.find((i) => i.id === "toy-yarn")!;

/** An owned entry as persisted under the old catalog (toys repeatable). */
function legacyEntry(id: string, quantity: number) {
  const item = STORE_ITEMS.find((i) => i.id === id)!;
  const legacyRepeatable = item.category === "toys" ? true : item.repeatable;
  return {
    item: { ...item, repeatable: legacyRepeatable },
    quantity,
    purchasedAt: 1750000000000,
  };
}

describe("migrateStoreState v1 → v2", () => {
  it("bumps a consumed toy entry to quantity 1 and refreshes its snapshot", () => {
    const out = migrateStoreState(
      { owned: { "toy-yarn": legacyEntry("toy-yarn", 0) }, placed: {} },
      1,
    );

    expect(out.owned["toy-yarn"].quantity).toBe(1);
    // Snapshot refreshed from catalog: repeatable is now false, so the
    // Collection screen's !repeatable filter accepts the entry.
    expect(out.owned["toy-yarn"].item).toEqual(catalogYarn);
    // First-purchase timestamp is preserved.
    expect(out.owned["toy-yarn"].purchasedAt).toBe(1750000000000);
  });

  it("does not touch food entries, consumed or not", () => {
    const out = migrateStoreState(
      {
        owned: {
          "food-cookie": legacyEntry("food-cookie", 0),
          "food-boba": legacyEntry("food-boba", 2),
        },
        placed: {},
      },
      1,
    );

    expect(out.owned["food-cookie"].quantity).toBe(0);
    expect(out.owned["food-boba"].quantity).toBe(2);
    expect(out.owned["food-cookie"].item.repeatable).toBe(true);
  });

  it("leaves decor and accessory entries alone", () => {
    const out = migrateStoreState(
      {
        owned: {
          "decor-plant": legacyEntry("decor-plant", 1),
          "acc-bow": legacyEntry("acc-bow", 1),
        },
        placed: { "decor-plant": true },
      },
      1,
    );

    expect(out.owned["decor-plant"].quantity).toBe(1);
    expect(out.owned["acc-bow"].quantity).toBe(1);
    expect(out.placed).toEqual({ "decor-plant": true });
  });

  it("refreshes an unconsumed gifted toy's snapshot without changing quantity", () => {
    const out = migrateStoreState(
      { owned: { "toy-yarn": legacyEntry("toy-yarn", 1) }, placed: {} },
      1,
    );

    expect(out.owned["toy-yarn"].quantity).toBe(1);
    expect(out.owned["toy-yarn"].item.repeatable).toBe(false);
  });

  it("still applies the v0 → v1 placed default alongside the toy bump", () => {
    const out = migrateStoreState(
      { owned: { "toy-yarn": legacyEntry("toy-yarn", 0) } },
      0,
    );

    expect(out.placed).toEqual({});
    expect(out.owned["toy-yarn"].quantity).toBe(1);
  });

  it("is one-time: does not re-run for already-migrated versions", () => {
    // A hypothetical future v2+ state where a toy legitimately sits at
    // quantity 0 must not get a free unit on every load.
    const entry = {
      item: catalogYarn,
      quantity: 0,
      purchasedAt: 1750000000000,
    };
    const out = migrateStoreState(
      { owned: { "toy-yarn": entry }, placed: {} },
      2,
    );

    expect(out.owned["toy-yarn"].quantity).toBe(0);
  });
});
