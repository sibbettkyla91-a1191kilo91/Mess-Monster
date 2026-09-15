/**
 * Points Store — the locked 32-item catalog and its types.
 *
 * One shared shop system, monster-specific data: each item belongs to
 * exactly one monster and reads in that monster's voice (Nilly earthy and
 * warm, Luna witchy and dry). Sixteen items per monster, four per category.
 *
 * IDS ARE STABLE. Pattern: `${monster}-${itemType}-${slug}`. Saves store
 * these ids, so renaming one strands what players own. A test snapshots
 * the full id list so a rename fails loudly.
 *
 * Art: every item has an `assetKey` (currently equal to its id). Renderers
 * ask `getItemArt(assetKey)` in store/item-art.ts and fall back to `emoji`
 * while that registry is empty. Dropping in final art = one line per key
 * there; nothing here changes.
 */

import type { MonsterId } from "./monster-id";

/** Shop tab. "toys" is the combined Toys & Accessories shelf. */
export type StoreCategory = "plants" | "food" | "toys" | "decor";

/**
 * What the item DOES. Category is where it is shelved; itemType is how the
 * rest of the app treats it:
 *  - food      → consumable, lives in the monster's food bag, eaten via Feed
 *  - toy       → kept forever, used via Play, may sit in the room
 *  - accessory → kept forever, worn via an accessory slot (Collection)
 *  - plant     → kept forever, placed in the room (Collection)
 *  - decor     → kept forever, placed in the room (Collection)
 */
export type StoreItemType = "food" | "toy" | "accessory" | "plant" | "decor";

export const STORE_ITEM_TYPES: readonly StoreItemType[] = [
  "food",
  "toy",
  "accessory",
  "plant",
  "decor",
];

export interface StoreItem {
  id: string;
  /** Which monster's shop sells it and whose bag it belongs in. */
  monster: MonsterId;
  name: string;
  emoji: string;
  category: StoreCategory;
  itemType: StoreItemType;
  description: string;
  price: number;
  /** Key into store/item-art.ts. Stable; equals the id today. */
  assetKey: string;
  /** True for consumables that stack (food). False = one-time collectible. */
  repeatable: boolean;
  /** Progression gate. Absent = available from level 1. */
  unlock?: { level: number };
}

export const STORE_CATEGORIES: {
  key: StoreCategory;
  label: string;
  emoji: string;
}[] = [
  { key: "plants", label: "Plants", emoji: "🌱" },
  { key: "food", label: "Food", emoji: "🍽️" },
  { key: "toys", label: "Toys", emoji: "🧸" },
  { key: "decor", label: "Decor", emoji: "🏠" },
];

/**
 * Unlock tiers. Two items per category open at level 1 (so the 100-point
 * welcome gift buys something on day one); the other eight items per
 * monster open two at a time at levels 2, 4, 6 and 8. Cheaper shelves
 * (food, toys/accessories) open first within each pair of tiers; plants
 * and decor follow. Nilly and Luna share the schedule shelf-for-shelf.
 * See store/progression.ts for the level thresholds.
 */
const TIER_2 = { level: 2 } as const;
const TIER_3 = { level: 4 } as const;
const TIER_4 = { level: 6 } as const;
const TIER_5 = { level: 8 } as const;

type ItemSpec = Omit<StoreItem, "assetKey" | "repeatable" | "category"> & {
  repeatable?: boolean;
};

function item(spec: ItemSpec): StoreItem {
  const category: StoreCategory =
    spec.itemType === "food"
      ? "food"
      : spec.itemType === "plant"
        ? "plants"
        : spec.itemType === "decor"
          ? "decor"
          : "toys";
  return {
    ...spec,
    category,
    assetKey: spec.id,
    repeatable: spec.repeatable ?? spec.itemType === "food",
  };
}

const NILLY_ITEMS: StoreItem[] = [
  // ─── Plants ────────────────────────────────────────────────────────────
  item({
    id: "nilly-plant-sunflower",
    monster: "nilly",
    name: "Sunflower in a Clay Pot",
    emoji: "🌻",
    itemType: "plant",
    description: "Turns to face whoever walks in. Mostly you.",
    price: 45,
  }),
  item({
    id: "nilly-plant-pothos",
    monster: "nilly",
    name: "Trailing Pothos",
    emoji: "🌿",
    itemType: "plant",
    description: "Forgiving about water. Generous with leaves.",
    price: 60,
  }),
  item({
    id: "nilly-plant-wildflower-bouquet",
    monster: "nilly",
    name: "Wildflower Bouquet",
    emoji: "💐",
    itemType: "plant",
    description: "Picked from a meadow that doesn't mind sharing.",
    price: 80,
    unlock: TIER_3,
  }),
  item({
    id: "nilly-plant-succulent-trio",
    monster: "nilly",
    name: "Baby Succulent Trio",
    emoji: "🪴",
    itemType: "plant",
    description: "Three small ones, huddled in one pot. Very brave.",
    price: 110,
    unlock: TIER_5,
  }),

  // ─── Food ──────────────────────────────────────────────────────────────
  item({
    id: "nilly-food-granola-honey-bar",
    monster: "nilly",
    name: "Granola & Honey Bar",
    emoji: "🍯",
    itemType: "food",
    description: "Oats, honey, a little crunch. Trail food for the couch.",
    price: 15,
  }),
  item({
    id: "nilly-food-herbal-sun-tea",
    monster: "nilly",
    name: "Herbal Sun Tea",
    emoji: "🍵",
    itemType: "food",
    description: "Steeped in a jar on the windowsill all afternoon.",
    price: 20,
  }),
  item({
    id: "nilly-food-mushroom-chips",
    monster: "nilly",
    name: "Dried Mushroom Chips",
    emoji: "🍄",
    itemType: "food",
    description: "Earthy, salty, gone too fast.",
    price: 25,
    unlock: TIER_2,
  }),
  item({
    id: "nilly-food-fresh-berries",
    monster: "nilly",
    name: "Fresh Berries",
    emoji: "🫐",
    itemType: "food",
    description: "Still cool from the morning. Stains are part of it.",
    price: 35,
    unlock: TIER_4,
  }),

  // ─── Toys & Accessories ────────────────────────────────────────────────
  item({
    id: "nilly-toy-tie-dye-yarn-ball",
    monster: "nilly",
    name: "Tie-Dye Yarn Ball",
    emoji: "🧶",
    itemType: "toy",
    description: "Every color at once. Rolls in circles, like Nilly.",
    price: 30,
  }),
  item({
    id: "nilly-toy-mushroom-plushie",
    monster: "nilly",
    name: "Mushroom Plushie",
    emoji: "🧸",
    itemType: "toy",
    description: "Soft cap, softer stem. Good for leaning on.",
    price: 50,
  }),
  item({
    id: "nilly-accessory-friendship-bracelet",
    monster: "nilly",
    name: "Woven Friendship Bracelet",
    emoji: "📿",
    itemType: "accessory",
    description: "Knotted by hand. Worn at the neck — no wrists on this one.",
    price: 70,
    unlock: TIER_2,
  }),
  item({
    id: "nilly-accessory-daisy-chain-crown",
    monster: "nilly",
    name: "Daisy Chain Crown",
    emoji: "🌼",
    itemType: "accessory",
    description: "Field royalty. Reign lasts until the petals drop.",
    price: 95,
    unlock: TIER_4,
  }),

  // ─── Room Decor ────────────────────────────────────────────────────────
  item({
    id: "nilly-decor-macrame-wall-hanging",
    monster: "nilly",
    name: "Macrame Wall Hanging",
    emoji: "🪢",
    itemType: "decor",
    description: "Cotton rope, knotted patiently. Sways when the door opens.",
    price: 55,
  }),
  item({
    id: "nilly-decor-woven-rug",
    monster: "nilly",
    name: "Woven Rug",
    emoji: "🟫",
    itemType: "decor",
    description: "Warm underfoot. Collects sunbeams and one small monster.",
    price: 50,
  }),
  item({
    id: "nilly-decor-tie-dye-tapestry",
    monster: "nilly",
    name: "Tie-Dye Tapestry",
    emoji: "🌈",
    itemType: "decor",
    description: "A wall-sized swirl. The room feels bigger with it up.",
    price: 90,
    unlock: TIER_3,
  }),
  item({
    id: "nilly-decor-mushroom-lamp",
    monster: "nilly",
    name: "Mushroom Lamp",
    emoji: "🪔",
    itemType: "decor",
    description: "Low amber glow from under the cap. Evening-shaped light.",
    price: 120,
    unlock: TIER_5,
  }),
];

const LUNA_ITEMS: StoreItem[] = [
  // ─── Plants ────────────────────────────────────────────────────────────
  item({
    id: "luna-plant-black-rose",
    monster: "luna",
    name: "Black Rose",
    emoji: "🥀",
    itemType: "plant",
    description: "Blooms at dusk. Keeps its thorns. Relatable.",
    price: 45,
  }),
  item({
    id: "luna-plant-trailing-ivy",
    monster: "luna",
    name: "Trailing Ivy",
    emoji: "🌿",
    itemType: "plant",
    description: "Climbs whatever stands still long enough.",
    price: 60,
  }),
  item({
    id: "luna-plant-venus-flytrap",
    monster: "luna",
    name: "Venus Flytrap",
    emoji: "🪴",
    itemType: "plant",
    description: "Patient. Hungry. An excellent listener.",
    price: 80,
    unlock: TIER_3,
  }),
  item({
    id: "luna-plant-nightshade-sprig",
    monster: "luna",
    name: "Nightshade Sprig",
    emoji: "🍇",
    itemType: "plant",
    description: "Decorative only. Luna insists. Do not test her.",
    price: 110,
    unlock: TIER_5,
  }),

  // ─── Food ──────────────────────────────────────────────────────────────
  item({
    id: "luna-food-dark-chocolate-truffle",
    monster: "luna",
    name: "Dark Chocolate Truffle",
    emoji: "🍫",
    itemType: "food",
    description: "Bitter edge, soft middle. Eaten in one thoughtful bite.",
    price: 15,
  }),
  item({
    id: "luna-food-elderberry-tonic",
    monster: "luna",
    name: "Elderberry Tonic",
    emoji: "🧪",
    itemType: "food",
    description: "Dark, sharp, faintly medicinal. Exactly as intended.",
    price: 20,
  }),
  item({
    id: "luna-food-blackberry-preserve",
    monster: "luna",
    name: "Blackberry Preserve",
    emoji: "🫙",
    itemType: "food",
    description: "Sealed in late summer. Opened when the mood is right.",
    price: 25,
    unlock: TIER_2,
  }),
  item({
    id: "luna-food-spiced-mulled-cider",
    monster: "luna",
    name: "Spiced Mulled Cider",
    emoji: "☕",
    itemType: "food",
    description: "Clove, star anise, a slow simmer. Steam does the rest.",
    price: 35,
    unlock: TIER_4,
  }),

  // ─── Toys & Accessories ────────────────────────────────────────────────
  item({
    id: "luna-toy-raven-feather",
    monster: "luna",
    name: "Raven Feather",
    emoji: "🪶",
    itemType: "toy",
    description: "Found, not taken. Drifts when batted, which is the point.",
    price: 30,
  }),
  item({
    id: "luna-toy-tarot-deck-charm",
    monster: "luna",
    name: "Tarot Deck Charm",
    emoji: "🃏",
    itemType: "toy",
    description: "Tiny cards, real answers. She only draws the Moon.",
    price: 50,
  }),
  item({
    id: "luna-accessory-spiderweb-choker",
    monster: "luna",
    name: "Spiderweb Choker",
    emoji: "🕸️",
    itemType: "accessory",
    description: "Fine silver thread. The spider approved the design.",
    price: 70,
    unlock: TIER_2,
  }),
  item({
    id: "luna-accessory-crystal-ball-charm",
    monster: "luna",
    name: "Crystal Ball Charm",
    emoji: "🔮",
    itemType: "accessory",
    description: "Worn at the throat. Shows the future, or the ceiling.",
    price: 95,
    unlock: TIER_4,
  }),

  // ─── Room Decor ────────────────────────────────────────────────────────
  item({
    id: "luna-decor-candle-cluster",
    monster: "luna",
    name: "Candle Cluster",
    emoji: "🕯️",
    itemType: "decor",
    description: "Seven candles, no two the same height. Never blown out.",
    price: 55,
  }),
  item({
    id: "luna-decor-potion-bottle-set",
    monster: "luna",
    name: "Potion Bottle Set",
    emoji: "⚗️",
    itemType: "decor",
    description: "Labeled in a hand only she can read. Some glow a little.",
    price: 50,
  }),
  item({
    id: "luna-decor-tarot-card-display",
    monster: "luna",
    name: "Tarot Card Display",
    emoji: "🎴",
    itemType: "decor",
    description: "Three cards, face up, on the wall. Today's reading: fine.",
    price: 90,
    unlock: TIER_3,
  }),
  item({
    id: "luna-decor-spiderweb-curtain",
    monster: "luna",
    name: "Spiderweb Curtain",
    emoji: "🕷️",
    itemType: "decor",
    description: "Lace, technically. Catches moonlight instead of flies.",
    price: 120,
    unlock: TIER_5,
  }),
];

/** Every item, both monsters. Lookups by id go through this list. */
export const STORE_ITEMS: StoreItem[] = [...NILLY_ITEMS, ...LUNA_ITEMS];

const BY_ID: Record<string, StoreItem> = Object.fromEntries(
  STORE_ITEMS.map((i) => [i.id, i]),
);

export function getStoreItem(id: string): StoreItem | undefined {
  return BY_ID[id];
}

/** The sixteen items sold in one monster's shop. */
export function itemsForMonster(monster: MonsterId): StoreItem[] {
  return STORE_ITEMS.filter((i) => i.monster === monster);
}

/**
 * How the app should treat an item, including a persisted snapshot from the
 * retired catalog (ids like `food-cookie`, `toy-yarn`, `acc-bow`,
 * `decor-plant`). Those snapshots have no `itemType`; their old category is
 * enough to tell food from toy from accessory from decor. Legacy items stay
 * readable in the bag and Collection — they are not migrated into new items.
 */
export function getItemType(item: {
  itemType?: unknown;
  category?: unknown;
}): StoreItemType {
  if (
    typeof item.itemType === "string" &&
    (STORE_ITEM_TYPES as readonly string[]).includes(item.itemType)
  ) {
    return item.itemType as StoreItemType;
  }
  switch (item.category) {
    case "food":
      return "food";
    case "toys":
      return "toy";
    case "accessories":
      return "accessory";
    case "plants":
      return "plant";
    default:
      return "decor";
  }
}

/**
 * True for a bag snapshot written under the retired catalog (no `itemType`,
 * no `monster`). Those items are trusted for Feed/Play even though the shop
 * no longer sells them — a player keeps what they paid for. A snapshot in
 * the CURRENT shape whose id is not in the catalog is not legacy; it is
 * unknown data and is refused.
 */
export function isLegacyItemSnapshot(item: {
  itemType?: unknown;
  monster?: unknown;
}): boolean {
  return item.itemType === undefined && item.monster === undefined;
}

/**
 * The item Feed/Play should act on for a bag entry: the live catalog entry
 * when the id is still sold, the snapshot itself when it is a legacy item,
 * otherwise nothing.
 */
export function resolveUsableItem(
  itemId: string,
  snapshot: StoreItem | undefined,
): StoreItem | undefined {
  const catalog = getStoreItem(itemId);
  if (catalog) return catalog;
  if (snapshot && isLegacyItemSnapshot(snapshot)) return snapshot;
  return undefined;
}

/** Plants, decor, and toys can sit in the room; food and accessories cannot. */
export function isPlaceableType(type: StoreItemType): boolean {
  return type === "plant" || type === "decor" || type === "toy";
}
