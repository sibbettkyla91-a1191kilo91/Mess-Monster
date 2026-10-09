/**
 * The 32-item catalog is locked: ids are persisted in saves, so a rename or
 * substitution here is a data-loss bug, not a copy tweak. These tests pin
 * the id list as literal strings and the shape every renderer relies on.
 */
import {
  ACCESSORY_DEFS,
  isAccessorySlotLocked,
} from "@/store/accessory-config";
import { getDecorSlot } from "@/store/decor-slots";
import { getItemArt, ITEM_ART } from "@/store/item-art";
import { MONSTER_IDS, MonsterId } from "@/store/monster-id";
import {
  getItemType,
  getStoreItem,
  isLegacyItemSnapshot,
  isPlaceableType,
  itemsForMonster,
  resolveUsableItem,
  STORE_CATEGORIES,
  STORE_ITEMS,
  StoreCategory,
  StoreItemType,
} from "@/store/store-items";

const NILLY_IDS = [
  "nilly-plant-sunflower",
  "nilly-plant-pothos",
  "nilly-plant-wildflower-bouquet",
  "nilly-plant-succulent-trio",
  "nilly-food-granola-honey-bar",
  "nilly-food-herbal-sun-tea",
  "nilly-food-mushroom-chips",
  "nilly-food-fresh-berries",
  "nilly-toy-tie-dye-yarn-ball",
  "nilly-toy-mushroom-plushie",
  "nilly-accessory-friendship-bracelet",
  "nilly-accessory-daisy-chain-crown",
  "nilly-decor-macrame-wall-hanging",
  "nilly-decor-woven-rug",
  "nilly-decor-tie-dye-tapestry",
  "nilly-decor-mushroom-lamp",
];

const LUNA_IDS = [
  "luna-plant-black-rose",
  "luna-plant-trailing-ivy",
  "luna-plant-venus-flytrap",
  "luna-plant-nightshade-sprig",
  "luna-food-dark-chocolate-truffle",
  "luna-food-elderberry-tonic",
  "luna-food-blackberry-preserve",
  "luna-food-spiced-mulled-cider",
  "luna-toy-raven-feather",
  "luna-toy-tarot-deck-charm",
  "luna-accessory-spiderweb-choker",
  "luna-accessory-crystal-ball-charm",
  "luna-decor-candle-cluster",
  "luna-decor-potion-bottle-set",
  "luna-decor-tarot-card-display",
  "luna-decor-spiderweb-curtain",
];

const NAMES: Record<string, string> = {
  "nilly-plant-sunflower": "Sunflower in a Clay Pot",
  "nilly-plant-pothos": "Trailing Pothos",
  "nilly-plant-wildflower-bouquet": "Wildflower Bouquet",
  "nilly-plant-succulent-trio": "Baby Succulent Trio",
  "nilly-food-granola-honey-bar": "Granola & Honey Bar",
  "nilly-food-herbal-sun-tea": "Herbal Sun Tea",
  "nilly-food-mushroom-chips": "Dried Mushroom Chips",
  "nilly-food-fresh-berries": "Fresh Berries",
  "nilly-toy-tie-dye-yarn-ball": "Tie-Dye Yarn Ball",
  "nilly-toy-mushroom-plushie": "Mushroom Plushie",
  "nilly-accessory-friendship-bracelet": "Woven Friendship Bracelet",
  "nilly-accessory-daisy-chain-crown": "Daisy Chain Crown",
  "nilly-decor-macrame-wall-hanging": "Macrame Wall Hanging",
  "nilly-decor-woven-rug": "Woven Rug",
  "nilly-decor-tie-dye-tapestry": "Tie-Dye Tapestry",
  "nilly-decor-mushroom-lamp": "Mushroom Lamp",
  "luna-plant-black-rose": "Black Rose",
  "luna-plant-trailing-ivy": "Trailing Ivy",
  "luna-plant-venus-flytrap": "Venus Flytrap",
  "luna-plant-nightshade-sprig": "Nightshade Sprig",
  "luna-food-dark-chocolate-truffle": "Dark Chocolate Truffle",
  "luna-food-elderberry-tonic": "Elderberry Tonic",
  "luna-food-blackberry-preserve": "Blackberry Preserve",
  "luna-food-spiced-mulled-cider": "Spiced Mulled Cider",
  "luna-toy-raven-feather": "Raven Feather",
  "luna-toy-tarot-deck-charm": "Tarot Deck Charm",
  "luna-accessory-spiderweb-choker": "Spiderweb Choker",
  "luna-accessory-crystal-ball-charm": "Crystal Ball Charm",
  "luna-decor-candle-cluster": "Candle Cluster",
  "luna-decor-potion-bottle-set": "Potion Bottle Set",
  "luna-decor-tarot-card-display": "Tarot Card Display",
  "luna-decor-spiderweb-curtain": "Spiderweb Curtain",
};

const CATEGORY_OF: Record<StoreItemType, StoreCategory> = {
  plant: "plants",
  food: "food",
  toy: "toys",
  accessory: "toys",
  decor: "decor",
};

describe("catalog shape", () => {
  it("has exactly 32 items, each id once", () => {
    expect(STORE_ITEMS).toHaveLength(32);
    expect(new Set(STORE_ITEMS.map((i) => i.id)).size).toBe(32);
  });

  it("ids are exactly the locked list (a rename fails here)", () => {
    expect(STORE_ITEMS.map((i) => i.id).sort()).toEqual(
      [...NILLY_IDS, ...LUNA_IDS].sort(),
    );
  });

  it("display names are the locked 32", () => {
    for (const item of STORE_ITEMS) {
      expect(item.name).toBe(NAMES[item.id]);
    }
  });

  it("16 Nilly items, all tagged nilly and prefixed nilly-", () => {
    const nilly = itemsForMonster("nilly");
    expect(nilly).toHaveLength(16);
    expect(nilly.map((i) => i.id).sort()).toEqual([...NILLY_IDS].sort());
    for (const i of nilly) {
      expect(i.monster).toBe("nilly");
      expect(i.id.startsWith("nilly-")).toBe(true);
    }
  });

  it("16 Luna items, all tagged luna and prefixed luna-", () => {
    const luna = itemsForMonster("luna");
    expect(luna).toHaveLength(16);
    expect(luna.map((i) => i.id).sort()).toEqual([...LUNA_IDS].sort());
    for (const i of luna) {
      expect(i.monster).toBe("luna");
      expect(i.id.startsWith("luna-")).toBe(true);
    }
  });

  it.each(MONSTER_IDS)(
    "%s has 4 plants, 4 food, 4 toys/accessories, 4 decor",
    (m) => {
      const byCategory: Record<StoreCategory, number> = {
        plants: 0,
        food: 0,
        toys: 0,
        decor: 0,
      };
      for (const i of itemsForMonster(m)) byCategory[i.category] += 1;
      expect(byCategory).toEqual({ plants: 4, food: 4, toys: 4, decor: 4 });
    },
  );

  it("the shop shows the four categories in the shelf order", () => {
    expect(STORE_CATEGORIES.map((c) => c.key)).toEqual([
      "plants",
      "food",
      "toys",
      "decor",
    ]);
  });

  it("category follows item type, and the id encodes the type", () => {
    for (const item of STORE_ITEMS) {
      expect(item.category).toBe(CATEGORY_OF[item.itemType]);
      expect(item.id.split("-")[1]).toBe(item.itemType);
      expect(getItemType(item)).toBe(item.itemType);
    }
  });

  it("food stacks; everything else is a one-time collectible", () => {
    for (const item of STORE_ITEMS) {
      expect(item.repeatable).toBe(item.itemType === "food");
    }
  });

  it("every item has a positive price, a description, an emoji and assetKey = id", () => {
    for (const item of STORE_ITEMS) {
      expect(item.price).toBeGreaterThan(0);
      expect(Number.isInteger(item.price)).toBe(true);
      expect(item.description.trim().length).toBeGreaterThan(0);
      expect(item.emoji.length).toBeGreaterThan(0);
      expect(item.assetKey).toBe(item.id);
      expect(getStoreItem(item.id)).toBe(item);
    }
  });

  it("copy stays adult: no exclamation-mark cheer", () => {
    for (const item of STORE_ITEMS) {
      expect(item.description).not.toMatch(/!/);
    }
  });
});

describe("unlocks", () => {
  it.each(MONSTER_IDS)(
    "%s: at least half the shop is open at level 1 and the welcome gift buys something",
    (m) => {
      const open = itemsForMonster(m).filter((i) => !i.unlock);
      expect(open.length).toBeGreaterThanOrEqual(8);
      expect(open.some((i) => i.price <= 100)).toBe(true);
      // Something from every shelf on day one.
      for (const cat of ["plants", "food", "toys", "decor"] as const) {
        expect(open.some((i) => i.category === cat)).toBe(true);
      }
    },
  );

  it("locked items state a level of at least 2", () => {
    for (const item of STORE_ITEMS) {
      if (item.unlock) expect(item.unlock.level).toBeGreaterThanOrEqual(2);
    }
  });

  // The schedule is pinned literally: which items are open on day one is a
  // product promise, and the gated ones open two at a time at 2/4/6/8.
  const UNLOCK_SCHEDULE: Record<MonsterId, Record<string, number | null>> = {
    nilly: {
      "nilly-plant-sunflower": null,
      "nilly-plant-pothos": null,
      "nilly-plant-wildflower-bouquet": 4,
      "nilly-plant-succulent-trio": 8,
      "nilly-food-granola-honey-bar": null,
      "nilly-food-herbal-sun-tea": null,
      "nilly-food-mushroom-chips": 2,
      "nilly-food-fresh-berries": 6,
      "nilly-toy-tie-dye-yarn-ball": null,
      "nilly-toy-mushroom-plushie": null,
      "nilly-accessory-friendship-bracelet": 2,
      "nilly-accessory-daisy-chain-crown": 6,
      "nilly-decor-macrame-wall-hanging": null,
      "nilly-decor-woven-rug": null,
      "nilly-decor-tie-dye-tapestry": 4,
      "nilly-decor-mushroom-lamp": 8,
    },
    luna: {
      "luna-plant-black-rose": null,
      "luna-plant-trailing-ivy": null,
      "luna-plant-venus-flytrap": 4,
      "luna-plant-nightshade-sprig": 8,
      "luna-food-dark-chocolate-truffle": null,
      "luna-food-elderberry-tonic": null,
      "luna-food-blackberry-preserve": 2,
      "luna-food-spiced-mulled-cider": 6,
      "luna-toy-raven-feather": null,
      "luna-toy-tarot-deck-charm": null,
      "luna-accessory-spiderweb-choker": 2,
      "luna-accessory-crystal-ball-charm": 6,
      "luna-decor-candle-cluster": null,
      "luna-decor-potion-bottle-set": null,
      "luna-decor-tarot-card-display": 4,
      "luna-decor-spiderweb-curtain": 8,
    },
  };

  it.each(MONSTER_IDS)(
    "%s: unlock level of every item is the pinned one",
    (m) => {
      const items = itemsForMonster(m);
      expect(items).toHaveLength(16);
      for (const item of items) {
        expect(UNLOCK_SCHEDULE[m]).toHaveProperty(item.id);
        expect(item.unlock?.level ?? null).toBe(UNLOCK_SCHEDULE[m][item.id]);
      }
    },
  );

  it.each(MONSTER_IDS)(
    "%s: exactly 8 items open at level 1, then 2 each at levels 2, 4, 6 and 8",
    (m) => {
      const items = itemsForMonster(m);
      const open = items.filter((i) => !i.unlock).map((i) => i.id);
      expect(open.sort()).toEqual(
        Object.keys(UNLOCK_SCHEDULE[m])
          .filter((id) => UNLOCK_SCHEDULE[m][id] === null)
          .sort(),
      );
      expect(open).toHaveLength(8);

      const perLevel: Record<number, number> = {};
      for (const i of items) {
        if (i.unlock)
          perLevel[i.unlock.level] = (perLevel[i.unlock.level] ?? 0) + 1;
      }
      expect(perLevel).toEqual({ 2: 2, 4: 2, 6: 2, 8: 2 });
    },
  );

  it("across both shops, 16 items are open at level 1 and 4 open at each of 2, 4, 6, 8", () => {
    expect(STORE_ITEMS.filter((i) => !i.unlock)).toHaveLength(16);
    const perLevel: Record<number, number> = {};
    for (const i of STORE_ITEMS) {
      if (i.unlock)
        perLevel[i.unlock.level] = (perLevel[i.unlock.level] ?? 0) + 1;
    }
    expect(perLevel).toEqual({ 2: 4, 4: 4, 6: 4, 8: 4 });
  });

  it("Nilly and Luna open the same shelves at the same levels", () => {
    const nilly = itemsForMonster("nilly");
    const luna = itemsForMonster("luna");
    for (let i = 0; i < 16; i++) {
      expect(luna[i].category).toBe(nilly[i].category);
      expect(luna[i].unlock?.level ?? null).toBe(
        nilly[i].unlock?.level ?? null,
      );
    }
  });

  it("within each pair of tiers the cheaper item opens earlier", () => {
    for (const m of MONSTER_IDS) {
      const gated = itemsForMonster(m).filter((i) => i.unlock);
      const pricesAt = (level: number) =>
        gated.filter((i) => i.unlock!.level === level).map((i) => i.price);
      // Every level-2 item is cheaper than every level-4 item; same for 6 vs 8.
      expect(Math.max(...pricesAt(2))).toBeLessThan(Math.min(...pricesAt(4)));
      expect(Math.max(...pricesAt(6))).toBeLessThan(Math.min(...pricesAt(8)));
    }
  });
});

describe("wiring into slots and rooms", () => {
  it("every accessory has a slot def that its own monster can wear", () => {
    for (const item of STORE_ITEMS.filter((i) => i.itemType === "accessory")) {
      const def = ACCESSORY_DEFS[item.id];
      expect(def).toBeDefined();
      expect(def.id).toBe(item.id);
      expect(isAccessorySlotLocked(item.monster, def.slot)).toBe(false);
    }
  });

  it("every plant, decor and toy has a room slot for its monster", () => {
    for (const item of STORE_ITEMS) {
      if (!isPlaceableType(item.itemType)) {
        expect(item.itemType === "food" || item.itemType === "accessory").toBe(
          true,
        );
        continue;
      }
      const slot = getDecorSlot(item.id, item.monster);
      expect(slot).not.toBeNull();
      expect(slot!.x).toBeGreaterThan(0);
      expect(slot!.x).toBeLessThan(1);
      expect(slot!.y).toBeGreaterThan(0);
      expect(slot!.y).toBeLessThan(1);
      expect(slot!.size).toBeGreaterThan(0);
    }
  });

  it("food and accessories are not placeable", () => {
    expect(isPlaceableType("food")).toBe(false);
    expect(isPlaceableType("accessory")).toBe(false);
    expect(isPlaceableType("plant")).toBe(true);
    expect(isPlaceableType("decor")).toBe(true);
    expect(isPlaceableType("toy")).toBe(true);
  });
});

describe("item art registry", () => {
  it("Nilly's sixteen pieces have art; Luna still falls back to the emoji", () => {
    expect(Object.keys(ITEM_ART).sort()).toEqual([...NILLY_IDS].sort());
    for (const id of NILLY_IDS) {
      expect(getItemArt(id)).toBeDefined();
    }
    for (const id of LUNA_IDS) {
      expect(getItemArt(id)).toBeUndefined();
    }
    expect(getItemArt(undefined)).toBeUndefined();
    expect(getItemArt("not-a-real-item")).toBeUndefined();
  });
});

describe("legacy snapshots", () => {
  it("maps retired categories to item types", () => {
    expect(getItemType({ category: "food" })).toBe("food");
    expect(getItemType({ category: "toys" })).toBe("toy");
    expect(getItemType({ category: "accessories" })).toBe("accessory");
    expect(getItemType({ category: "decor" })).toBe("decor");
    expect(getItemType({ category: "plants" })).toBe("plant");
  });

  it("recognises a retired-catalog snapshot and trusts it for use", () => {
    const legacy = {
      id: "food-cookie",
      name: "Cookie",
      emoji: "🍪",
      category: "food",
      description: "",
      price: 15,
      repeatable: true,
    } as unknown as import("@/store/store-items").StoreItem;
    expect(isLegacyItemSnapshot(legacy)).toBe(true);
    expect(resolveUsableItem("food-cookie", legacy)).toBe(legacy);
  });

  it("refuses a current-shape snapshot whose id is not in the catalog", () => {
    const phantom = {
      ...getStoreItem("nilly-food-granola-honey-bar")!,
      id: "nilly-food-phantom",
    };
    expect(isLegacyItemSnapshot(phantom)).toBe(false);
    expect(resolveUsableItem("nilly-food-phantom", phantom)).toBeUndefined();
    expect(resolveUsableItem("nilly-food-phantom", undefined)).toBeUndefined();
  });

  it("prefers the live catalog entry when the id is still sold", () => {
    const stale = {
      ...getStoreItem("nilly-food-granola-honey-bar")!,
      name: "Old name",
    };
    expect(resolveUsableItem("nilly-food-granola-honey-bar", stale)).toBe(
      getStoreItem("nilly-food-granola-honey-bar"),
    );
  });
});
