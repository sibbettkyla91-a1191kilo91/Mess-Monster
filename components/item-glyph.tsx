import { Image, ImageStyle, StyleProp, Text, TextStyle } from "react-native";

import { getItemArt } from "@/store/item-art";

type Props = {
  /** Catalog assetKey. Legacy snapshots without one fall straight to emoji. */
  assetKey?: string;
  emoji: string;
  /** Square side in px. Emoji font size is derived from it. */
  size: number;
  style?: StyleProp<ImageStyle>;
  textStyle?: StyleProp<TextStyle>;
};

/**
 * One item picture. Shows registered art from store/item-art.ts when a key
 * is mapped, otherwise the item's emoji — identical to how every renderer
 * behaved before the registry existed.
 */
export function ItemGlyph({ assetKey, emoji, size, style, textStyle }: Props) {
  const art = getItemArt(assetKey);
  if (art) {
    return (
      <Image
        source={art}
        style={[{ width: size, height: size }, style]}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
    );
  }
  return (
    <Text
      style={[
        { fontSize: Math.round(size * 0.7), textAlign: "center" },
        textStyle,
      ]}
    >
      {emoji}
    </Text>
  );
}
