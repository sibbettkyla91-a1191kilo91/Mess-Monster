/**
 * Decor placement slots — each decor item maps to one fixed, designated
 * position in the monster's habitat room.
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
  "decor-fairy-lights": { base: { x: 0.5, y: 0.09, size: 0.5 } },
  "decor-poster": { base: { x: 0.17, y: 0.2, size: 0.16 } },
  "decor-aquarium": { base: { x: 0.84, y: 0.3, size: 0.18 } },
  "decor-plant": { base: { x: 0.11, y: 0.52, size: 0.17 } },
  "decor-cushion": { base: { x: 0.87, y: 0.55, size: 0.17 } },
  "decor-rug": { base: { x: 0.5, y: 0.62, size: 0.38 } },
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
