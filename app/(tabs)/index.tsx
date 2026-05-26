import { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { deriveMood, usePetStore } from '@/store/use-pet-store';
import { usePlayerStore } from '@/store/use-player-store';

// ─── Dimensions ──────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const IMAGE_SIZE = Math.max(220, Math.round(SCREEN_WIDTH * 0.68));

// ─── Theme ───────────────────────────────────────────────────────────────────

const THEMES = {
  nilly: {
    background:     '#f0faf5',
    accent:         '#52b788',
    text:           '#2d3436',
    cardBg:         '#ffffff',
    pillText:       '#ffffff',
    cardBorder:     'rgba(0,0,0,0.07)',
    radialColor:    'rgba(155,230,195,0.18)',
    glowColor:      'rgba(82,183,136,0.13)',
    particleColor:  '#3aab6f',
  },
  luna: {
    background:     '#1a1a2e',
    accent:         '#cc2222',
    text:           '#f0e6d3',
    cardBg:         '#2a2a3e',
    pillText:       '#f0e6d3',
    cardBorder:     'rgba(255,255,255,0.09)',
    radialColor:    'rgba(60,20,80,0.22)',
    glowColor:      'rgba(90,35,160,0.16)',
    particleColor:  '#d8c0ff',
  },
} as const;

// ─── Mood config ─────────────────────────────────────────────────────────────

const MOOD_CONFIG = {
  nilly: {
    thriving: { label: 'Thriving', message: 'Nilly is absolutely thriving! She loves how clean everything is.' },
    happy:    { label: 'Happy',    message: 'Nilly is happy and content. Keep up the good work!' },
    neutral:  { label: 'Neutral',  message: 'Nilly could use some attention. Maybe tackle a quick task?' },
    sad:      { label: 'Sad',      message: 'Nilly is feeling neglected… she misses seeing you clean.' },
    sick:     { label: 'Sick',     message: 'Nilly is sick. Please help her by completing some tasks!' },
  },
  luna: {
    thriving: { label: 'Thriving', message: 'Luna is radiant. The realm is spotless and her power is at its peak.' },
    happy:    { label: 'Happy',    message: 'Luna is pleased. The chaos is under control — for now.' },
    neutral:  { label: 'Neutral',  message: 'Luna stirs uneasily. The mess grows in the shadows.' },
    sad:      { label: 'Sad',      message: 'Luna fades. Neglect weakens her magic — she needs you.' },
    sick:     { label: 'Sick',     message: 'Luna is ill. The mess has won. Only you can restore order.' },
  },
} as const;

// ─── Assets ──────────────────────────────────────────────────────────────────

const MONSTER_IMAGES = {
  nilly: require('../../assets/images/nilly.png'),
  luna:  require('../../assets/images/luna.png'),
};

// ─── Particle definitions ────────────────────────────────────────────────────

interface ParticleDef {
  id:       string;
  x:        number;   // fraction of SCREEN_WIDTH
  y:        number;   // fraction of SCREEN_HEIGHT
  char:     string;
  size:     number;
  opacity:  number;   // peak opacity
  duration: number;   // full cycle ms
  delay:    number;   // startup delay ms
  driftY:   number;   // pixels to float upward per half-cycle
}

// Luna: stars and sparkle glyphs that drift upward like embers
const LUNA_PARTICLES: ParticleDef[] = [
  { id: 'l1',  x: 0.06, y: 0.11, char: '★', size: 14, opacity: 0.55, duration: 3400, delay: 0,    driftY: 18 },
  { id: 'l2',  x: 0.83, y: 0.08, char: '★', size: 9,  opacity: 0.40, duration: 4200, delay: 600,  driftY: 12 },
  { id: 'l3',  x: 0.46, y: 0.05, char: '✦', size: 7,  opacity: 0.35, duration: 5000, delay: 1200, driftY: 10 },
  { id: 'l4',  x: 0.14, y: 0.35, char: '★', size: 10, opacity: 0.30, duration: 3800, delay: 400,  driftY: 14 },
  { id: 'l5',  x: 0.79, y: 0.30, char: '✦', size: 12, opacity: 0.45, duration: 4600, delay: 900,  driftY: 16 },
  { id: 'l6',  x: 0.91, y: 0.53, char: '★', size: 8,  opacity: 0.35, duration: 3200, delay: 1800, driftY: 10 },
  { id: 'l7',  x: 0.03, y: 0.59, char: '✧', size: 11, opacity: 0.28, duration: 4800, delay: 2200, driftY: 14 },
  { id: 'l8',  x: 0.26, y: 0.19, char: '·', size: 20, opacity: 0.50, duration: 3600, delay: 300,  driftY: 22 },
  { id: 'l9',  x: 0.68, y: 0.14, char: '·', size: 16, opacity: 0.38, duration: 4400, delay: 700,  driftY: 16 },
  { id: 'l10', x: 0.54, y: 0.68, char: '✦', size: 9,  opacity: 0.25, duration: 5200, delay: 1500, driftY: 12 },
];

// Nilly: sparkle glyphs, soft orbs, and drifting leaves
const NILLY_PARTICLES: ParticleDef[] = [
  { id: 'n1',  x: 0.07, y: 0.09, char: '✦', size: 12, opacity: 0.48, duration: 3200, delay: 0,    driftY: 16 },
  { id: 'n2',  x: 0.86, y: 0.12, char: '✦', size: 8,  opacity: 0.38, duration: 4000, delay: 500,  driftY: 12 },
  { id: 'n3',  x: 0.50, y: 0.05, char: '✧', size: 10, opacity: 0.33, duration: 5200, delay: 1000, driftY: 10 },
  { id: 'n4',  x: 0.13, y: 0.36, char: '✦', size: 9,  opacity: 0.28, duration: 3800, delay: 800,  driftY: 14 },
  { id: 'n5',  x: 0.81, y: 0.32, char: '✧', size: 11, opacity: 0.38, duration: 4600, delay: 1400, driftY: 15 },
  { id: 'n6',  x: 0.21, y: 0.17, char: '○', size: 10, opacity: 0.20, duration: 4200, delay: 300,  driftY: 18 },
  { id: 'n7',  x: 0.73, y: 0.23, char: '○', size: 8,  opacity: 0.16, duration: 5000, delay: 1600, driftY: 14 },
  { id: 'n8',  x: 0.89, y: 0.49, char: '○', size: 13, opacity: 0.18, duration: 3600, delay: 2000, driftY: 12 },
  { id: 'n9',  x: 0.04, y: 0.54, char: '🍃', size: 14, opacity: 0.35, duration: 4800, delay: 600,  driftY: 20 },
  { id: 'n10', x: 0.93, y: 0.43, char: '🍃', size: 11, opacity: 0.28, duration: 3400, delay: 1800, driftY: 14 },
];

// ─── FloatingParticle ────────────────────────────────────────────────────────

function FloatingParticle({ def, color }: { def: ParticleDef; color: string }) {
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity    = useRef(new Animated.Value(def.opacity * 0.3)).current;

  useEffect(() => {
    const yLoop = Animated.loop(
      Animated.sequence([
        Animated.delay(def.delay),
        Animated.timing(translateY, {
          toValue:  -def.driftY,
          duration: def.duration / 2,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue:  0,
          duration: def.duration / 2,
          useNativeDriver: true,
        }),
      ]),
    );
    const opacityLoop = Animated.loop(
      Animated.sequence([
        Animated.delay(def.delay),
        Animated.timing(opacity, {
          toValue:  def.opacity,
          duration: def.duration * 0.55,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue:  def.opacity * 0.18,
          duration: def.duration * 0.45,
          useNativeDriver: true,
        }),
      ]),
    );
    yLoop.start();
    opacityLoop.start();
    return () => { yLoop.stop(); opacityLoop.stop(); };
  // static particle — deps never change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.Text
      style={{
        position: 'absolute',
        left:     def.x * SCREEN_WIDTH,
        top:      def.y * SCREEN_HEIGHT,
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

// ─── MonsterHabitat ──────────────────────────────────────────────────────────

function MonsterHabitat({ monster }: { monster: 'nilly' | 'luna' }) {
  const particles = monster === 'luna' ? LUNA_PARTICLES : NILLY_PARTICLES;
  const theme     = THEMES[monster];

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {/* Simulated radial background glow — lighter center, darker edges */}
      <View style={[styles.radialGlow, { backgroundColor: theme.radialColor }]} />

      {/* Spotlight orb behind the monster */}
      <View style={[styles.monsterGlow, { backgroundColor: theme.glowColor }]} />

      {/* Floating particles */}
      {particles.map((def) => (
        <FloatingParticle
          key={def.id}
          def={def}
          color={theme.particleColor}
        />
      ))}
    </View>
  );
}

// ─── HomeScreen ───────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const lastCaredAt     = usePetStore((s) => s.lastCaredAt);
  const mood            = deriveMood(lastCaredAt);
  const availablePoints = usePlayerStore((s) => s.availablePoints());
  const streak          = usePlayerStore((s) => s.streak);
  const selectedMonster = usePlayerStore((s) => s.selectedMonster) ?? 'nilly';
  const router          = useRouter();

  const monster = selectedMonster === 'luna' ? 'luna' : 'nilly';
  const theme   = THEMES[monster];
  const moodCfg = MOOD_CONFIG[monster][mood];

  // ── Bob (constant float, mood affects speed and direction) ────────────────
  const bobAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const isSad    = mood === 'sad' || mood === 'sick';
    const bobSpeed = mood === 'thriving' ? 900 : isSad ? 2600 : 1700;
    const bobAmt   = isSad ? 6 : -12; // sad/sick droop down; others float up

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bobAnim, {
          toValue:  bobAmt,
          duration: bobSpeed / 2,
          useNativeDriver: true,
        }),
        Animated.timing(bobAnim, {
          toValue:  0,
          duration: bobSpeed / 2,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [mood, bobAnim]);

  // ── Wiggle (random small rotation, 4–8 s interval) ────────────────────────
  const wiggleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let active = true;
    let tid: ReturnType<typeof setTimeout>;

    const schedule = () => {
      if (!active) return;
      tid = setTimeout(() => {
        if (!active) return;
        Animated.sequence([
          Animated.timing(wiggleAnim, { toValue: -9,  duration: 80,  useNativeDriver: true }),
          Animated.timing(wiggleAnim, { toValue:  9,  duration: 100, useNativeDriver: true }),
          Animated.timing(wiggleAnim, { toValue: -5,  duration: 80,  useNativeDriver: true }),
          Animated.timing(wiggleAnim, { toValue:  0,  duration: 100, useNativeDriver: true }),
        ]).start(() => schedule());
      }, 4000 + Math.random() * 4000);
    };

    schedule();
    return () => { active = false; clearTimeout(tid); wiggleAnim.setValue(0); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Thriving scale-pulse (occasional bounce when mood is at peak) ─────────
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (mood !== 'thriving') { scaleAnim.setValue(1); return; }
    let active = true;
    let tid: ReturnType<typeof setTimeout>;

    const schedule = () => {
      if (!active) return;
      tid = setTimeout(() => {
        if (!active) return;
        Animated.sequence([
          Animated.timing(scaleAnim, { toValue: 1.08, duration: 240, useNativeDriver: true }),
          Animated.timing(scaleAnim, { toValue: 1.00, duration: 240, useNativeDriver: true }),
          Animated.timing(scaleAnim, { toValue: 1.05, duration: 180, useNativeDriver: true }),
          Animated.timing(scaleAnim, { toValue: 1.00, duration: 180, useNativeDriver: true }),
        ]).start(() => schedule());
      }, 5000 + Math.random() * 5000);
    };

    schedule();
    return () => { active = false; clearTimeout(tid); scaleAnim.setValue(1); };
  }, [mood, scaleAnim]);

  const wiggleRot = wiggleAnim.interpolate({
    inputRange:  [-9, 0, 9],
    outputRange: ['-4.5deg', '0deg', '4.5deg'],
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* ── Animated habitat layer ── */}
      <MonsterHabitat monster={monster} />

      {/* ── Stat bar ── */}
      <View style={styles.statBar}>
        <View style={[styles.pill, { backgroundColor: theme.accent }]}>
          <ThemedText style={[styles.pillText, { color: theme.pillText }]}>
            ⭐ {availablePoints} pts
          </ThemedText>
        </View>
        {streak > 0 && (
          <View style={[styles.pill, { backgroundColor: theme.accent }]}>
            <ThemedText style={[styles.pillText, { color: theme.pillText }]}>
              🔥 {streak}d streak
            </ThemedText>
          </View>
        )}
      </View>

      {/* ── Animated monster ── */}
      <View style={styles.monsterArea}>
        <Animated.Image
          source={MONSTER_IMAGES[monster]}
          style={[
            styles.monsterImage,
            {
              transform: [
                { translateY: bobAnim },
                { scale: scaleAnim },
                { rotateZ: wiggleRot },
              ],
            },
          ]}
          resizeMode="contain"
        />
      </View>

      {/* ── Monster name ── */}
      <ThemedText style={[styles.monsterName, { color: theme.text }]}>
        {monster === 'nilly' ? 'Nilly' : 'Luna'}
      </ThemedText>

      {/* ── Mood card ── */}
      <View
        style={[
          styles.moodCard,
          { backgroundColor: theme.cardBg, borderColor: theme.cardBorder },
        ]}
      >
        <ThemedText style={[styles.moodLabel, { color: theme.accent }]}>
          {moodCfg.label}
        </ThemedText>
        <ThemedText style={[styles.moodMessage, { color: theme.text }]}>
          {moodCfg.message}
        </ThemedText>
      </View>

      {/* ── CTA button ── */}
      <Pressable
        style={({ pressed }) => [
          styles.ctaButton,
          { backgroundColor: theme.accent, opacity: pressed ? 0.82 : 1 },
        ]}
        onPress={() => router.navigate('/(tabs)/explore')}
        accessibilityRole="button"
        accessibilityLabel="Go clean something"
      >
        <ThemedText style={[styles.ctaText, { color: theme.pillText }]}>
          Clean Something →
        </ThemedText>
      </Pressable>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 32,
    alignItems: 'center',
  },

  // Stat bar
  statBar: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  pillText: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.3,
  },

  // Monster image area
  monsterArea: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 14,
  },
  monsterImage: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
  },

  // Name
  monsterName: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: 18,
  },

  // Mood card
  moodCard: {
    width: '100%',
    borderRadius: 22,
    borderWidth: 1,
    padding: 24,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 16,
  },
  moodLabel: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  moodMessage: {
    fontSize: 15,
    lineHeight: 22,
    opacity: 0.85,
  },

  // CTA button
  ctaButton: {
    width: '100%',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 6,
  },
  ctaText: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.4,
  },

  // Habitat background layers
  radialGlow: {
    position: 'absolute',
    // Centered by aligning relative to negative margins from a 130% wide circle
    left:   -(SCREEN_WIDTH * 0.15),
    top:    SCREEN_HEIGHT * 0.02,
    width:  SCREEN_WIDTH * 1.30,
    height: SCREEN_WIDTH * 1.30,
    borderRadius: SCREEN_WIDTH * 0.65,
  },
  monsterGlow: {
    position: 'absolute',
    left:   (SCREEN_WIDTH - IMAGE_SIZE * 0.95) / 2,
    top:    SCREEN_HEIGHT * 0.14,
    width:  IMAGE_SIZE * 0.95,
    height: IMAGE_SIZE * 0.95,
    borderRadius: IMAGE_SIZE * 0.475,
  },
});
