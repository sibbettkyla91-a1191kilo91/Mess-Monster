import type { StoreItem } from "@/store/store-items";

/**
 * Items from the retired (pre-32-item) catalog, exactly as an old save would
 * have snapshotted them: no `monster`, no `itemType`, no `assetKey`, the old
 * category names ("toys", "accessories"), and a `moodBoost` field the app no
 * longer reads. Tests use these to prove legacy saves stay readable — they
 * are not sold anymore and must not be added back to STORE_ITEMS.
 */
export type LegacyStoreItem = {
  id: string;
  name: string;
  emoji: string;
  category: "food" | "toys" | "accessories" | "decor";
  description: string;
  price: number;
  moodBoost: number;
  repeatable: boolean;
};

export const LEGACY_ITEMS: Record<string, LegacyStoreItem> = {
  "food-cookie": {
    id: "food-cookie",
    name: "Cookie",
    emoji: "🍪",
    category: "food",
    description: "Sweet and crunchy — a monster fave!",
    price: 15,
    moodBoost: 3,
    repeatable: true,
  },
  "food-boba": {
    id: "food-boba",
    name: "Boba Tea",
    emoji: "🧋",
    category: "food",
    description: "Chewy tapioca pearls in sweet milk tea.",
    price: 25,
    moodBoost: 4,
    repeatable: true,
  },
  "toy-yarn": {
    id: "toy-yarn",
    name: "Yarn Ball",
    emoji: "🧶",
    category: "toys",
    description: "Tangled fun for hours.",
    price: 25,
    moodBoost: 4,
    repeatable: false,
  },
  "toy-ball": {
    id: "toy-ball",
    name: "Bouncy Ball",
    emoji: "🏐",
    category: "toys",
    description: "Bounce, bounce, bounce!",
    price: 20,
    moodBoost: 3,
    repeatable: false,
  },
  "acc-bow": {
    id: "acc-bow",
    name: "Cute Bow",
    emoji: "🎀",
    category: "accessories",
    description: "A dainty bow for a dapper monster.",
    price: 60,
    moodBoost: 0,
    repeatable: false,
  },
  "acc-crown": {
    id: "acc-crown",
    name: "Mini Crown",
    emoji: "👑",
    category: "accessories",
    description: "Royalty status unlocked.",
    price: 100,
    moodBoost: 0,
    repeatable: false,
  },
  "acc-sunglasses": {
    id: "acc-sunglasses",
    name: "Star Shades",
    emoji: "🕶️",
    category: "accessories",
    description: "Too cool for chores.",
    price: 80,
    moodBoost: 0,
    repeatable: false,
  },
  "acc-scarf": {
    id: "acc-scarf",
    name: "Cozy Scarf",
    emoji: "🧣",
    category: "accessories",
    description: "Warm and snug.",
    price: 70,
    moodBoost: 0,
    repeatable: false,
  },
  "decor-plant": {
    id: "decor-plant",
    name: "Potted Plant",
    emoji: "🪴",
    category: "decor",
    description: "A little green for the room.",
    price: 40,
    moodBoost: 0,
    repeatable: false,
  },
  "decor-aquarium": {
    id: "decor-aquarium",
    name: "Mini Aquarium",
    emoji: "🐠",
    category: "decor",
    description: "Tiny fish, big calm.",
    price: 150,
    moodBoost: 0,
    repeatable: false,
  },
};

/** A retired item in the shape store actions accept. */
export function legacyItem(id: string): StoreItem {
  const item = LEGACY_ITEMS[id];
  if (!item) throw new Error(`No legacy fixture for ${id}`);
  return item as unknown as StoreItem;
}
