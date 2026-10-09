import { ImageSourcePropType } from "react-native";

/**
 * Item art registry — the one place final artwork gets wired in.
 *
 * Every catalog item carries an `assetKey` (store/store-items.ts). Renderers
 * (shop card, Collection card, room DecorLayer, worn AccessoryLayer, the
 * feed/play picker) ask `getItemArt(assetKey)` and fall back to the item's
 * emoji when it returns undefined. Dropping in a piece is one line per key.
 * Unmapped keys stay on the emoji. Do not add placeholder files.
 *
 *   "nilly-plant-sunflower": require("../assets/images/items/nilly-plant-sunflower.png"),
 */
export const ITEM_ART: Record<string, ImageSourcePropType> = {
  "nilly-plant-sunflower": require("../assets/images/items/nilly-plant-sunflower.png"),
  "nilly-plant-pothos": require("../assets/images/items/nilly-plant-pothos.png"),
  "nilly-plant-wildflower-bouquet": require("../assets/images/items/nilly-plant-wildflower-bouquet.png"),
  "nilly-plant-succulent-trio": require("../assets/images/items/nilly-plant-succulent-trio.png"),
  "nilly-food-granola-honey-bar": require("../assets/images/items/nilly-food-granola-honey-bar.png"),
  "nilly-food-herbal-sun-tea": require("../assets/images/items/nilly-food-herbal-sun-tea.png"),
  "nilly-food-mushroom-chips": require("../assets/images/items/nilly-food-mushroom-chips.png"),
  "nilly-food-fresh-berries": require("../assets/images/items/nilly-food-fresh-berries.png"),
  "nilly-toy-tie-dye-yarn-ball": require("../assets/images/items/nilly-toy-tie-dye-yarn-ball.png"),
  "nilly-toy-mushroom-plushie": require("../assets/images/items/nilly-toy-mushroom-plushie.png"),
  "nilly-accessory-friendship-bracelet": require("../assets/images/items/nilly-accessory-friendship-bracelet.png"),
};

export function getItemArt(
  assetKey: string | undefined,
): ImageSourcePropType | undefined {
  if (!assetKey) return undefined;
  return ITEM_ART[assetKey];
}
