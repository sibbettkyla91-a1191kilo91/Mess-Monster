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
import { useReduceMotion } from "@/hooks/use-reduce-motion";
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

// Idle-life timing. Everything here is presentation only: transforms and
// opacity on the native driver, no layout, no store writes.
const BREATH_MS = 3600;
const BREATH_SCALE = 1.02;
const GLANCE_MIN_MS = 8000;
const GLANCE_RANGE_MS = 6000;
const GLANCE_HOLD_MS = 600;
const GLANCE_DEG = 2;
const PERK_MIN_MS = 9000;
const PERK_RANGE_MS = 7000;
const PERK_HEIGHT = 14;

// Ground shadow as fractions of the sprite box. Rough on purpose — sprites
// may be redrawn; this is a soft ellipse, not an anchor.
const SHADOW_WIDTH = 0.5;
const SHADOW_HEIGHT = 0.075;
const SHADOW_BOTTOM = 0.035;

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
  // OS "reduce motion": every continuous loop below stays parked. Short,
  // player-triggered reactions (the tap bounce) still run.
  const reduceMotion = useReduceMotion();

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
    if (reduceMotion) {
      bobAnim.setValue(0);
      return;
    }
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
  }, [mood, bobAnim, reduceMotion]);

  // ── Breathing ──────────────────────────────────────────────────────────
  // A slow ±2% swell so the monster never sits perfectly still, even when
  // the bob is at rest between beats.
  const breathAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (reduceMotion) {
      breathAnim.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathAnim, {
          toValue: BREATH_SCALE,
          duration: BREATH_MS / 2,
          useNativeDriver: true,
        }),
        Animated.timing(breathAnim, {
          toValue: 1,
          duration: BREATH_MS / 2,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
      breathAnim.setValue(1);
    };
  }, [breathAnim, reduceMotion]);

  // ── Glance ─────────────────────────────────────────────────────────────
  // Every 8–14 s: a small tilt, held for a beat, then released. Reads as
  // the monster looking over at you.
  const glanceAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) {
      glanceAnim.setValue(0);
      return;
    }
    let active = true;
    let tid: ReturnType<typeof setTimeout>;

    const schedule = () => {
      if (!active) return;
      tid = setTimeout(
        () => {
          if (!active) return;
          const dir = Math.random() < 0.5 ? -1 : 1;
          Animated.sequence([
            Animated.timing(glanceAnim, {
              toValue: dir,
              duration: 220,
              useNativeDriver: true,
            }),
            Animated.delay(GLANCE_HOLD_MS),
            Animated.timing(glanceAnim, {
              toValue: 0,
              duration: 260,
              useNativeDriver: true,
            }),
          ]).start(() => schedule());
        },
        GLANCE_MIN_MS + Math.random() * GLANCE_RANGE_MS,
      );
    };

    schedule();
    return () => {
      active = false;
      clearTimeout(tid);
      glanceAnim.setValue(0);
    };
  }, [glanceAnim, reduceMotion]);

  // ── Perk-up hop (thriving only) ────────────────────────────────────────
  const hopAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion || mood !== "thriving") {
      hopAnim.setValue(0);
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
            Animated.timing(hopAnim, {
              toValue: -PERK_HEIGHT,
              duration: 160,
              useNativeDriver: true,
            }),
            Animated.timing(hopAnim, {
              toValue: 0,
              duration: 220,
              useNativeDriver: true,
            }),
          ]).start(() => schedule());
        },
        PERK_MIN_MS + Math.random() * PERK_RANGE_MS,
      );
    };

    schedule();
    return () => {
      active = false;
      clearTimeout(tid);
      hopAnim.setValue(0);
    };
  }, [mood, hopAnim, reduceMotion]);

  // ── Wiggle ─────────────────────────────────────────────────────────────
  const wiggleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) {
      wiggleAnim.setValue(0);
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
  }, [wiggleAnim, reduceMotion]);

  // ── Thriving scale-pulse ───────────────────────────────────────────────
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (reduceMotion || mood !== "thriving") {
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
  }, [mood, scaleAnim, reduceMotion]);

  // ── Evolution glow pulse (adult / ascended) ────────────────────────────
  const evoScaleAnim = useRef(new Animated.Value(1)).current;
  const isAdult = stage === "adult" || stage === "ascended";

  useEffect(() => {
    if (reduceMotion || !isAdult) {
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
  }, [isAdult, evoScaleAnim, reduceMotion]);

  // ── Sick wobble ────────────────────────────────────────────────────────
  const sickWobbleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion || mood !== "sick") {
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
  }, [mood, sickWobbleAnim, reduceMotion]);

  const wiggleRot = wiggleAnim.interpolate({
    inputRange: [-9, 0, 9],
    outputRange: ["-4.5deg", "0deg", "4.5deg"],
  });
  const sickWobbleRot = sickWobbleAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ["-8deg", "0deg", "8deg"],
  });
  const glanceRot = glanceAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [`-${GLANCE_DEG}deg`, "0deg", `${GLANCE_DEG}deg`],
  });

  // Ground shadow follows the body's height: higher off the floor means a
  // smaller, fainter ellipse. Bob and hop both lift the body, so they share
  // one driver.
  const lift = Animated.add(bobAnim, hopAnim);
  const shadowScale = lift.interpolate({
    inputRange: [-PERK_HEIGHT - 12, 0, 6],
    outputRange: [0.72, 1, 1.05],
    extrapolate: "clamp",
  });
  const shadowOpacity = lift.interpolate({
    inputRange: [-PERK_HEIGHT - 12, 0, 6],
    outputRange: [0.14, 0.3, 0.34],
    extrapolate: "clamp",
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
        pointerEvents="none"
        testID="monster-ground-shadow"
        style={{
          position: "absolute",
          bottom: size * SHADOW_BOTTOM,
          width: size * SHADOW_WIDTH,
          height: size * SHADOW_HEIGHT,
          borderRadius: 999,
          backgroundColor: "#000",
          opacity: shadowOpacity,
          transform: [{ scaleX: shadowScale }, { scaleY: shadowScale }],
        }}
      />
      <Animated.View
        style={[
          { opacity: wrapperOpacity },
          shadowStyle,
          {
            transform: [
              { translateY: bobAnim },
              { translateY: hopAnim },
              { scale: breathAnim },
              { scale: scaleAnim },
              { scale: evoScaleAnim },
              { scale: tapScaleAnim },
              { rotateZ: wiggleRot },
              { rotateZ: sickWobbleRot },
              { rotateZ: glanceRot },
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
