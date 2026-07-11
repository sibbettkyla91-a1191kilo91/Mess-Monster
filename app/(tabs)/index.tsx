import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Image,
  ImageBackground,
  ImageSourcePropType,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { ThemedText } from "@/components/themed-text";
import { getDecorSlot } from "@/store/decor-slots";
import { AdultVariant, EvolutionStage } from "@/store/types";
import { PetMood, deriveMood, usePetStore } from "@/store/use-pet-store";
import { usePlayerStore } from "@/store/use-player-store";
import { useStoreStore } from "@/store/use-store-store";
import { useTasksStore } from "@/store/use-tasks-store";
import { localDayString } from "@/utils/local-day";

// ─── Stage labels ────────────────────────────────────────────────────────

const STAGE_LABELS: Record<EvolutionStage, string> = {
  egg: "Egg",
  baby: "Baby",
  teen: "Teen",
  adult: "Adult",
  ascended: "???",
};

// ─── Dimensions ─────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const HABITAT_WIDTH = SCREEN_WIDTH;
const IMAGE_SIZE = Math.round(HABITAT_WIDTH * 0.55);

// ─── Theme ───────────────────────────────────────────────────────────

const THEMES = {
  nilly: {
    background: "#f0faf5",
    accent: "#52b788",
    text: "#2d3436",
    cardBg: "#ffffff",
    pillText: "#ffffff",
    cardBorder: "rgba(0,0,0,0.07)",
    radialColor: "rgba(155,230,195,0.18)",
    glowColor: "rgba(82,183,136,0.13)",
    particleColor: "#3aab6f",
    barTrack: "rgba(0,0,0,0.10)",
    panelBg: "rgba(240,250,245,0.88)",
  },
  luna: {
    background: "#1a1a2e",
    accent: "#cc2222",
    text: "#f0e6d3",
    cardBg: "#2a2a3e",
    pillText: "#f0e6d3",
    cardBorder: "rgba(255,255,255,0.09)",
    radialColor: "rgba(60,20,80,0.22)",
    glowColor: "rgba(90,35,160,0.16)",
    particleColor: "#d8c0ff",
    barTrack: "rgba(255,255,255,0.12)",
    panelBg: "rgba(10,10,20,0.82)",
  },
} as const;

// ─── Mood config ─────────────────────────────────────────────────────────

const MOOD_CONFIG = {
  nilly: {
    thriving: {
      label: "Thriving",
      message:
        "Nilly is absolutely thriving! She loves how clean everything is.",
    },
    happy: {
      label: "Happy",
      message: "Nilly is happy and content. Keep up the good work!",
    },
    neutral: {
      label: "Neutral",
      message: "Nilly could use some attention. Maybe tackle a quick task?",
    },
    sad: {
      label: "Sad",
      message: "Nilly is feeling neglected… she misses seeing you clean.",
    },
    sick: {
      label: "Sad",
      message: "Nilly is really struggling. Even a small task will help her feel better.",
    },
  },
  luna: {
    thriving: {
      label: "Thriving",
      message:
        "Luna is radiant. The realm is spotless and her power is at its peak.",
    },
    happy: {
      label: "Happy",
      message: "Luna is pleased. The chaos is under control — for now.",
    },
    neutral: {
      label: "Neutral",
      message: "Luna stirs uneasily. The mess grows in the shadows.",
    },
    sad: {
      label: "Sad",
      message: "Luna fades. Neglect weakens her magic — she needs you.",
    },
    sick: {
      label: "Sad",
      message: "Luna's magic dims. A little cleaning is all it takes to bring her back.",
    },
  },
} as const;

// ─── Stage sprite map ───────────────────────────────────────────────────────
// All sprites live in assets/ (root). Adult variants are determined at evolution time.

const STAGE_SPRITES = {
  luna: {
    egg: require("../../assets/images/luna_egg.png"),
    baby: require("../../assets/images/luna_baby.png"),
    teen: require("../../assets/images/luna_teen.png"),
    adult: require("../../assets/images/luna_adult.png"),
    adult_kitchen: require("../../assets/images/luna_adult_kitchen.png"),
    adult_livingroom: require("../../assets/images/luna_adult_livingroom.png"),
    adult_bedroom: require("../../assets/images/luna_adult_bedroom.png"),
    adult_bathroom: require("../../assets/images/luna_adult_bathroom.png"),
    sad_egg: require("../../assets/images/sad_luna_egg.jpg"),
    sad_baby: require("../../assets/images/sad_luna_baby.jpg"),
    sad_teen: require("../../assets/images/sad_luna_teen.jpg"),
  },
  nilly: {
    egg: require("../../assets/images/nilly_egg.png"),
    baby: require("../../assets/images/nilly_baby.png"),
    teen: require("../../assets/images/nilly_teen.png"),
    adult: require("../../assets/images/nilly_adult.png"),
    adult_kitchen: require("../../assets/images/nilly_adult_kitchen.png"),
    adult_livingroom: require("../../assets/images/nilly_adult_livingroom.png"),
    adult_bedroom: require("../../assets/images/nilly_adult_bedroom.png"),
    adult_bathroom: require("../../assets/images/nilly_adult_bathroom.png"),
    sad_egg: require("../../assets/images/sad_nilly_egg.png"),
    sad_baby: require("../../assets/images/sad_nilly_baby.png"),
    sad_teen: require("../../assets/images/sad_nilly_teen.png"),
  },
} as const;

const HABITAT_IMAGES = {
  nilly: require("../../assets/images/nilly-habitat.jpg"),
  luna: require("../../assets/images/luna-habitat.jpg"),
};

function getMonsterSprite(
  monster: "nilly" | "luna",
  stage: EvolutionStage,
  adultVariant: AdultVariant,
  mood: PetMood,
): ImageSourcePropType {
  const sprites = STAGE_SPRITES[monster];
  // Use sad sprite variant for sad or sick mood
  const isSadMood = mood === "sad" || mood === "sick";

  if (stage === "adult" || stage === "ascended") {
    // Ascended shows adult sprite until its own art is implemented
    const key =
      adultVariant === "base"
        ? "adult"
        : (`adult_${adultVariant}` as keyof typeof sprites);
    // No sad variant for adult, fall back to regular adult
    return (sprites[key] ?? sprites.adult) as ImageSourcePropType;
  }

  // For egg, baby, teen: use sad variant if applicable
  if (isSadMood) {
    const sadKey = `sad_${stage}` as keyof typeof sprites;
    const sadSprite = sprites[sadKey];
    if (sadSprite) return sadSprite as ImageSourcePropType;
  }

  return (sprites[stage as keyof typeof sprites] ??
    sprites.egg) as ImageSourcePropType;
}

// ─── Particle definitions ────────────────────────────────────────────────────

interface ParticleDef {
  id: string;
  x: number;
  y: number;
  char: string;
  size: number;
  opacity: number;
  duration: number;
  delay: number;
  driftY: number;
}

const LUNA_PARTICLES: ParticleDef[] = [
  {
    id: "l1",
    x: 0.06,
    y: 0.11,
    char: "★",
    size: 14,
    opacity: 0.55,
    duration: 3400,
    delay: 0,
    driftY: 18,
  },
  {
    id: "l2",
    x: 0.83,
    y: 0.08,
    char: "★",
    size: 9,
    opacity: 0.4,
    duration: 4200,
    delay: 600,
    driftY: 12,
  },
  {
    id: "l3",
    x: 0.46,
    y: 0.05,
    char: "✦",
    size: 7,
    opacity: 0.35,
    duration: 5000,
    delay: 1200,
    driftY: 10,
  },
  {
    id: "l4",
    x: 0.14,
    y: 0.35,
    char: "★",
    size: 10,
    opacity: 0.3,
    duration: 3800,
    delay: 400,
    driftY: 14,
  },
  {
    id: "l5",
    x: 0.79,
    y: 0.3,
    char: "✦",
    size: 12,
    opacity: 0.45,
    duration: 4600,
    delay: 900,
    driftY: 16,
  },
  {
    id: "l6",
    x: 0.91,
    y: 0.53,
    char: "★",
    size: 8,
    opacity: 0.35,
    duration: 3200,
    delay: 1800,
    driftY: 10,
  },
  {
    id: "l7",
    x: 0.03,
    y: 0.59,
    char: "✧",
    size: 11,
    opacity: 0.28,
    duration: 4800,
    delay: 2200,
    driftY: 14,
  },
  {
    id: "l8",
    x: 0.26,
    y: 0.19,
    char: "·",
    size: 20,
    opacity: 0.5,
    duration: 3600,
    delay: 300,
    driftY: 22,
  },
  {
    id: "l9",
    x: 0.68,
    y: 0.14,
    char: "·",
    size: 16,
    opacity: 0.38,
    duration: 4400,
    delay: 700,
    driftY: 16,
  },
  {
    id: "l10",
    x: 0.54,
    y: 0.68,
    char: "✦",
    size: 9,
    opacity: 0.25,
    duration: 5200,
    delay: 1500,
    driftY: 12,
  },
];

const NILLY_PARTICLES: ParticleDef[] = [
  {
    id: "n1",
    x: 0.07,
    y: 0.09,
    char: "✦",
    size: 12,
    opacity: 0.48,
    duration: 3200,
    delay: 0,
    driftY: 16,
  },
  {
    id: "n2",
    x: 0.86,
    y: 0.12,
    char: "✦",
    size: 8,
    opacity: 0.38,
    duration: 4000,
    delay: 500,
    driftY: 12,
  },
  {
    id: "n3",
    x: 0.5,
    y: 0.05,
    char: "✧",
    size: 10,
    opacity: 0.33,
    duration: 5200,
    delay: 1000,
    driftY: 10,
  },
  {
    id: "n4",
    x: 0.13,
    y: 0.36,
    char: "✦",
    size: 9,
    opacity: 0.28,
    duration: 3800,
    delay: 800,
    driftY: 14,
  },
  {
    id: "n5",
    x: 0.81,
    y: 0.32,
    char: "✧",
    size: 11,
    opacity: 0.38,
    duration: 4600,
    delay: 1400,
    driftY: 15,
  },
  {
    id: "n6",
    x: 0.21,
    y: 0.17,
    char: "○",
    size: 10,
    opacity: 0.2,
    duration: 4200,
    delay: 300,
    driftY: 18,
  },
  {
    id: "n7",
    x: 0.73,
    y: 0.23,
    char: "○",
    size: 8,
    opacity: 0.16,
    duration: 5000,
    delay: 1600,
    driftY: 14,
  },
  {
    id: "n8",
    x: 0.89,
    y: 0.49,
    char: "○",
    size: 13,
    opacity: 0.18,
    duration: 3600,
    delay: 2000,
    driftY: 12,
  },
  {
    id: "n9",
    x: 0.04,
    y: 0.54,
    char: "🍃",
    size: 14,
    opacity: 0.35,
    duration: 4800,
    delay: 600,
    driftY: 20,
  },
  {
    id: "n10",
    x: 0.93,
    y: 0.43,
    char: "🍃",
    size: 11,
    opacity: 0.28,
    duration: 3400,
    delay: 1800,
    driftY: 14,
  },
];

// ─── FloatingParticle ───────────────────────────────────────────────────────

function FloatingParticle({ def, color }: { def: ParticleDef; color: string }) {
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(def.opacity * 0.3)).current;

  useEffect(() => {
    const yLoop = Animated.loop(
      Animated.sequence([
        Animated.delay(def.delay),
        Animated.timing(translateY, {
          toValue: -def.driftY,
          duration: def.duration / 2,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: def.duration / 2,
          useNativeDriver: true,
        }),
      ]),
    );
    const opacityLoop = Animated.loop(
      Animated.sequence([
        Animated.delay(def.delay),
        Animated.timing(opacity, {
          toValue: def.opacity,
          duration: def.duration * 0.55,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: def.opacity * 0.18,
          duration: def.duration * 0.45,
          useNativeDriver: true,
        }),
      ]),
    );
    yLoop.start();
    opacityLoop.start();
    return () => {
      yLoop.stop();
      opacityLoop.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.Text
      style={{
        position: "absolute",
        left: def.x * SCREEN_WIDTH,
        top: def.y * SCREEN_HEIGHT,
        fontSize: def.size,
        color,
        opacity,
        transform: [{ translateY }],
      }}
    >
      {def.char}
    </Animated.Text>
  );
}

// ─── DecorLayer ───────────────────────────────────────────────────────────
// Placed decor items rendered at their fixed slots, behind the monster.
// Slot geometry comes from store/decor-slots.ts; each slot shows the item's
// sprite art when available, otherwise its catalog emoji.

function DecorLayer({ monster }: { monster: "nilly" | "luna" }) {
  const owned = useStoreStore((s) => s.owned);
  const placed = useStoreStore((s) => s.placed);

  const placedIds = Object.keys(placed).filter(
    (id) => (owned[id]?.quantity ?? 0) > 0,
  );

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {placedIds.map((id) => {
        const slot = getDecorSlot(id, monster);
        if (!slot) return null;
        const sizePx = Math.round(slot.size * SCREEN_WIDTH);
        return (
          <View
            key={id}
            style={{
              position: "absolute",
              left: slot.x * SCREEN_WIDTH - sizePx / 2,
              top: slot.y * SCREEN_HEIGHT - sizePx / 2,
              width: sizePx,
              height: sizePx,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {slot.image ? (
              <Image
                source={slot.image}
                style={{ width: "100%", height: "100%" }}
                resizeMode="contain"
              />
            ) : (
              <Text style={{ fontSize: sizePx * 0.7 }}>
                {owned[id].item.emoji}
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

// ─── MonsterHabitat ───────────────────────────────────────────────────────

function MonsterHabitat({ monster }: { monster: "nilly" | "luna" }) {
  const particles = monster === "luna" ? LUNA_PARTICLES : NILLY_PARTICLES;
  const theme = THEMES[monster];

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {particles.map((def) => (
        <FloatingParticle key={def.id} def={def} color={theme.particleColor} />
      ))}
    </View>
  );
}

// ─── TapReactionHeart ─────────────────────────────────────────────────────
// Floating heart that appears when pet is tapped; animates upward and fades

function TapReactionHeart({ x, y }: { x: number; y: number }) {
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -80,
        duration: 1200,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 1200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [translateY, opacity]);

  return (
    <Animated.Text
      style={{
        position: "absolute",
        left: x,
        top: y,
        fontSize: 32,
        opacity,
        transform: [{ translateY }],
      }}
    >
      ❤️
    </Animated.Text>
  );
}

// ─── StatBar ──────────────────────────────────────────────────────────

function StatBar({
  icon,
  label,
  value,
  color,
  trackColor,
}: {
  icon: string;
  label: string;
  value: number;
  color: string;
  trackColor: string;
}) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: value,
      duration: 600,
      useNativeDriver: false,
    }).start();
  }, [value, anim]);

  const widthPct = anim.interpolate({
    inputRange: [0, 100],
    outputRange: ["0%", "100%"],
  });

  return (
    <View style={barStyles.row}>
      <View style={barStyles.labelRow}>
        <Text style={barStyles.icon}>{icon}</Text>
        <Text style={[barStyles.label, { color }]}>{label}</Text>
        <Text style={[barStyles.value, { color }]}>{Math.round(value)}</Text>
      </View>
      <View style={[barStyles.track, { backgroundColor: trackColor }]}>
        <Animated.View
          style={[barStyles.fill, { width: widthPct, backgroundColor: color }]}
        />
      </View>
    </View>
  );
}

const barStyles = StyleSheet.create({
  row: { gap: 5 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  icon: { fontSize: 13 },
  label: { flex: 1, fontSize: 13, fontWeight: "600", letterSpacing: 0.2 },
  value: { fontSize: 13, fontWeight: "700", opacity: 0.75 },
  track: { height: 8, borderRadius: 4, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 4 },
});

// ─── EvolutionCelebration ────────────────────────────────────────────────────

function EvolutionCelebration({
  stage,
  monsterName,
  theme,
  onDismiss,
}: {
  stage: EvolutionStage;
  monsterName: string;
  theme: (typeof THEMES)[keyof typeof THEMES];
  onDismiss: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(0.4)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 55,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();

    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    glowLoop.start();

    const t = setTimeout(onDismiss, 4200);
    return () => {
      glowLoop.stop();
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const glowScale = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.06],
  });

  return (
    <Pressable
      style={[StyleSheet.absoluteFillObject, evolutionStyles.overlay]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onDismiss();
      }}
      accessibilityRole="button"
      accessibilityLabel="Evolution celebration — tap to continue"
    >
      <Animated.View
        style={[
          evolutionStyles.card,
          {
            backgroundColor: theme.cardBg,
            borderColor: theme.accent,
            transform: [{ scale: scaleAnim }],
            opacity: opacityAnim,
            shadowColor: theme.accent,
          },
        ]}
      >
        <Animated.Text
          style={[evolutionStyles.emoji, { transform: [{ scale: glowScale }] }]}
        >
          ✨
        </Animated.Text>
        <ThemedText style={[evolutionStyles.title, { color: theme.accent }]}>
          Evolution!
        </ThemedText>
        <ThemedText style={[evolutionStyles.stageName, { color: theme.text }]}>
          {monsterName} evolved into {STAGE_LABELS[stage]}!
        </ThemedText>
        <ThemedText style={[evolutionStyles.hint, { color: theme.text }]}>
          Tap to continue
        </ThemedText>
      </Animated.View>
    </Pressable>
  );
}

const evolutionStyles = StyleSheet.create({
  overlay: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
    zIndex: 100,
  },
  card: {
    width: SCREEN_WIDTH * 0.82,
    borderRadius: 24,
    borderWidth: 2,
    padding: 28,
    alignItems: "center",
    gap: 10,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 24,
    elevation: 20,
  },
  emoji: { fontSize: 56 },
  title: { fontSize: 28, fontWeight: "800", letterSpacing: 0.6 },
  stageName: {
    fontSize: 17,
    fontWeight: "500",
    textAlign: "center",
    opacity: 0.9,
  },
  hint: { fontSize: 13, opacity: 0.5, marginTop: 4 },
});

// ─── PremiumGateModal ───────────────────────────────────────────────────────

function PremiumGateModal({
  stage,
  theme,
  onDismiss,
  onUpgrade,
}: {
  stage: EvolutionStage;
  theme: (typeof THEMES)[keyof typeof THEMES];
  onDismiss: () => void;
  onUpgrade: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 60,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stageName = stage.charAt(0).toUpperCase() + stage.slice(1);

  return (
    <Pressable
      style={[StyleSheet.absoluteFillObject, evolutionStyles.overlay]}
      onPress={onDismiss}
      accessibilityRole="button"
      accessibilityLabel="Premium upgrade modal — tap outside to dismiss"
    >
      <Animated.View
        style={[
          evolutionStyles.card,
          {
            backgroundColor: theme.cardBg,
            borderColor: theme.accent,
            transform: [{ scale: scaleAnim }],
            opacity: opacityAnim,
            shadowColor: theme.accent,
          },
        ]}
        // Prevent tap-through to the backdrop dismiss
        onStartShouldSetResponder={() => true}
      >
        <Text style={[evolutionStyles.emoji]}>🔒</Text>
        <ThemedText style={[evolutionStyles.title, { color: theme.accent }]}>
          Premium Feature
        </ThemedText>
        <ThemedText style={[evolutionStyles.stageName, { color: theme.text }]}>
          {stageName} form and beyond require Premium.
        </ThemedText>
        <ThemedText style={[premiumStyles.body, { color: theme.text }]}>
          Your monster is ready to evolve! Unlock Adult and a mysterious locked
          form by upgrading to Premium (~$4.99/month).
        </ThemedText>
        <Pressable
          style={[
            premiumStyles.upgradeButton,
            { backgroundColor: theme.accent },
          ]}
          onPress={onUpgrade}
          accessibilityRole="button"
          accessibilityLabel="Upgrade to Premium"
        >
          <ThemedText
            style={[premiumStyles.upgradeButtonText, { color: theme.pillText }]}
          >
            Upgrade to Premium
          </ThemedText>
        </Pressable>
        <Pressable onPress={onDismiss} style={premiumStyles.dismissButton}>
          <ThemedText
            style={[premiumStyles.dismissText, { color: theme.text }]}
          >
            Maybe later
          </ThemedText>
        </Pressable>
      </Animated.View>
    </Pressable>
  );
}

const premiumStyles = StyleSheet.create({
  body: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    opacity: 0.75,
  },
  upgradeButton: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 28,
    alignItems: "center",
    width: "100%",
    marginTop: 4,
  },
  upgradeButtonText: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  dismissButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  dismissText: {
    fontSize: 14,
    opacity: 0.55,
  },
});

// ─── HomeScreen ───────────────────────────────────────────────────────

export default function HomeScreen() {
  const health = usePetStore((s) => s.health);
  const happiness = usePetStore((s) => s.happiness);
  const evolutionStage = usePetStore((s) => s.evolutionStage);
  const adultVariant = usePetStore((s) => s.adultVariant);
  const pendingMilestoneBanner = usePetStore((s) => s.pendingMilestoneBanner);
  const pendingEvolution = usePetStore((s) => s.pendingEvolution);
  const pendingPremiumGate = usePetStore((s) => s.pendingPremiumGate);
  const clearMilestoneBanner = usePetStore((s) => s.clearMilestoneBanner);
  const clearPendingEvolution = usePetStore((s) => s.clearPendingEvolution);
  const clearPremiumGate = usePetStore((s) => s.clearPremiumGate);
  const recheckEvolution = usePetStore((s) => s.recheckEvolution);

  const availablePoints = usePlayerStore((s) => s.availablePointsValue);
  const streak = usePlayerStore((s) => s.streak);
  const selectedMonster = usePlayerStore((s) => s.selectedMonster) ?? "nilly";
  const monsterName = usePlayerStore((s) => s.monsterName);
  const setPremium = usePlayerStore((s) => s.setPremium);
  const isPremium = usePlayerStore((s) => s.isPremium);
  const router = useRouter();

  // Manual entry point for the upgrade modal — the auto-popup only shows
  // once per stage, so non-premium users need a way to reopen it anytime.
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const tasks = useTasksStore((s) => s.tasks);

  const [panelHeight, setPanelHeight] = useState(0);

  // Tap-to-react state
  const [tapHearts, setTapHearts] = useState<
    Array<{ id: string; x: number; y: number }>
  >([]);
  const tapScaleAnim = useRef(new Animated.Value(1)).current;
  const recordTapReaction = usePlayerStore((s) => s.recordTapReaction);
  const addHappiness = usePetStore((s) => s.addHappiness);

  // Count tasks completed today (local calendar day)
  const todayLocal = localDayString();
  const doneToday = tasks.filter(
    (t) =>
      t.completedAt && localDayString(new Date(t.completedAt)) === todayLocal,
  ).length;

  const mood = deriveMood(health, happiness);

  const monster = selectedMonster === "luna" ? "luna" : "nilly";
  const theme = THEMES[monster];
  // Display sick as sad to player (internal state stays sick for effects)
  const displayMood = mood === "sick" ? "sad" : mood;
  const moodCfg = MOOD_CONFIG[monster][displayMood];

  const displayName = monsterName || (monster === "nilly" ? "Nilly" : "Luna");

  // ── Tap-to-react handler ────────────────────────────────────────────────────
  const handlePetTap = () => {
    const canTap = recordTapReaction();
    if (!canTap) return; // Tap limit reached, do nothing

    // Trigger haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Trigger bounce animation
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

    // Boost happiness (no points — tapping is affection, not cleaning)
    addHappiness(3);

    // Create heart animation at center of pet
    const heartId = `heart-${Date.now()}`;
    setTapHearts((prev) => [
      ...prev,
      {
        id: heartId,
        x: SCREEN_WIDTH / 2 - 16,
        y: SCREEN_HEIGHT * 0.35,
      },
    ]);

    // Remove heart after animation completes
    setTimeout(() => {
      setTapHearts((prev) => prev.filter((h) => h.id !== heartId));
    }, 1200);
  };

  // ── Bob ────────────────────────────────────────────────────────────────────
  const bobAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    return () => {
      // PERFORMANCE: Reset animation values on cleanup to prevent leaks
      tapScaleAnim.setValue(1);
    };
  }, [tapScaleAnim]);

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

  // ── Wiggle ──────────────────────────────────────────────────────────
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Thriving scale-pulse ────────────────────────────────��──────────────────
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

  // ── Evolution glow pulse (adult / ascended) ────────────────────────────────
  const evoScaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const isAdult = evolutionStage === "adult" || evolutionStage === "ascended";
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
  }, [evolutionStage, evoScaleAnim]);

  // ── Milestone banner auto-dismiss ─────────────────────────────────────────
  useEffect(() => {
    if (!pendingMilestoneBanner) return;
    const t = setTimeout(clearMilestoneBanner, 3000);
    return () => clearTimeout(t);
  }, [pendingMilestoneBanner, clearMilestoneBanner]);

  // ── Sick wobble ─────────────────────────────────────────────────────────
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
    evolutionStage === "egg" ? 0.75 : 1,
    mood === "neutral" || mood === "sick" ? 0.75 : 1,
  );

  // Stage-based shadow intensity
  const isAdult = evolutionStage === "adult" || evolutionStage === "ascended";
  const shadowStyle = isAdult
    ? {
        shadowColor: theme.accent,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.75,
        shadowRadius: 30,
        elevation: Platform.OS === "android" ? 0 : 14,
      }
    : evolutionStage === "teen"
      ? {
          shadowColor: theme.accent,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.45,
          shadowRadius: 18,
          elevation: Platform.OS === "android" ? 0 : 8,
        }
      : null;

  const monsterSource = getMonsterSprite(
    monster,
    evolutionStage,
    adultVariant,
    mood,
  );

  return (
    <View style={styles.container}>
      {/* ── Full-screen habitat background ── */}
      <ImageBackground
        source={HABITAT_IMAGES[monster]}
        style={StyleSheet.absoluteFillObject}
        resizeMode="cover"
      />

      {/* ── Placed decor items ── */}
      <DecorLayer monster={monster} />

      {/* ── Floating particles overlay ── */}
      <MonsterHabitat monster={monster} />

      {/* ── Top pills ── */}
      <View style={styles.topBar}>
        <View style={styles.pillScrim}>
          <ThemedText style={[styles.pillText, { color: theme.pillText }]}>
            ⭐ {availablePoints} pts
          </ThemedText>
        </View>
        {streak > 0 && (
          <View style={styles.pillScrim}>
            <ThemedText style={[styles.pillText, { color: theme.pillText }]}>
              🔥 {streak}d streak
            </ThemedText>
          </View>
        )}
        {doneToday > 0 && (
          <View style={styles.pillScrim}>
            <ThemedText style={[styles.pillText, { color: theme.pillText }]}>
              ✓ {doneToday}/6 done
            </ThemedText>
          </View>
        )}
      </View>

      {/* ── Monster ── */}
      {/* Positioning lives on the Pressable: position "absolute" anchors to
          the direct parent in RN, so it must sit on the container's child —
          on the inner Animated.View it would anchor to the zero-height
          Pressable and render offscreen. */}
      <Pressable
        onPress={handlePetTap}
        style={[
          styles.monsterImageWrapper,
          panelHeight > 0 && { bottom: panelHeight + 16 },
        ]}
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
          <Image
            source={monsterSource}
            style={styles.monsterImage}
            resizeMode="contain"
          />
        </Animated.View>
      </Pressable>

      {/* ── Tap reaction hearts ── */}
      {tapHearts.map((heart) => (
        <TapReactionHeart key={heart.id} x={heart.x} y={heart.y} />
      ))}

      {/* ── Bottom panel ── */}
      <View
        style={[styles.bottomPanel, { backgroundColor: theme.panelBg }]}
        onLayout={(e) => setPanelHeight(e.nativeEvent.layout.height)}
      >
        <View style={styles.nameRow}>
          <ThemedText style={[styles.monsterName, { color: theme.text }]}>
            {displayName}
          </ThemedText>
          <View
            style={[styles.stagePill, { backgroundColor: theme.accent + "33" }]}
          >
            <ThemedText style={[styles.stageLabel, { color: theme.accent }]}>
              {STAGE_LABELS[evolutionStage]}
            </ThemedText>
          </View>
          {!isPremium && (
            <Pressable
              style={({ pressed }) => [
                styles.unlockButton,
                { borderColor: theme.accent, opacity: pressed ? 0.7 : 1 },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowUpgradeModal(true);
              }}
              accessibilityRole="button"
              accessibilityLabel="Learn about Premium"
            >
              <ThemedText
                style={[styles.unlockButtonText, { color: theme.accent }]}
              >
                ✨ Unlock more
              </ThemedText>
            </Pressable>
          )}
        </View>

        <View style={styles.statBars}>
          <StatBar
            icon="❤️"
            label="Health"
            value={health}
            color={theme.accent}
            trackColor={theme.barTrack}
          />
          <StatBar
            icon="✨"
            label="Happiness"
            value={happiness}
            color={theme.particleColor}
            trackColor={theme.barTrack}
          />
        </View>

        <View style={styles.moodSection}>
          <ThemedText style={[styles.moodLabel, { color: theme.accent }]}>
            {moodCfg.label}
          </ThemedText>
          <ThemedText style={[styles.moodMessage, { color: theme.text }]}>
            {moodCfg.message}
          </ThemedText>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.ctaButton,
            { backgroundColor: theme.accent, opacity: pressed ? 0.82 : 1 },
          ]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.navigate("/(tabs)/explore");
          }}
          accessibilityRole="button"
          accessibilityLabel="Go clean something"
        >
          <ThemedText style={[styles.ctaText, { color: theme.pillText }]}>
            Clean Something →
          </ThemedText>
        </Pressable>
      </View>

      {/* ── Streak milestone banner ── */}
      {pendingMilestoneBanner !== null && (
        <Pressable
          style={[styles.milestoneBanner, { backgroundColor: theme.accent }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            clearMilestoneBanner();
          }}
          accessibilityRole="button"
          accessibilityLabel={`${pendingMilestoneBanner}-day streak milestone`}
        >
          <ThemedText
            style={[styles.milestoneBannerText, { color: theme.pillText }]}
          >
            🔥 {pendingMilestoneBanner}-day streak! +50 bonus points
          </ThemedText>
        </Pressable>
      )}

      {/* ── Evolution celebration overlay ── */}
      {pendingEvolution !== null && (
        <EvolutionCelebration
          stage={pendingEvolution}
          monsterName={displayName}
          theme={theme}
          onDismiss={clearPendingEvolution}
        />
      )}

      {/* ── Premium gate modal (auto-popup or manual "Unlock more") ── */}
      {(pendingPremiumGate !== null || showUpgradeModal) && (
        <PremiumGateModal
          stage={pendingPremiumGate ?? "adult"}
          theme={theme}
          onDismiss={() => {
            clearPremiumGate();
            setShowUpgradeModal(false);
          }}
          onUpgrade={() => {
            // Placeholder: set premium true; real IAP wired in a future update
            setPremium(true);
            clearPremiumGate();
            setShowUpgradeModal(false);
            recheckEvolution();
          }}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 54,
    paddingHorizontal: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  pillScrim: {
    backgroundColor: "rgba(0,0,0,0.25)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  pillText: {
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  monsterImageWrapper: {
    position: "absolute",
    bottom: "25%",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  monsterImage: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    aspectRatio: 1,
  },
  bottomPanel: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
    paddingBottom: 28,
    gap: 12,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  monsterName: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  stagePill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  stageLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  unlockButton: {
    marginLeft: "auto",
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  unlockButtonText: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  statBars: {
    gap: 8,
  },
  moodSection: {
    gap: 4,
  },
  moodLabel: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  moodMessage: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.85,
  },
  ctaButton: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 6,
  },
  ctaText: {
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  milestoneBanner: {
    position: "absolute",
    bottom: 220,
    left: 24,
    right: 24,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 12,
  },
  milestoneBannerText: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});
