import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Image,
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  BURST_DURATION_MS,
  BurstKind,
  BurstParticles,
  MAX_CONCURRENT_BURSTS,
} from "@/components/burst-particles";
import {
  LivingMonster,
  LivingMonsterHandle,
} from "@/components/living-monster";
import { PetInteractMenu } from "@/components/pet-interact-menu";
import { ThemedText } from "@/components/themed-text";
import { FOUNDING_MEMBER_PURCHASE_ENABLED } from "@/constants/feature-flags";
import { useHasHydrated } from "@/hooks/use-has-hydrated";
import { useReduceMotion } from "@/hooks/use-reduce-motion";
import { LUNA_PALETTE, MonsterPalette, NILLY_PALETTE } from "@/monster-theme";
import { getDecorSlot } from "@/store/decor-slots";
import { getItemArt } from "@/store/item-art";
import { useIsPremium } from "@/store/premium";
import { executeFeed, executePlay } from "@/store/recover-unsettled-feeds";
import { EvolutionStage } from "@/store/types";
import { currentTimeOfDay, LastAction, pickLine } from "@/store/monster-voice";
import {
  deriveMood,
  PET_HAPPINESS_BOOST,
  PetMood,
  usePetStore,
} from "@/store/use-pet-store";
import { PresetTask } from "@/store/preset-tasks";
import { getItemType } from "@/store/store-items";
import { usePlayerStore } from "@/store/use-player-store";
import { pickTinyDare, useSessionStore } from "@/store/use-session-store";
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
const IMAGE_SIZE = Math.round(HABITAT_WIDTH * 0.72);

// Visible sliver of the bottom panel when collapsed: the panel's top padding
// (16) plus the toggle handle row (20), with a hair of the gap below so the
// rounded corners still read as a sheet edge.
const PANEL_PEEK_HEIGHT = 40;

// ─── Theme ───────────────────────────────────────────────────────────

function homeChrome(p: MonsterPalette) {
  return {
    background: p.page,
    accent: p.accent,
    text: p.ink,
    cardBg: p.surfaceRaised,
    pillText: p.monster === "luna" ? p.ink : "#ffffff",
    cardBorder: p.line,
    radialColor: p.glow,
    glowColor: p.glow,
    particleColor: p.particle,
    barTrack: p.barTrack,
    panelBg: p.panelBg,
    habitatScrim: p.habitatScrim,
  };
}

const THEMES = {
  nilly: homeChrome(NILLY_PALETTE),
  luna: homeChrome(LUNA_PALETTE),
} as const;

// ─── Mood labels ─────────────────────────────────────────────────────────
// Just the word. What the monster has to say about its day comes from the
// talk-back line under the sprite (store/monster-voice.ts), never a verdict.

const MOOD_LABELS: Record<"nilly" | "luna", Record<PetMood, string>> = {
  nilly: {
    thriving: "Settled",
    happy: "Easy",
    neutral: "Waiting",
    sad: "Quiet",
    sick: "Quiet",
  },
  luna: {
    thriving: "Steady",
    happy: "Pleased",
    neutral: "Watching",
    sad: "Dim",
    sick: "Dim",
  },
};

// How long one talk-back line stays up while nothing happens.
const VOICE_IDLE_MS = 15_000;
// Room reserved under the sprite for the talk-back caption.
const VOICE_CAPTION_SPACE = 44;
const MONSTER_BOTTOM_GAP = 16 + VOICE_CAPTION_SPACE;
// Welcome-back "tiny dare" chip: how long it stays, and how far the monster
// lifts (a transform, not layout) to make room for it under the caption.
const DARE_CHIP_MS = 20_000;
const DARE_CHIP_LIFT = 38;

const HABITAT_IMAGES = {
  nilly: require("../../assets/images/nilly-habitat.jpg"),
  luna: require("../../assets/images/luna-habitat.jpg"),
};

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
    char: "✧",
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
    char: "✧",
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
  const owned = useStoreStore((s) => s.byMonster[monster].owned);
  const placed = useStoreStore((s) => s.byMonster[monster].placed);

  const placedIds = Object.keys(placed).filter(
    (id) => (owned[id]?.quantity ?? 0) > 0,
  );

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {placedIds.map((id) => {
        const slot = getDecorSlot(id, monster);
        if (!slot) return null;
        const sizePx = Math.round(slot.size * SCREEN_WIDTH);
        // Registered item art first, then any slot-specific image, then the
        // catalog emoji — the same fallback chain as every other renderer.
        const art = getItemArt(owned[id].item.assetKey) ?? slot.image;
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
            {art ? (
              <Image
                source={art}
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

const FOUNDING_MEMBER_PERKS = [
  { emoji: "🧬", text: "Adult form — plus a secret final form to discover" },
  { emoji: "📝", text: "Custom task lists that fit your home" },
  { emoji: "🎵", text: "Mess Monster Picks — cleaning soundtracks we love" },
];

function PremiumGateModal({
  stage,
  theme,
  onDismiss,
  onUpgrade,
}: {
  /** Stage that triggered the gate, or null when opened from the info pill */
  stage: EvolutionStage | null;
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

  const stageName = stage
    ? stage.charAt(0).toUpperCase() + stage.slice(1)
    : null;

  return (
    <Pressable
      style={[StyleSheet.absoluteFillObject, evolutionStyles.overlay]}
      onPress={onDismiss}
      accessibilityRole="button"
      accessibilityLabel="Founding Member info — tap outside to dismiss"
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
        <Text style={[evolutionStyles.emoji]}>⭐</Text>
        <ThemedText style={[evolutionStyles.title, { color: theme.accent }]}>
          Founding Member
        </ThemedText>
        <ThemedText style={[evolutionStyles.stageName, { color: theme.text }]}>
          {stageName
            ? `Your monster is ready for its ${stageName} form — that one comes with Founding Member.`
            : "A little extra for you and your monster, whenever you feel like it."}
        </ThemedText>
        <View style={premiumStyles.perkList}>
          {FOUNDING_MEMBER_PERKS.map((perk) => (
            <View key={perk.text} style={premiumStyles.perkRow}>
              <Text style={premiumStyles.perkEmoji}>{perk.emoji}</Text>
              <ThemedText
                style={[premiumStyles.perkText, { color: theme.text }]}
              >
                {perk.text}
              </ThemedText>
            </View>
          ))}
        </View>
        <ThemedText style={[premiumStyles.priceLine, { color: theme.accent }]}>
          $24.99/year · Founding Member rate
        </ThemedText>
        <Pressable
          style={[
            premiumStyles.upgradeButton,
            { backgroundColor: theme.accent },
          ]}
          onPress={() => {
            if (!FOUNDING_MEMBER_PURCHASE_ENABLED) return;
            onUpgrade();
          }}
          accessibilityRole="button"
          accessibilityLabel={
            FOUNDING_MEMBER_PURCHASE_ENABLED
              ? "Become a Founding Member"
              : "Founding Member coming soon"
          }
        >
          <ThemedText
            style={[premiumStyles.upgradeButtonText, { color: theme.pillText }]}
          >
            {FOUNDING_MEMBER_PURCHASE_ENABLED
              ? "Become a Founding Member"
              : "Coming soon"}
          </ThemedText>
        </Pressable>
        <Pressable onPress={onDismiss} style={premiumStyles.dismissButton}>
          <ThemedText
            style={[premiumStyles.dismissText, { color: theme.text }]}
          >
            Maybe later
          </ThemedText>
        </Pressable>
        <ThemedText style={[premiumStyles.reassurance, { color: theme.text }]}>
          The free app is yours forever — no pressure, ever.
        </ThemedText>
      </Animated.View>
    </Pressable>
  );
}

const premiumStyles = StyleSheet.create({
  perkList: {
    gap: 10,
    alignSelf: "stretch",
    marginTop: 4,
  },
  perkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  perkEmoji: {
    fontSize: 18,
  },
  perkText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 19,
    opacity: 0.85,
  },
  priceLine: {
    fontSize: 15,
    fontWeight: "700",
    marginTop: 6,
  },
  reassurance: {
    fontSize: 12,
    opacity: 0.5,
    textAlign: "center",
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
  const selectedMonster = usePlayerStore((s) => s.selectedMonster) ?? "nilly";
  const health = usePetStore((s) => s.byMonster[selectedMonster].health);
  const happiness = usePetStore((s) => s.byMonster[selectedMonster].happiness);
  const evolutionStage = usePetStore(
    (s) => s.byMonster[selectedMonster].evolutionStage,
  );
  const adultVariant = usePetStore(
    (s) => s.byMonster[selectedMonster].adultVariant,
  );
  const pendingMilestoneBanner = usePetStore((s) => s.pendingMilestoneBanner);
  const pendingEvolution = usePetStore(
    (s) => s.byMonster[selectedMonster].pendingEvolution,
  );
  const pendingPremiumGate = usePetStore(
    (s) => s.byMonster[selectedMonster].pendingPremiumGate,
  );
  const clearMilestoneBanner = usePetStore((s) => s.clearMilestoneBanner);
  const clearPendingEvolution = usePetStore((s) => s.clearPendingEvolution);
  const clearPremiumGate = usePetStore((s) => s.clearPremiumGate);

  const availablePoints = usePlayerStore((s) => s.totalPoints - s.spentPoints);
  const streak = usePlayerStore((s) => s.streak);
  const monsterName = usePlayerStore((s) => s.monsterName);
  const equipped = useStoreStore((s) => s.byMonster[selectedMonster].equipped);
  const owned = useStoreStore((s) => s.byMonster[selectedMonster].owned);
  const isPremium = useIsPremium();
  const statPanelCollapsed = usePlayerStore((s) => s.statPanelCollapsed);
  const toggleStatPanel = usePlayerStore((s) => s.toggleStatPanel);
  const router = useRouter();

  // Pet taps and the upgrade action write to the player and pet stores; a
  // write landing before AsyncStorage rehydration completes gets clobbered
  // by the hydration merge, so mutating handlers no-op until stores are
  // ready. playerHydrated additionally gates the render — see below.
  const playerHydrated = useHasHydrated(usePlayerStore);
  const petHydrated = useHasHydrated(usePetStore);
  const storeHydrated = useHasHydrated(useStoreStore);
  const hydrated = playerHydrated && petHydrated && storeHydrated;
  // The welcome-back dare reads today's task progress; until that save
  // lands, every task looks untouched and the chip could offer one already
  // finished this morning. Only the hello waits on it.
  const tasksHydrated = useHasHydrated(useTasksStore);

  // Manual entry point for the upgrade modal — the auto-popup only shows
  // once per stage, so non-premium users need a way to reopen it anytime.
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const tasks = useTasksStore((s) => s.tasks);
  const dailyRollSize = useTasksStore((s) => s.dailyRoll.length);
  // Raw state references (never derived arrays) for the welcome-back dare.
  const dailyRoll = useTasksStore((s) => s.dailyRoll);
  const taskProgress = useTasksStore((s) => s.taskProgress);

  // Welcome-back: set by the root layout when the active monster's last
  // session was 4+ hours ago (cold start or foreground return). Consumed here
  // so the hello happens once per return. In-memory only.
  const pendingWelcome = useSessionStore((s) => s.pendingWelcome);
  const consumeWelcome = useSessionStore((s) => s.consumeWelcome);
  const [dare, setDare] = useState<PresetTask | null>(null);
  const dareTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dareLiftAnim = useRef(new Animated.Value(0)).current;

  const [panelHeight, setPanelHeight] = useState(0);
  const insets = useSafeAreaInsets();

  // Stat panel collapse: 0 = expanded, 1 = collapsed to the peek handle.
  // The panel is an absolute overlay on the room, so sliding it down truly
  // reveals habitat pixels (the toy/decor floor slots sit under it) rather
  // than shrinking a box that still reserves the space.
  const collapseAnim = useRef(
    new Animated.Value(statPanelCollapsed ? 1 : 0),
  ).current;
  useEffect(() => {
    Animated.timing(collapseAnim, {
      toValue: statPanelCollapsed ? 1 : 0,
      duration: 320,
      useNativeDriver: true,
    }).start();
  }, [statPanelCollapsed, collapseAnim]);
  const panelTranslateY = collapseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, Math.max(0, panelHeight - PANEL_PEEK_HEIGHT)],
  });
  const grabBarOpacity = collapseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });

  // Tap-to-react state
  const [tapHearts, setTapHearts] = useState<
    { id: string; x: number; y: number }[]
  >([]);
  const monsterRef = useRef<LivingMonsterHandle>(null);
  const reduceMotion = useReduceMotion();
  // Glyph bursts around the monster for care moments. Capped and short-lived;
  // each one is removed on its own timer.
  const [bursts, setBursts] = useState<{ id: string; kind: BurstKind }[]>([]);
  const liveBurstsRef = useRef(0);
  // Monotonic id so two taps in the same millisecond can't collide, and
  // pending heart/burst-removal timers so unmount doesn't leak them.
  const heartSeqRef = useRef(0);
  const heartTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const recordTapReaction = usePlayerStore((s) => s.recordTapReaction);
  const addHappiness = usePetStore((s) => s.addHappiness);
  const [menuOpen, setMenuOpen] = useState(false);
  const [picker, setPicker] = useState<"feed" | "play" | null>(null);
  // Talk-back: the line under the sprite. Local state only — the monster
  // "speaking" never touches a persisted store.
  const [voiceLine, setVoiceLine] = useState<string | null>(null);
  const lastVoiceRef = useRef<string | null>(null);

  const foods = useMemo(() => {
    const list: {
      id: string;
      name: string;
      emoji: string;
      assetKey?: string;
      quantity: number;
    }[] = [];
    for (const entry of Object.values(owned)) {
      if (getItemType(entry.item) === "food" && entry.quantity > 0) {
        list.push({
          id: entry.item.id,
          name: entry.item.name,
          emoji: entry.item.emoji,
          assetKey: entry.item.assetKey,
          quantity: entry.quantity,
        });
      }
    }
    return list;
  }, [owned]);

  const toys = useMemo(() => {
    const list: {
      id: string;
      name: string;
      emoji: string;
      assetKey?: string;
    }[] = [];
    for (const entry of Object.values(owned)) {
      // itemType, not shelf: accessories share the Toys shelf but are worn.
      if (getItemType(entry.item) === "toy" && entry.quantity > 0) {
        list.push({
          id: entry.item.id,
          name: entry.item.name,
          emoji: entry.item.emoji,
          assetKey: entry.item.assetKey,
        });
      }
    }
    return list;
  }, [owned]);

  const closeMenu = () => {
    setMenuOpen(false);
    setPicker(null);
  };

  // Count tasks completed today (local calendar day)
  const todayLocal = localDayString();
  const doneToday = tasks.filter(
    (t) =>
      t.completedAt && localDayString(new Date(t.completedAt)) === todayLocal,
  ).length;

  const mood = deriveMood(health, happiness);

  const monster = selectedMonster === "luna" ? "luna" : "nilly";
  const theme = THEMES[monster];
  const moodLabel = MOOD_LABELS[monster][mood];

  const displayName = monsterName || (monster === "nilly" ? "Nilly" : "Luna");

  // ── Talk-back ──────────────────────────────────────────────────────────────
  // Called from care handlers after the store write has landed: the monster
  // answers what just happened, then idle rotation picks up again from there.
  const speak = (lastAction: LastAction) => {
    const line = pickLine(
      monster,
      {
        mood,
        timeOfDay: currentTimeOfDay(),
        lastAction,
        stage: evolutionStage,
      },
      lastVoiceRef.current,
    );
    lastVoiceRef.current = line;
    setVoiceLine(line);
  };

  // One idle timer. It restarts whenever the line changes, so a care line
  // gets its full turn before the next idle line replaces it. The first line
  // appears as soon as the room is drawn for the right monster.
  useEffect(() => {
    if (!playerHydrated) return;
    const delay = voiceLine === null ? 0 : VOICE_IDLE_MS;
    const t = setTimeout(() => {
      const line = pickLine(
        monster,
        {
          mood,
          timeOfDay: currentTimeOfDay(),
          lastAction: null,
          stage: evolutionStage,
        },
        lastVoiceRef.current,
      );
      lastVoiceRef.current = line;
      setVoiceLine(line);
    }, delay);
    return () => clearTimeout(t);
  }, [voiceLine, playerHydrated, monster, mood, evolutionStage]);

  // ── Welcome-back ───────────────────────────────────────────────────────────
  const dismissDare = () => {
    if (dareTimerRef.current) {
      clearTimeout(dareTimerRef.current);
      dareTimerRef.current = null;
    }
    setDare(null);
  };

  useEffect(() => {
    Animated.timing(dareLiftAnim, {
      toValue: dare ? -DARE_CHIP_LIFT : 0,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [dare, dareLiftAnim]);

  useEffect(
    () => () => {
      if (dareTimerRef.current) clearTimeout(dareTimerRef.current);
    },
    [],
  );

  // Show the hello exactly once per return: perk-up, burst, a welcome line,
  // and — if today's roll has an untouched task — the tiny dare chip. Store
  // reads only; consumeWelcome is the in-memory flag flip.
  const welcomeHandledRef = useRef(false);
  useEffect(() => {
    if (!pendingWelcome) {
      welcomeHandledRef.current = false;
      return;
    }
    // The ref guards Strict Mode's double effect run in development.
    if (!hydrated || !tasksHydrated || welcomeHandledRef.current) return;
    welcomeHandledRef.current = true;
    consumeWelcome();
    monsterRef.current?.careMoment("welcome");
    addBurst("welcome");
    speak("welcome");
    const task = pickTinyDare(dailyRoll, taskProgress);
    if (!task) return;
    if (dareTimerRef.current) clearTimeout(dareTimerRef.current);
    setDare(task);
    dareTimerRef.current = setTimeout(() => {
      dareTimerRef.current = null;
      setDare(null);
    }, DARE_CHIP_MS);
    // Intentionally keyed on the flag alone: the helpers close over the
    // current monster/mood, and pendingWelcome flips false synchronously on
    // the first run, so a re-run cannot double the hello.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingWelcome, hydrated, tasksHydrated]);

  const handleDarePress = () => {
    // Navigation only. No task progress, no points, no writes of any kind.
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    dismissDare();
    router.navigate("/(tabs)/explore");
  };

  // ── Stat panel toggle ───────────────────────────────────────────────────────
  const handleStatPanelToggle = () => {
    // Persisted write — same pre-hydration clobber guard as pet taps.
    if (!hydrated) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleStatPanel();
  };

  // Presentation only. Skipped (not queued) once MAX_CONCURRENT_BURSTS are
  // already on screen, so spamming a care action can't pile up glyphs.
  const addBurst = (kind: BurstKind) => {
    if (liveBurstsRef.current >= MAX_CONCURRENT_BURSTS) return;
    liveBurstsRef.current += 1;
    heartSeqRef.current += 1;
    const id = `burst-${heartSeqRef.current}`;
    setBursts((prev) => [...prev, { id, kind }]);
    const timer = setTimeout(() => {
      heartTimersRef.current.delete(timer);
      liveBurstsRef.current -= 1;
      setBursts((prev) => prev.filter((b) => b.id !== id));
    }, BURST_DURATION_MS);
    heartTimersRef.current.add(timer);
  };

  const playTapReaction = (grantHappiness: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    monsterRef.current?.bounce();

    if (grantHappiness) addHappiness(PET_HAPPINESS_BOOST);

    heartSeqRef.current += 1;
    const heartId = `heart-${heartSeqRef.current}`;
    setTapHearts((prev) => [
      ...prev,
      {
        id: heartId,
        x: SCREEN_WIDTH / 2 - 16,
        y: SCREEN_HEIGHT * 0.35,
      },
    ]);

    const heartTimer = setTimeout(() => {
      heartTimersRef.current.delete(heartTimer);
      setTapHearts((prev) => prev.filter((h) => h.id !== heartId));
    }, 1200);
    heartTimersRef.current.add(heartTimer);
  };

  const handleMonsterPress = () => {
    if (!hydrated) return;
    if (menuOpen) {
      closeMenu();
      return;
    }
    setMenuOpen(true);
    setPicker(null);
  };

  // ── Pet — the one pet mechanic, reached two ways ───────────────────────────
  // The daily allowance caps only the happiness grant (anti-farming) —
  // never the reaction. The monster always acknowledges affection with
  // the bounce, haptic, and heart: a capped pet silently doing nothing
  // reads as "broken", worst of all on a sad monster being comforted.
  const petMonster = () => {
    dismissDare();
    const withinDailyAllowance = recordTapReaction();
    playTapReaction(withinDailyAllowance);
    // Everything from here is presentation, after the write above.
    monsterRef.current?.careMoment("pet");
    addBurst("pet");
    speak("pet");
  };

  // From the care menu's Pet button.
  const handlePetTap = () => {
    if (!hydrated) return;
    petMonster();
    closeMenu();
  };

  // From pressing and holding the monster itself. One hold = one pet; the
  // Pressable never also fires onPress for the same touch, so the menu
  // stays closed. An open menu just closes.
  const handleMonsterHold = () => {
    if (!hydrated) return;
    if (menuOpen) closeMenu();
    petMonster();
  };

  const handleAskFeed = () => {
    if (!hydrated) return;
    setPicker("feed");
  };

  const handleAskPlay = () => {
    if (!hydrated) return;
    setPicker("play");
  };

  // Feed / Play: the store write (executeFeed / executePlay) is immediate
  // and complete before any of the moment starts. The moment is only how the
  // monster shows it — an interrupted one leaves nothing half-applied.
  const handleChooseFeed = (itemId: string) => {
    if (!hydrated) return;
    // Look the emoji up before the consume: the last unit leaves the bag.
    const emoji = owned[itemId]?.item.emoji;
    if (!executeFeed(itemId, monster)) return;
    dismissDare();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    monsterRef.current?.careMoment("feed", emoji);
    addBurst("feed");
    speak("feed");
    closeMenu();
  };

  const handleChoosePlay = (itemId: string) => {
    if (!hydrated) return;
    const emoji = owned[itemId]?.item.emoji;
    if (!executePlay(itemId, monster)) return;
    dismissDare();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    monsterRef.current?.careMoment("play", emoji);
    addBurst("play");
    speak("play");
    closeMenu();
  };

  const handleGoToShop = () => {
    closeMenu();
    router.navigate("/(tabs)/store");
  };

  useEffect(() => {
    const heartTimers = heartTimersRef.current;
    return () => {
      heartTimers.forEach(clearTimeout);
      heartTimers.clear();
    };
  }, []);

  // ── Milestone banner auto-dismiss ─────────────────────────────────────────
  useEffect(() => {
    if (!pendingMilestoneBanner) return;
    const t = setTimeout(clearMilestoneBanner, 3000);
    return () => clearTimeout(t);
  }, [pendingMilestoneBanner, clearMilestoneBanner]);

  // Until the player store rehydrates, selectedMonster still reads its default,
  // so a Luna player would get Nilly's room, sprite, and palette for a frame
  // before it snapped over. Every pixel here keys off the chosen monster, so
  // hold the whole habitat back rather than paint the wrong pet: an empty
  // container shows the navigator's own background for that moment.
  if (!playerHydrated) {
    return <View style={styles.container} />;
  }

  return (
    <View style={styles.container}>
      {/* ── Full-screen habitat background ── */}
      <ImageBackground
        source={HABITAT_IMAGES[monster]}
        style={StyleSheet.absoluteFillObject}
        resizeMode="cover"
      />
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          { backgroundColor: theme.habitatScrim },
        ]}
      />

      {/* ── Placed decor items ── */}
      <DecorLayer monster={monster} />

      {/* ── Floating particles overlay ── */}
      <MonsterHabitat monster={monster} />

      {/* ── Top pills ── */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <View style={styles.pillScrim}>
          <ThemedText style={[styles.pillText, { color: theme.pillText }]}>
            {availablePoints} pts
          </ThemedText>
        </View>
        {streak > 0 && (
          <View style={styles.pillScrim}>
            <ThemedText style={[styles.pillText, { color: theme.pillText }]}>
              {streak}d together
            </ThemedText>
          </View>
        )}
        {dailyRollSize > 0 && (
          <View style={styles.pillScrim}>
            <ThemedText style={[styles.pillText, { color: theme.pillText }]}>
              {doneToday}/{dailyRollSize} today
            </ThemedText>
          </View>
        )}
      </View>

      {/* ── Monster ── */}
      {menuOpen ? (
        <Pressable
          style={StyleSheet.absoluteFillObject}
          onPress={closeMenu}
          accessibilityRole="button"
          accessibilityLabel="Dismiss care menu"
        />
      ) : null}

      <LivingMonster
        ref={monsterRef}
        monster={monster}
        stage={evolutionStage}
        adultVariant={adultVariant}
        mood={mood}
        equipped={equipped}
        size={IMAGE_SIZE}
        accent={theme.accent}
        glowColor={theme.glowColor}
        accessibilityLabel={`Care for ${displayName}`}
        onPress={handleMonsterPress}
        onLongPress={handleMonsterHold}
        lift={dareLiftAnim}
        style={[
          styles.monsterImageWrapper,
          panelHeight > 0 && { bottom: panelHeight + MONSTER_BOTTOM_GAP },
        ]}
      />

      {/* ── Talk-back caption, tucked between the sprite and the panel ── */}
      {voiceLine || dare ? (
        <View
          pointerEvents="box-none"
          style={[
            styles.voiceCaptionWrap,
            panelHeight > 0 && { bottom: panelHeight + 10 },
          ]}
        >
          {voiceLine ? (
            <View
              pointerEvents="none"
              style={[
                styles.voiceBubble,
                {
                  backgroundColor: theme.cardBg + "E6",
                  borderColor: theme.cardBorder,
                },
              ]}
            >
              <ThemedText
                style={[styles.voiceText, { color: theme.text }]}
                accessibilityLiveRegion="polite"
              >
                {voiceLine}
              </ThemedText>
            </View>
          ) : null}
          {/* Welcome-back tiny dare: an offer, never a demand. Tapping only
              opens the tasks tab. */}
          {dare && !menuOpen ? (
            <Pressable
              onPress={handleDarePress}
              style={({ pressed }) => [
                styles.dareChip,
                {
                  backgroundColor: theme.accent + "26",
                  borderColor: theme.accent + "66",
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Tiny dare: ${dare.label}, ${dare.pointValue} points, only if you feel like it`}
            >
              <ThemedText style={[styles.dareText, { color: theme.text }]}>
                Tiny dare: {dare.label} · {dare.pointValue} pts — only if you
                feel like it
              </ThemedText>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {menuOpen ? (
        <View
          pointerEvents="box-none"
          style={[
            styles.interactMenuWrap,
            panelHeight > 0 && {
              bottom: panelHeight + MONSTER_BOTTOM_GAP + IMAGE_SIZE + 4,
            },
          ]}
        >
          <PetInteractMenu
            displayName={displayName}
            accent={theme.accent}
            accentInk="#ffffff"
            cardBg={theme.cardBg}
            text={theme.text}
            muted={theme.text}
            border={theme.cardBorder}
            foods={foods}
            toys={toys}
            picker={picker}
            reactionLine={null}
            onPet={handlePetTap}
            onAskFeed={handleAskFeed}
            onAskPlay={handleAskPlay}
            onChooseItem={
              picker === "play" ? handleChoosePlay : handleChooseFeed
            }
            onGoToShop={handleGoToShop}
            onClose={closeMenu}
          />
        </View>
      ) : null}

      {/* ── Tap reaction hearts ── */}
      {tapHearts.map((heart) => (
        <TapReactionHeart key={heart.id} x={heart.x} y={heart.y} />
      ))}

      {/* ── Care-moment bursts, radiating from the monster's middle ── */}
      {bursts.length > 0 ? (
        <View
          pointerEvents="none"
          style={[
            styles.burstLayer,
            panelHeight > 0 && {
              bottom: panelHeight + MONSTER_BOTTOM_GAP + IMAGE_SIZE * 0.5,
            },
          ]}
        >
          {bursts.map((b) => (
            <BurstParticles
              key={b.id}
              monster={monster}
              kind={b.kind}
              reduceMotion={reduceMotion}
            />
          ))}
        </View>
      ) : null}

      {/* ── Bottom panel ── */}
      {/* Collapsing slides the panel down until only the handle row peeks
          above the screen edge. A transform keeps the measured layout height
          intact, so the monster's anchor above the panel doesn't move and
          the revealed floor stays clear for placed decor and toys. */}
      <Animated.View
        style={[
          styles.bottomPanel,
          { backgroundColor: theme.panelBg },
          panelHeight > 0 && { transform: [{ translateY: panelTranslateY }] },
        ]}
        onLayout={(e) => setPanelHeight(e.nativeEvent.layout.height)}
      >
        <Pressable
          style={styles.panelHandle}
          onPress={handleStatPanelToggle}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={
            statPanelCollapsed ? "Show monster stats" : "Hide monster stats"
          }
          accessibilityState={{ expanded: !statPanelCollapsed }}
        >
          {/* Cross-fade: bottom-sheet grab bar when expanded, compact stat
              peek when collapsed. Both layers stay mounted; opacity follows
              the collapse animation. */}
          <Animated.View
            style={[styles.handleLayer, { opacity: grabBarOpacity }]}
            pointerEvents="none"
          >
            <View
              style={[styles.grabBar, { backgroundColor: theme.accent + "66" }]}
            />
          </Animated.View>
          <Animated.View
            style={[styles.handleLayer, { opacity: collapseAnim }]}
            pointerEvents="none"
          >
            <Text style={[styles.peekText, { color: theme.text }]}>
              ❤️ {Math.round(health)}
              {"   "}✨ {Math.round(happiness)}
              {"   "}
              <Text style={{ color: theme.accent }}>▴</Text>
            </Text>
          </Animated.View>
        </Pressable>

        <View
          style={styles.panelBody}
          accessibilityElementsHidden={statPanelCollapsed}
          importantForAccessibility={
            statPanelCollapsed ? "no-hide-descendants" : "auto"
          }
        >
          <View style={styles.nameRow}>
            <ThemedText style={[styles.monsterName, { color: theme.text }]}>
              {displayName}
            </ThemedText>
            <View
              style={[
                styles.stagePill,
                { backgroundColor: theme.accent + "33" },
              ]}
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
                accessibilityLabel="Learn about Founding Member"
              >
                <ThemedText
                  style={[styles.unlockButtonText, { color: theme.accent }]}
                >
                  ⭐ Founding Member
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
              {moodLabel}
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
              {doneToday === 0 ? "Start with one thing →" : "Keep going →"}
            </ThemedText>
          </Pressable>
        </View>
      </Animated.View>

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

      {/* ── Founding Member modal (evolution gate or manual info pill) ── */}
      {(pendingPremiumGate !== null || showUpgradeModal) && (
        <PremiumGateModal
          stage={pendingPremiumGate}
          theme={theme}
          onDismiss={() => {
            clearPremiumGate();
            setShowUpgradeModal(false);
          }}
          onUpgrade={() => {
            // Flip FOUNDING_MEMBER_PURCHASE_ENABLED only after real billing
            // is wired. This button must never grant premium by itself.
            if (!FOUNDING_MEMBER_PURCHASE_ENABLED) return;
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
  interactMenuWrap: {
    position: "absolute",
    bottom: "52%",
    left: 16,
    right: 16,
    alignItems: "center",
    zIndex: 8,
  },
  burstLayer: {
    position: "absolute",
    bottom: "40%",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 6,
  },
  voiceCaptionWrap: {
    position: "absolute",
    bottom: "22%",
    left: 24,
    right: 24,
    alignItems: "center",
    zIndex: 7,
  },
  voiceBubble: {
    maxWidth: 320,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  voiceText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "600",
    textAlign: "center",
  },
  dareChip: {
    marginTop: 6,
    maxWidth: 320,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  dareText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    textAlign: "center",
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
  panelHandle: {
    height: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  handleLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  grabBar: {
    width: 44,
    height: 5,
    borderRadius: 999,
  },
  peekText: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  panelBody: {
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
