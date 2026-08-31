import { ReactNode, useEffect, useMemo } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import {
  AccessoryAnimation,
  AccessoryMonster,
  AccessorySlot,
  AccessoryStage,
  getAccessoryDef,
  getSlotAnchor,
  SlotAnchor,
} from "@/store/accessory-config";
import { getAccessoryImage } from "@/store/accessory-images";
import { STORE_ITEMS } from "@/store/store-items";
import { EquippedMap } from "@/store/use-store-store";

const EMPTY_EQUIPPED: EquippedMap = {};

type Props = {
  monster: AccessoryMonster;
  stage: AccessoryStage;
  equipped: EquippedMap;
  size: number;
  /** Tuner: replace the config anchor for one slot. */
  anchorOverrides?: Partial<Record<AccessorySlot, SlotAnchor>>;
};

type LayerItem = {
  id: string;
  slot: AccessorySlot;
  emoji: string;
  animation: AccessoryAnimation;
  anchor: SlotAnchor;
};

function collectLayers(
  equipped: EquippedMap,
  monster: AccessoryMonster,
  stage: AccessoryStage,
  overrides?: Partial<Record<AccessorySlot, SlotAnchor>>,
): LayerItem[] {
  const items: LayerItem[] = [];
  for (const slot of ["head", "face", "neck"] as AccessorySlot[]) {
    const id = equipped[slot];
    if (!id) continue;
    const def = getAccessoryDef(id);
    if (!def) continue;
    const catalog = STORE_ITEMS.find((i) => i.id === id);
    items.push({
      id,
      slot,
      emoji: catalog?.emoji ?? "🎁",
      animation: def.animation,
      anchor: overrides?.[slot] ?? getSlotAnchor(monster, stage, slot),
    });
  }
  items.sort((a, b) => a.anchor.zIndex - b.anchor.zIndex);
  return items;
}

function TransformWrap({
  animation,
  children,
}: {
  animation: Extract<AccessoryAnimation, { kind: "transform" }>;
  children: ReactNode;
}) {
  const t = useSharedValue(0);
  const amount = animation.amount ?? 3;
  const duration = animation.durationMs ?? 1400;

  useEffect(() => {
    t.value = withRepeat(
      withSequence(
        withTiming(1, { duration: duration / 2 }),
        withTiming(-1, { duration: duration / 2 }),
      ),
      -1,
      true,
    );
  }, [t, amount, duration]);

  const style = useAnimatedStyle(() => {
    if (animation.preset === "sway") {
      return { transform: [{ translateX: t.value * amount }] };
    }
    if (animation.preset === "tilt") {
      return { transform: [{ rotate: `${t.value * amount}deg` }] };
    }
    return { transform: [{ translateY: t.value * amount }] };
  });

  return <Animated.View style={style}>{children}</Animated.View>;
}

function AccessoryPiece({
  item,
  size,
}: {
  item: LayerItem;
  size: number;
}) {
  const { anchor } = item;
  const pieceSize = Math.max(4, anchor.scale * size);
  const left = anchor.x * size - pieceSize / 2;
  const top = anchor.y * size - pieceSize / 2;
  const image = getAccessoryImage(item.id);

  const body = image ? (
    <Image
      source={image}
      style={{ width: pieceSize, height: pieceSize }}
      resizeMode="contain"
    />
  ) : (
    <Text style={{ fontSize: pieceSize * 0.7, textAlign: "center" }}>
      {item.emoji}
    </Text>
  );

  const motion =
    item.animation.kind === "transform" ? (
      <TransformWrap animation={item.animation}>{body}</TransformWrap>
    ) : (
      body
    );

  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left,
        top,
        width: pieceSize,
        height: pieceSize,
        alignItems: "center",
        justifyContent: "center",
        transform: [{ rotate: `${anchor.rotation}deg` }],
      }}
    >
      {motion}
    </View>
  );
}

/**
 * Draws worn accessories on top of the monster picture.
 * Always in front of the body — zIndex only sorts items vs each other.
 */
export function AccessoryLayer({
  monster,
  stage,
  equipped = EMPTY_EQUIPPED,
  size,
  anchorOverrides,
}: Props) {
  const layers = useMemo(
    () => collectLayers(equipped, monster, stage, anchorOverrides),
    [equipped, monster, stage, anchorOverrides],
  );

  if (layers.length === 0) return null;

  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFillObject, { width: size, height: size }]}
    >
      {layers.map((item) => (
        <AccessoryPiece key={item.slot} item={item} size={size} />
      ))}
    </View>
  );
}
