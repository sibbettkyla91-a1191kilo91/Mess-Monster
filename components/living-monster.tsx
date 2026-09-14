import { Ref, useEffect, useImperativeHandle, useRef } from "react";
import {
  Animated,
  Image,
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";

import { AccessoryLayer } from "@/components/accessory-layer";
import { resolveAccessoryStage } from "@/store/accessory-config";
import { getMonsterSprite } from "@/store/monster-sprites";
import { AdultVariant, EvolutionStage } from "@/store/types";
import { EquippedMap } from "@/store/use-store-store";
import { PetMood } from "@/store/use-pet-store";

/**
 * Imperative hooks Home uses to react to a care action. These only drive
 * presentation — the store write has already happened by the time they run.
 */
export type LivingMonsterHandle = {
  /** The quick 1.12× tap bounce every care action shares. */
  bounce: () => void;
};

type Props = {
  monster: "nilly" | "luna";
  stage: EvolutionStage;
  adultVariant: AdultVariant;
  mood: PetMood;
  equipped: EquippedMap;
  size: number;
  /** Glow colour for the teen/adult shadow. */
  accent: string;
  accessibilityLabel: string;
  onPress: () => void;
  /** Positions the monster on screen; the Pressable owns layout. */
  style?: StyleProp<ViewStyle>;
  ref?: Ref<LivingMonsterHandle>;
};

/**
 * The monster as a living thing: sprite, worn accessories, and every idle or
 * reaction animation. Purely presentational — it reads nothing from the
 * stores and writes nothing. Home owns state and handlers and passes props.
 */
export function LivingMonster({
  monster,
  stage,
  adultVariant,
  mood,
  equipped,
  size,
  accent,
  accessibilityLabel,
  onPress,
  style,
  ref,
}: Props) {
  // ── Tap bounce ─────────────────────────────────────────────────────────
  const tapScaleAnim = useRef(new Animated.Value(1)).current;

  useImperativeHandle(
    ref,
    () => ({
      bounce: () => {
        Animated.sequence([
          Animated.timing(tapScaleAnim, {
            toValue: 1.12,
            duration: 120,
            useNativeDriver: true,
          }),
          Animated.timing(tapScaleAnim, {
            toValue: 1.0,
            duration: 120,
            useNativeDriver: true,
          }),
        ]).start();
      },
    }),
    [tapScaleAnim],
  );

  useEffect(() => {
    return () => {
      // PERFORMANCE: Reset animation values on cleanup to prevent leaks
      tapScaleAnim.setValue(1);
    };
  }, [tapScaleAnim]);

  // ── Bob ────────────────────────────────────────────────────────────────
  const bobAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const isSad = mood === "sad" || mood === "sick";
    const bobSpeed = mood === "thriving" ? 900 : isSad ? 2600 : 1700;
    const bobAmt = isSad ? 6 : -12;

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bobAnim, {
          toValue: bobAmt,
          duration: bobSpeed / 2,
          useNativeDriver: true,
        }),
        Animated.timing(bobAnim, {
          toValue: 0,
          duration: bobSpeed / 2,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
      // PERFORMANCE: Reset animation value on cleanup to prevent animation state leaks
      bobAnim.setValue(0);
    };
  }, [mood, bobAnim]);

  // ── Wiggle ─────────────────────────────────────────────────────────────
  const wiggleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let active = true;
    let tid: ReturnType<typeof setTimeout>;

    const schedule = () => {
      if (!active) return;
      tid = setTimeout(
        () => {
          if (!active) return;
          Animated.sequence([
            Animated.timing(wiggleAnim, {
              toValue: -9,
              duration: 80,
              useNativeDriver: true,
            }),
            Animated.timing(wiggleAnim, {
              toValue: 9,
              duration: 100,
              useNativeDriver: true,
            }),
            Animated.timing(wiggleAnim, {
              toValue: -5,
              duration: 80,
              useNativeDriver: true,
            }),
            Animated.timing(wiggleAnim, {
              toValue: 0,
              duration: 100,
              useNativeDriver: true,
            }),
          ]).start(() => schedule());
        },
        4000 + Math.random() * 4000,
      );
    };

    schedule();
    return () => {
      active = false;
      clearTimeout(tid);
      // PERFORMANCE: Reset animation value on cleanup
      wiggleAnim.setValue(0);
    };
  }, [wiggleAnim]);

  // ── Thriving scale-pulse ───────────────────────────────────────────────
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (mood !== "thriving") {
      scaleAnim.setValue(1);
      return;
    }
    let active = true;
    let tid: ReturnType<typeof setTimeout>;

    const schedule = () => {
      if (!active) return;
      tid = setTimeout(
        () => {
          if (!active) return;
          Animated.sequence([
            Animated.timing(scaleAnim, {
              toValue: 1.08,
              duration: 240,
              useNativeDriver: true,
            }),
            Animated.timing(scaleAnim, {
              toValue: 1.0,
              duration: 240,
              useNativeDriver: true,
            }),
            Animated.timing(scaleAnim, {
              toValue: 1.05,
              duration: 180,
              useNativeDriver: true,
            }),
            Animated.timing(scaleAnim, {
              toValue: 1.0,
              duration: 180,
              useNativeDriver: true,
            }),
          ]).start(() => schedule());
        },
        5000 + Math.random() * 5000,
      );
    };

    schedule();
    return () => {
      active = false;
      clearTimeout(tid);
      // PERFORMANCE: Reset animation value on cleanup
      scaleAnim.setValue(1);
    };
  }, [mood, scaleAnim]);

  // ── Evolution glow pulse (adult / ascended) ────────────────────────────
  const evoScaleAnim = useRef(new Animated.Value(1)).current;
  const isAdult = stage === "adult" || stage === "ascended";

  useEffect(() => {
    if (!isAdult) {
      evoScaleAnim.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(evoScaleAnim, {
          toValue: 1.04,
          duration: 1800,
          useNativeDriver: true,
        }),
        Animated.timing(evoScaleAnim, {
          toValue: 1.0,
          duration: 1800,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
      // PERFORMANCE: Reset animation value on cleanup
      evoScaleAnim.setValue(1);
    };
  }, [isAdult, evoScaleAnim]);

  // ── Sick wobble ────────────────────────────────────────────────────────
  const sickWobbleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (mood !== "sick") {
      sickWobbleAnim.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sickWobbleAnim, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(sickWobbleAnim, {
          toValue: -1,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
      // PERFORMANCE: Reset animation value on cleanup
      sickWobbleAnim.setValue(0);
    };
  }, [mood, sickWobbleAnim]);

  const wiggleRot = wiggleAnim.interpolate({
    inputRange: [-9, 0, 9],
    outputRange: ["-4.5deg", "0deg", "4.5deg"],
  });
  const sickWobbleRot = sickWobbleAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ["-8deg", "0deg", "8deg"],
  });

  // Egg stage: slightly faded to convey "not yet hatched"
  // Sick mood: also faded to convey distress
  const wrapperOpacity = Math.min(
    stage === "egg" ? 0.75 : 1,
    mood === "neutral" || mood === "sick" ? 0.75 : 1,
  );

  // Stage-based shadow intensity
  const shadowStyle = isAdult
    ? {
        shadowColor: accent,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.75,
        shadowRadius: 30,
        elevation: Platform.OS === "android" ? 0 : 14,
      }
    : stage === "teen"
      ? {
          shadowColor: accent,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.45,
          shadowRadius: 18,
          elevation: Platform.OS === "android" ? 0 : 8,
        }
      : null;

  const monsterSource = getMonsterSprite(monster, stage, adultVariant, mood);
  const wearStage = resolveAccessoryStage(stage);

  // Positioning lives on the Pressable: position "absolute" anchors to the
  // direct parent in RN, so it must sit on the container's child — on the
  // inner Animated.View it would anchor to the zero-height Pressable and
  // render offscreen.
  return (
    <Pressable
      onPress={onPress}
      style={style}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Animated.View
        style={[
          { opacity: wrapperOpacity },
          shadowStyle,
          {
            transform: [
              { translateY: bobAnim },
              { scale: scaleAnim },
              { scale: evoScaleAnim },
              { scale: tapScaleAnim },
              { rotateZ: wiggleRot },
              { rotateZ: sickWobbleRot },
            ],
          },
        ]}
      >
        <View style={{ width: size, height: size, aspectRatio: 1 }}>
          <Image
            source={monsterSource}
            style={StyleSheet.absoluteFillObject}
            resizeMode="contain"
          />
          {wearStage && (
            <AccessoryLayer
              monster={monster}
              stage={wearStage}
              equipped={equipped}
              size={size}
            />
          )}
        </View>
      </Animated.View>
    </Pressable>
  );
}
