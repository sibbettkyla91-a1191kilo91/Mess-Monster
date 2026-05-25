/**
 * Points Store — Item catalog and types.
 * Categories inspired by Tamagotchi, Habitica, and Neko Atsume.
 */

export type StoreCategory = 'food' | 'toys' | 'accessories' | 'decor';

export interface StoreItem {
  id: string;
  name: string;
  emoji: string;
  category: StoreCategory;
  description: string;
  price: number;
  /** Effect on pet mood when used: hours subtracted from "time since care" calculation */
  moodBoost: number;
  /** Whether this item can be purchased multiple times */
  repeatable: boolean;
}

export const STORE_CATEGORIES: { key: StoreCategory; label: string; emoji: string }[] = [
  { key: 'food', label: 'Food', emoji: '🍽️' },
  { key: 'toys', label: 'Toys', emoji: '🎮' },
  { key: 'accessories', label: 'Accessories', emoji: '🎀' },
  { key: 'decor', label: 'Decor', emoji: '🏠' },
];

export const STORE_ITEMS: StoreItem[] = [
  // ─── Food (repeatable, direct mood boost) ───────────────────────────
  {
    id: 'food-rice-ball',
    name: 'Rice Ball',
    emoji: '🍙',
    category: 'food',
    description: 'A simple, comforting snack.',
    price: 10,
    moodBoost: 2,
    repeatable: true,
  },
  {
    id: 'food-cookie',
    name: 'Cookie',
    emoji: '🍪',
    category: 'food',
    description: 'Sweet and crunchy — a monster fave!',
    price: 15,
    moodBoost: 3,
    repeatable: true,
  },
  {
    id: 'food-boba',
    name: 'Boba Tea',
    emoji: '🧋',
    category: 'food',
    description: 'Chewy tapioca pearls in sweet milk tea.',
    price: 25,
    moodBoost: 4,
    repeatable: true,
  },
  {
    id: 'food-pizza',
    name: 'Pizza Slice',
    emoji: '🍕',
    category: 'food',
    description: 'Gooey cheese and crispy crust.',
    price: 30,
    moodBoost: 5,
    repeatable: true,
  },
  {
    id: 'food-cake',
    name: 'Strawberry Cake',
    emoji: '🍰',
    category: 'food',
    description: 'A luxurious treat for special occasions.',
    price: 50,
    moodBoost: 8,
    repeatable: true,
  },
  {
    id: 'food-ramen',
    name: 'Ramen Bowl',
    emoji: '🍜',
    category: 'food',
    description: 'Warm, filling, and soul-restoring.',
    price: 40,
    moodBoost: 6,
    repeatable: true,
  },

  // ─── Toys (repeatable, moderate mood boost) ─────────────────────────
  {
    id: 'toy-ball',
    name: 'Bouncy Ball',
    emoji: '⚽',
    category: 'toys',
    description: 'Simple fun — bounce it around!',
    price: 20,
    moodBoost: 3,
    repeatable: true,
  },
  {
    id: 'toy-yarn',
    name: 'Yarn Ball',
    emoji: '🧶',
    category: 'toys',
    description: 'Soft and fun to bat around.',
    price: 25,
    moodBoost: 4,
    repeatable: true,
  },
  {
    id: 'toy-kite',
    name: 'Kite',
    emoji: '🪁',
    category: 'toys',
    description: 'Let it fly high on a breezy day!',
    price: 35,
    moodBoost: 5,
    repeatable: true,
  },
  {
    id: 'toy-puzzle',
    name: 'Puzzle Box',
    emoji: '🧩',
    category: 'toys',
    description: 'Keeps your monster thinking.',
    price: 40,
    moodBoost: 5,
    repeatable: true,
  },
  {
    id: 'toy-teddy',
    name: 'Teddy Bear',
    emoji: '🧸',
    category: 'toys',
    description: 'A cuddly companion for nap time.',
    price: 60,
    moodBoost: 7,
    repeatable: true,
  },
  {
    id: 'toy-bubbles',
    name: 'Bubble Wand',
    emoji: '🫧',
    category: 'toys',
    description: 'Pop! Pop! Pop! Pure joy.',
    price: 30,
    moodBoost: 4,
    repeatable: true,
  },

  // ─── Accessories (one-time purchase, permanent collection) ──────────
  {
    id: 'acc-bow',
    name: 'Cute Bow',
    emoji: '🎀',
    category: 'accessories',
    description: 'A sweet little bow for your monster.',
    price: 50,
    moodBoost: 2,
    repeatable: false,
  },
  {
    id: 'acc-crown',
    name: 'Mini Crown',
    emoji: '👑',
    category: 'accessories',
    description: 'Royalty status unlocked.',
    price: 100,
    moodBoost: 3,
    repeatable: false,
  },
  {
    id: 'acc-sunglasses',
    name: 'Star Shades',
    emoji: '🕶️',
    category: 'accessories',
    description: 'Too cool for school.',
    price: 75,
    moodBoost: 2,
    repeatable: false,
  },
  {
    id: 'acc-flower',
    name: 'Flower Crown',
    emoji: '🌸',
    category: 'accessories',
    description: 'Springtime vibes all year round.',
    price: 80,
    moodBoost: 3,
    repeatable: false,
  },
  {
    id: 'acc-scarf',
    name: 'Cozy Scarf',
    emoji: '🧣',
    category: 'accessories',
    description: 'Warm and snuggly.',
    price: 60,
    moodBoost: 2,
    repeatable: false,
  },
  {
    id: 'acc-witch-hat',
    name: 'Witch Hat',
    emoji: '🧙',
    category: 'accessories',
    description: 'Spooky and stylish.',
    price: 90,
    moodBoost: 3,
    repeatable: false,
  },

  // ─── Room Decor (one-time purchase, permanent collection) ───────────
  {
    id: 'decor-plant',
    name: 'Potted Plant',
    emoji: '🪴',
    category: 'decor',
    description: 'A little greenery for the room.',
    price: 40,
    moodBoost: 2,
    repeatable: false,
  },
  {
    id: 'decor-fairy-lights',
    name: 'Fairy Lights',
    emoji: '✨',
    category: 'decor',
    description: 'Soft twinkling glow.',
    price: 60,
    moodBoost: 3,
    repeatable: false,
  },
  {
    id: 'decor-cushion',
    name: 'Floor Cushion',
    emoji: '🛋️',
    category: 'decor',
    description: 'A cozy spot to relax.',
    price: 55,
    moodBoost: 3,
    repeatable: false,
  },
  {
    id: 'decor-poster',
    name: 'Cute Poster',
    emoji: '🖼️',
    category: 'decor',
    description: 'Brighten up the walls!',
    price: 45,
    moodBoost: 2,
    repeatable: false,
  },
  {
    id: 'decor-rug',
    name: 'Fluffy Rug',
    emoji: '🟣',
    category: 'decor',
    description: 'Soft under monster feet.',
    price: 70,
    moodBoost: 3,
    repeatable: false,
  },
  {
    id: 'decor-aquarium',
    name: 'Mini Aquarium',
    emoji: '🐠',
    category: 'decor',
    description: 'Relaxing fish friends to watch.',
    price: 100,
    moodBoost: 4,
    repeatable: false,
  },
];
