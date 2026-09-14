import * as Haptics from "expo-haptics";
import { Ref, useEffect, useImperativeHandle, useRef, useState } from "react";
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
  /**
   * A 1.2–1.8 s care moment, started AFTER the store write has landed:
   * feed = the snack flies in and two chomps; play = the toy bounces twice
   * while the monster hops in sync; pet = a lean in; welcome = a perk-up.
   * Starting a new moment cancels the one in flight. Never touches state.
   */
  careMoment: (kind: CareMomentKind, emoji?: string) => void;
};

export type CareMomentKind = "feed" | "play" | "pet" | "welcome";

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
  /** Short tap. */
  onPress: () => void;
  /** Press-and-hold, fired once per hold after HOLD_DELAY_MS. */
  onLongPress?: () => void;
  /** Positions the monster on screen; the Pressable owns layout. */
  style?: StyleProp<ViewStyle>;
  /**
   * Extra vertical offset driven by the parent (native-driver transform, so
   * Home can make room below the sprite without a layout jump).
   */
  lift?: Animated.Value;
  ref?: Ref<LivingMonsterHandle>;
};

// Touch feel. A tap acknowledges instantly with a squish; a hold leans the
// monster in and, once it counts as a hold, ticks softly under the finger.
export const HOLD_DELAY_MS = 350;
const HOLD_TICK_MS = 180;
const HOLD_TICK_MAX_MS = 1400;

/**
 * Selection feedback is the lightest tick the OS offers. Some test mocks of
 * expo-haptics only provide impactAsync, so check before calling.
 */
function hapticTick() {
  if (typeof Haptics.selectionAsync === "function") {
    void Haptics.selectionAsync();
  }
}

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
  onLongPress,
  style,
  lift,
  ref,
}: Props) {
  // OS "reduce motion": every continuous loop below stays parked. Short,
  // player-triggered reactions (the tap bounce) still run.
  const reduceMotion = useReduceMotion();

  // Animated values shared between the idle loops, touch, and care moments.
  // Declared up front so every section below can reach them.
  const squishAnim = useRef(new Animated.Value(0)).current; // tap / chomp
  const leanAnim = useRef(new Animated.Value(0)).current; // hold / pet
  const hopAnim = useRef(new Animated.Value(0)).current; // idle perk-up
  // Care moments hop on their own value: the idle perk-up effect resets
  // hopAnim whenever mood changes, and a care action changes mood.
  const careHopAnim = useRef(new Animated.Value(0)).current;

  // ── Touch: squish on tap, lean while held ──────────────────────────────
  const holdTickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const holdStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopHoldTicks = () => {
    if (holdTickRef.current) {
      clearInterval(holdTickRef.current);
      holdTickRef.current = null;
    }
    if (holdStopRef.current) {
      clearTimeout(holdStopRef.current);
      holdStopRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      stopHoldTicks();
      squishAnim.setValue(0);
      leanAnim.setValue(0);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePress = () => {
    hapticTick();
    Animated.sequence([
      Animated.timing(squishAnim, {
        toValue: 1,
        duration: 70,
        useNativeDriver: true,
      }),
      Animated.timing(squishAnim, {
        toValue: 0,
        duration: 110,
        useNativeDriver: true,
      }),
    ]).start();
    onPress();
  };

  const handlePressIn = () => {
    Animated.timing(leanAnim, {
      toValue: 1,
      duration: 260,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    stopHoldTicks();
    Animated.spring(leanAnim, {
      toValue: 0,
      tension: 80,
      friction: 7,
      useNativeDriver: true,
    }).start();
  };

  const handleLongPress = () => {
    // Soft ticks under the finger for as long as the hold lasts (bounded),
    // purely for feel. The pet itself fires exactly once, right here.
    stopHoldTicks();
    hapticTick();
    holdTickRef.current = setInterval(hapticTick, HOLD_TICK_MS);
    holdStopRef.current = setTimeout(stopHoldTicks, HOLD_TICK_MAX_MS);
    onLongPress?.();
  };

  // ── Tap bounce ─────────────────────────────────────────────────────────
  const tapScaleAnim = useRef(new Animated.Value(1)).current;

  const bounce = () => {
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
  };

  useEffect(() => {
    return () => {
      // PERFORMANCE: Reset animation values on cleanup to prevent leaks
      tapScaleAnim.setValue(1);
    };
  }, [tapScaleAnim]);

  // ── Care moments ───────────────────────────────────────────────────────
  // The "prop" is the snack or toy emoji that flies in / bounces. Only one
  // moment runs at a time; a new one stops the old one cold and resets.
  const [prop, setProp] = useState<{
    char: string;
    kind: "feed" | "play";
  } | null>(null);
  const propY = useRef(new Animated.Value(0)).current;
  const propScale = useRef(new Animated.Value(1)).current;
  const propOpacity = useRef(new Animated.Value(0)).current;
  const momentRef = useRef<Animated.CompositeAnimation | null>(null);
  const mountedRef = useRef(true);

  const stopMoment = () => {
    momentRef.current?.stop();
    momentRef.current = null;
    propOpacity.setValue(0);
    propY.setValue(0);
    propScale.setValue(1);
    careHopAnim.setValue(0);
  };

  const runMoment = (anim: Animated.CompositeAnimation, done?: () => void) => {
    momentRef.current = anim;
    anim.start(() => {
      if (momentRef.current === anim) momentRef.current = null;
      if (mountedRef.current) done?.();
    });
  };

  const t = (
    value: Animated.Value,
    toValue: number,
    duration: number,
  ): Animated.CompositeAnimation =>
    Animated.timing(value, { toValue, duration, useNativeDriver: true });

  const careMoment = (kind: CareMomentKind, emoji?: string) => {
    stopMoment();
    if (reduceMotion) {
      setProp(null);
      bounce();
      return;
    }
    switch (kind) {
      case "feed": {
        setProp({ char: emoji ?? "🍪", kind: "feed" });
        propY.setValue(-size * 0.95);
        propScale.setValue(1);
        propOpacity.setValue(1);
        runMoment(
          Animated.sequence([
            Animated.parallel([
              t(propY, -size * 0.3, 420),
              t(propScale, 0.55, 420),
            ]),
            t(propOpacity, 0, 110),
            // Two chomps.
            t(squishAnim, 1, 110),
            t(squishAnim, 0, 120),
            t(squishAnim, 1, 110),
            t(squishAnim, 0, 140),
          ]),
          () => setProp(null),
        );
        return;
      }
      case "play": {
        setProp({ char: emoji ?? "🧶", kind: "play" });
        propY.setValue(0);
        propScale.setValue(1);
        propOpacity.setValue(1);
        const bounceOnce = () =>
          Animated.sequence([
            Animated.parallel([
              t(propY, -size * 0.36, 210),
              t(careHopAnim, -PERK_HEIGHT, 190),
            ]),
            Animated.parallel([t(propY, 0, 230), t(careHopAnim, 0, 220)]),
          ]);
        runMoment(
          Animated.sequence([
            bounceOnce(),
            bounceOnce(),
            t(propOpacity, 0, 160),
          ]),
          () => setProp(null),
        );
        return;
      }
      case "pet": {
        setProp(null);
        runMoment(
          Animated.sequence([
            t(leanAnim, 1, 220),
            Animated.delay(380),
            Animated.spring(leanAnim, {
              toValue: 0,
              tension: 70,
              friction: 7,
              useNativeDriver: true,
            }),
          ]),
        );
        return;
      }
      case "welcome": {
        setProp(null);
        runMoment(
          Animated.sequence([
            t(careHopAnim, -PERK_HEIGHT - 6, 170),
            t(careHopAnim, 0, 220),
            t(careHopAnim, -PERK_HEIGHT * 0.6, 140),
            t(careHopAnim, 0, 200),
          ]),
        );
        return;
      }
    }
  };

  useImperativeHandle(ref, () => ({ bounce, careMoment }));

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopMoment();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  const squishX = squishAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.05],
  });
  const squishY = squishAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.93],
  });
  const leanRot = leanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "-4deg"],
  });
  const leanScale = leanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.04],
  });

  // Ground shadow follows the body's height: higher off the floor means a
  // smaller, fainter ellipse. Bob and hop both lift the body, so they share
  // one driver.
  const bodyLift = Animated.add(bobAnim, Animated.add(hopAnim, careHopAnim));
  const shadowScale = bodyLift.interpolate({
    inputRange: [-PERK_HEIGHT - 12, 0, 6],
    outputRange: [0.72, 1, 1.05],
    extrapolate: "clamp",
  });
  const shadowOpacity = bodyLift.interpolate({
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
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onLongPress={handleLongPress}
      delayLongPress={HOLD_DELAY_MS}
      style={style}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint="Tap for the care menu. Press and hold to pet."
    >
      <Animated.View
        style={[
          styles.liftWrap,
          lift ? { transform: [{ translateY: lift }] } : null,
        ]}
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
                { translateY: careHopAnim },
                { scale: breathAnim },
                { scale: scaleAnim },
                { scale: evoScaleAnim },
                { scale: tapScaleAnim },
                { scale: leanScale },
                { scaleX: squishX },
                { scaleY: squishY },
                { rotateZ: wiggleRot },
                { rotateZ: sickWobbleRot },
                { rotateZ: glanceRot },
                { rotateZ: leanRot },
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
        {prop ? (
          <Animated.Text
            pointerEvents="none"
            testID={`care-prop-${prop.kind}`}
            style={{
              position: "absolute",
              bottom: size * (prop.kind === "feed" ? 0.42 : 0.06),
              fontSize: Math.round(size * 0.2),
              opacity: propOpacity,
              transform: [{ translateY: propY }, { scale: propScale }],
            }}
          >
            {prop.char}
          </Animated.Text>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  liftWrap: {
    alignItems: "center",
  },
});
