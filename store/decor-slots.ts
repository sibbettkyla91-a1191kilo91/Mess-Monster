/**
 * Room placement slots — each placeable item (decor and toys) maps to one
 * fixed, designated position in the monster's habitat room.
 *
 * Coordinates are fractions of screen width/height so slots scale to any
 * device. Slot geometry is independent of what renders inside it: today the
 * item's catalog emoji, later sprite art supplied via the optional `image`
 * field. Swapping in real art only touches `image`, never the coordinates.
 */

import { ImageSourcePropType } from "react-native";

export type MonsterId = "nilly" | "luna";

export interface DecorSlotPosition {
  /** Slot center, as a fraction of screen width (0 = left, 1 = right) */
  x: number;
  /** Slot center, as a fraction of screen height (0 = top, 1 = bottom) */
  y: number;
  /** Rendered size, as a fraction of screen width */
  size: number;
}

interface DecorSlotDef {
  base: DecorSlotPosition;
  /** Per-monster position tweaks where the two rooms differ */
  overrides?: Partial<Record<MonsterId, Partial<DecorSlotPosition>>>;
  /** Sprite art; while absent, the item's catalog emoji renders in the slot */
  image?: ImageSourcePropType;
}

const DECOR_SLOTS: Record<string, DecorSlotDef> = {
  // ── Current catalog (store/store-items.ts) ──────────────────────────────
  // Each monster's room uses the same layout: one wall piece up high, one
  // hanging up top, one lamp/light in the upper right, one rug on the floor;
  // plants on the shelves and floor at the sides; toys near the rug's edge.
  // Ids are already per monster, so no overrides are needed.

  // Nilly — plants
  "nilly-plant-sunflower": { base: { x: 0.11, y: 0.52, size: 0.17 } },
  "nilly-plant-pothos": { base: { x: 0.84, y: 0.3, size: 0.18 } },
  "nilly-plant-wildflower-bouquet": { base: { x: 0.17, y: 0.2, size: 0.15 } },
  "nilly-plant-succulent-trio": { base: { x: 0.87, y: 0.55, size: 0.15 } },
  // Nilly — decor
  "nilly-decor-macrame-wall-hanging": { base: { x: 0.5, y: 0.09, size: 0.3 } },
  "nilly-decor-tie-dye-tapestry": { base: { x: 0.32, y: 0.14, size: 0.24 } },
  "nilly-decor-mushroom-lamp": { base: { x: 0.68, y: 0.21, size: 0.13 } },
  "nilly-decor-woven-rug": { base: { x: 0.5, y: 0.62, size: 0.38 } },
  // Nilly — toys (floor, either side of the rug)
  "nilly-toy-tie-dye-yarn-ball": { base: { x: 0.8, y: 0.7, size: 0.1 } },
  "nilly-toy-mushroom-plushie": { base: { x: 0.2, y: 0.7, size: 0.15 } },

  // Luna — plants
  "luna-plant-black-rose": { base: { x: 0.11, y: 0.52, size: 0.17 } },
  "luna-plant-trailing-ivy": { base: { x: 0.84, y: 0.3, size: 0.18 } },
  "luna-plant-venus-flytrap": { base: { x: 0.87, y: 0.55, size: 0.15 } },
  "luna-plant-nightshade-sprig": { base: { x: 0.17, y: 0.2, size: 0.14 } },
  // Luna — decor
  "luna-decor-spiderweb-curtain": { base: { x: 0.5, y: 0.09, size: 0.34 } },
  "luna-decor-tarot-card-display": { base: { x: 0.32, y: 0.14, size: 0.2 } },
  "luna-decor-candle-cluster": { base: { x: 0.68, y: 0.21, size: 0.13 } },
  "luna-decor-potion-bottle-set": { base: { x: 0.5, y: 0.62, size: 0.3 } },
  // Luna — toys
  "luna-toy-raven-feather": { base: { x: 0.8, y: 0.7, size: 0.11 } },
  "luna-toy-tarot-deck-charm": { base: { x: 0.2, y: 0.7, size: 0.12 } },

  // ── Retired catalog ─────────────────────────────────────────────────────
  // No longer sold; kept so a legacy save's placed items still render.
  "decor-fairy-lights": { base: { x: 0.5, y: 0.09, size: 0.5 } },
  "decor-poster": { base: { x: 0.17, y: 0.2, size: 0.16 } },
  "decor-aquarium": { base: { x: 0.84, y: 0.3, size: 0.18 } },
  "decor-plant": { base: { x: 0.11, y: 0.52, size: 0.17 } },
  "decor-cushion": { base: { x: 0.87, y: 0.55, size: 0.17 } },
  "decor-rug": { base: { x: 0.5, y: 0.62, size: 0.38 } },

  // Toy slots — placeholder positions pending real sprite art, like decor.
  // Airborne toys take the upper corners left free by the decor set; the
  // rest sit on the floor around the rug's edges.
  "toy-kite": { base: { x: 0.32, y: 0.14, size: 0.14 } },
  "toy-bubbles": { base: { x: 0.68, y: 0.21, size: 0.11 } },
  "toy-teddy": { base: { x: 0.2, y: 0.7, size: 0.15 } },
  "toy-puzzle": { base: { x: 0.34, y: 0.78, size: 0.11 } },
  "toy-ball": { base: { x: 0.66, y: 0.75, size: 0.1 } },
  "toy-yarn": { base: { x: 0.8, y: 0.7, size: 0.1 } },
};

export interface ResolvedDecorSlot extends DecorSlotPosition {
  image?: ImageSourcePropType;
}

/** Resolve an item's slot for a monster's room; null if the item has no slot. */
export function getDecorSlot(
  itemId: string,
  monster: MonsterId,
): ResolvedDecorSlot | null {
  const def = DECOR_SLOTS[itemId];
  if (!def) return null;
  return { ...def.base, ...def.overrides?.[monster], image: def.image };
}
