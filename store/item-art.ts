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
  "nilly-accessory-daisy-chain-crown": require("../assets/images/items/nilly-accessory-daisy-chain-crown.png"),
  "nilly-decor-macrame-wall-hanging": require("../assets/images/items/nilly-decor-macrame-wall-hanging.png"),
  "nilly-decor-woven-rug": require("../assets/images/items/nilly-decor-woven-rug.png"),
  "nilly-decor-tie-dye-tapestry": require("../assets/images/items/nilly-decor-tie-dye-tapestry.png"),
  "nilly-decor-mushroom-lamp": require("../assets/images/items/nilly-decor-mushroom-lamp.png"),
  "luna-plant-black-rose": require("../assets/images/items/luna-plant-black-rose.png"),
  "luna-plant-trailing-ivy": require("../assets/images/items/luna-plant-trailing-ivy.png"),
  "luna-plant-venus-flytrap": require("../assets/images/items/luna-plant-venus-flytrap.png"),
  "luna-plant-nightshade-sprig": require("../assets/images/items/luna-plant-nightshade-sprig.png"),
  "luna-food-dark-chocolate-truffle": require("../assets/images/items/luna-food-dark-chocolate-truffle.png"),
  "luna-food-elderberry-tonic": require("../assets/images/items/luna-food-elderberry-tonic.png"),
  "luna-food-blackberry-preserve": require("../assets/images/items/luna-food-blackberry-preserve.png"),
  "luna-food-spiced-mulled-cider": require("../assets/images/items/luna-food-spiced-mulled-cider.png"),
  "luna-toy-raven-feather": require("../assets/images/items/luna-toy-raven-feather.png"),
  "luna-toy-tarot-deck-charm": require("../assets/images/items/luna-toy-tarot-deck-charm.png"),
  "luna-accessory-spiderweb-choker": require("../assets/images/items/luna-accessory-spiderweb-choker.png"),
  "luna-accessory-crystal-ball-charm": require("../assets/images/items/luna-accessory-crystal-ball-charm.png"),
  "luna-decor-candle-cluster": require("../assets/images/items/luna-decor-candle-cluster.png"),
  "luna-decor-potion-bottle-set": require("../assets/images/items/luna-decor-potion-bottle-set.png"),
  "luna-decor-tarot-card-display": require("../assets/images/items/luna-decor-tarot-card-display.png"),
  "luna-decor-spiderweb-curtain": require("../assets/images/items/luna-decor-spiderweb-curtain.png"),
};

export function getItemArt(
  assetKey: string | undefined,
): ImageSourcePropType | undefined {
  if (!assetKey) return undefined;
  return ITEM_ART[assetKey];
}
