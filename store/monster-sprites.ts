import { ImageSourcePropType } from "react-native";

import { AdultVariant, EvolutionStage } from "./types";
import { PetMood } from "./use-pet-store";

export const STAGE_SPRITES = {
  luna: {
    egg: require("../assets/images/luna_egg.png"),
    baby: require("../assets/images/luna_baby.png"),
    teen: require("../assets/images/luna_teen.png"),
    adult: require("../assets/images/luna_adult.png"),
    adult_kitchen: require("../assets/images/luna_adult_kitchen.png"),
    adult_livingroom: require("../assets/images/luna_adult_livingroom.png"),
    adult_bedroom: require("../assets/images/luna_adult_bedroom.png"),
    adult_bathroom: require("../assets/images/luna_adult_bathroom.png"),
    sad_egg: require("../assets/images/sad_luna_egg.png"),
    sad_baby: require("../assets/images/sad_luna_baby.png"),
    sad_teen: require("../assets/images/sad_luna_teen.png"),
  },
  nilly: {
    egg: require("../assets/images/nilly_egg.png"),
    baby: require("../assets/images/nilly_baby.png"),
    teen: require("../assets/images/nilly_teen.png"),
    adult: require("../assets/images/nilly_adult.png"),
    adult_kitchen: require("../assets/images/nilly_adult_kitchen.png"),
    adult_livingroom: require("../assets/images/nilly_adult_livingroom.png"),
    adult_bedroom: require("../assets/images/nilly_adult_bedroom.png"),
    adult_bathroom: require("../assets/images/nilly_adult_bathroom.png"),
    sad_egg: require("../assets/images/sad_nilly_egg.png"),
    sad_baby: require("../assets/images/sad_nilly_baby.png"),
    sad_teen: require("../assets/images/sad_nilly_teen.png"),
  },
} as const;

export function getMonsterSprite(
  monster: "nilly" | "luna",
  stage: EvolutionStage,
  adultVariant: AdultVariant,
  mood: PetMood,
): ImageSourcePropType {
  const sprites = STAGE_SPRITES[monster];
  const isSadMood = mood === "sad" || mood === "sick";

  if (stage === "adult" || stage === "ascended") {
    const key =
      adultVariant === "base"
        ? "adult"
        : (`adult_${adultVariant}` as keyof typeof sprites);
    return (sprites[key] ?? sprites.adult) as ImageSourcePropType;
  }

  if (isSadMood) {
    const sadKey = `sad_${stage}` as keyof typeof sprites;
    const sadSprite = sprites[sadKey];
    if (sadSprite) return sadSprite as ImageSourcePropType;
  }

  return (sprites[stage as keyof typeof sprites] ??
    sprites.egg) as ImageSourcePropType;
}
