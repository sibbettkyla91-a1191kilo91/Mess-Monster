import { ImageSourcePropType } from "react-native";

/**
 * Item art registry — the one place final artwork gets wired in.
 *
 * Every catalog item carries an `assetKey` (store/store-items.ts). Renderers
 * (shop card, Collection card, room DecorLayer, worn AccessoryLayer, the
 * feed/play picker) ask `getItemArt(assetKey)` and fall back to the item's
 * emoji when it returns undefined. The registry is intentionally empty until
 * final art exists: dropping in a piece is one line per key, e.g.
 *
 *   "nilly-plant-sunflower": require("../assets/images/items/nilly-plant-sunflower.png"),
 *
 * No other file changes. Do not add placeholder image files here; an
 * unmapped key is the supported "no art yet" state.
 */
export const ITEM_ART: Record<string, ImageSourcePropType> = {};

export function getItemArt(
  assetKey: string | undefined,
): ImageSourcePropType | undefined {
  if (!assetKey) return undefined;
  return ITEM_ART[assetKey];
}
