import { ImageSourcePropType } from "react-native";

/**
 * Real art is 1408×1408 transparent PNGs at these paths, named by item id.
 * Tiny stand-ins live here until those files are dropped in; the renderer
 * still works, and missing ids fall back to the catalog emoji.
 */
export const ACCESSORY_IMAGES: Record<string, ImageSourcePropType> = {
  "acc-bow": require("../assets/images/accessories/acc-bow.png"),
  "acc-crown": require("../assets/images/accessories/acc-crown.png"),
  "acc-flower": require("../assets/images/accessories/acc-flower.png"),
  "acc-witch-hat": require("../assets/images/accessories/acc-witch-hat.png"),
  "acc-sunglasses": require("../assets/images/accessories/acc-sunglasses.png"),
  "acc-scarf": require("../assets/images/accessories/acc-scarf.png"),
};

export function getAccessoryImage(
  itemId: string,
): ImageSourcePropType | undefined {
  return ACCESSORY_IMAGES[itemId];
}
