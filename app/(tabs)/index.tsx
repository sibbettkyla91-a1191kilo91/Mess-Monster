import { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { PetMood, deriveMood, usePetStore } from '@/store/use-pet-store';
import { usePlayerStore } from '@/store/use-player-store';

const STAGE_LABELS = ['Hatchling', 'Growing', 'Mature', 'Evolved ✨'] as const;

const MOOD_OVERLAY_COLOR: Record<PetMood, string | null> = {
  thriving: 'rgba(255,215,0,0.15)',
  happy:    null,
  neutral:  null,
  sad:      'rgba(100,120,180,0.20)',
  sick:     'rgba(80,180,80,0.25)',
};

// ─── Dimensions ──────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const IMAGE_SIZE   = Math.max(220, Math.round(SCREEN_WIDTH * 0.68));
// Monster feet at ~50% of screen height
const MONSTER_TOP  = Math.round(SCREEN_HEIGHT * 0.50) - IMAGE_SIZE;

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
    barTrack:       'rgba(0,0,0,0.10)',
    panelBg:        'rgba(240,250,245,0.88)',
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
    barTrack:       'rgba(255,255,255,0.12)',
    panelBg:        'rgba(10,10,20,0.82)',
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

const HABITAT_IMAGES = {
  nilly: require('../../assets/images/nilly-habitat.jpg'),
  luna:  require('../../assets/images/luna-habitat.jpg'),
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

// ─── StatBar ─────────────────────────────────────────────────────────────────

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
    inputRange:  [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={barStyles.row}>
      <View style={barStyles.labelRow}>
        <Text style={barStyles.icon}>{icon}</Text>
        <Text style={[barStyles.label, { color }]}>{label}</Text>
        <Text style={[barStyles.value, { color }]}>{Math.round(value)}</Text>
      </View>
      <View style={[barStyles.track, { backgroundColor: trackColor }]}>
        <Animated.View style={[barStyles.fill, { width: widthPct, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const barStyles = StyleSheet.create({
  row:      { gap: 5 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  icon:     { fontSize: 13 },
  label:    { flex: 1, fontSize: 13, fontWeight: '600', letterSpacing: 0.2 },
  value:    { fontSize: 13, fontWeight: '700', opacity: 0.75 },
  track:    { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill:     { height: '100%', borderRadius: 4 },
});

// ─── HomeScreen ───────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const health                  = usePetStore((s) => s.health);
  const happiness               = usePetStore((s) => s.happiness);
  const evolutionStage          = usePetStore((s) => s.evolutionStage);
  const pendingMilestoneBanner  = usePetStore((s) => s.pendingMilestoneBanner);
  const clearMilestoneBanner    = usePetStore((s) => s.clearMilestoneBanner);
  const mood                    = deriveMood(health, happiness);
  const availablePoints = usePlayerStore((s) => s.availablePoints());
  const streak          = usePlayerStore((s) => s.streak);
  const selectedMonster = usePlayerStore((s) => s.selectedMonster) ?? 'nilly';
  const monsterName     = usePlayerStore((s) => s.monsterName);
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

  // ── Evolution scale pulse (slow continuous loop at stage 3) ──────────────
  const evoScaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (evolutionStage < 3) { evoScaleAnim.setValue(1); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(evoScaleAnim, { toValue: 1.04, duration: 1800, useNativeDriver: true }),
        Animated.timing(evoScaleAnim, { toValue: 1.00, duration: 1800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => { loop.stop(); evoScaleAnim.setValue(1); };
  }, [evolutionStage, evoScaleAnim]);

  // ── Milestone banner auto-dismiss ────────────────────────────────────────
  useEffect(() => {
    if (!pendingMilestoneBanner) return;
    const t = setTimeout(clearMilestoneBanner, 3000);
    return () => clearTimeout(t);
  }, [pendingMilestoneBanner, clearMilestoneBanner]);

  // ── Sick wobble (continuous slow oscillation when mood is sick) ──────────
  const sickWobbleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (mood !== 'sick') { sickWobbleAnim.setValue(0); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sickWobbleAnim, { toValue:  1, duration: 700, useNativeDriver: true }),
        Animated.timing(sickWobbleAnim, { toValue: -1, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => { loop.stop(); sickWobbleAnim.setValue(0); };
  }, [mood, sickWobbleAnim]);

  const wiggleRot = wiggleAnim.interpolate({
    inputRange:  [-9, 0, 9],
    outputRange: ['-4.5deg', '0deg', '4.5deg'],
  });

  const sickWobbleRot = sickWobbleAnim.interpolate({
    inputRange:  [-1, 0, 1],
    outputRange: ['-8deg', '0deg', '8deg'],
  });

  // Neutral mood: reduce opacity to 0.9. Stage 0 takes priority (0.7).
  const wrapperOpacity = Math.min(
    evolutionStage === 0 ? 0.7 : 1,
    mood === 'neutral' ? 0.9 : 1,
  );

  const overlayColor = MOOD_OVERLAY_COLOR[mood];

  return (
    <View style={styles.container}>
      {/* ── Full-screen habitat background ── */}
      <ImageBackground
        source={HABITAT_IMAGES[monster]}
        style={StyleSheet.absoluteFillObject}
        resizeMode="cover"
      />

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
      </View>

      {/* ── Monster centered at ~50% screen height ── */}
      <Animated.View
        style={[
          styles.monsterImageWrapper,
          { opacity: wrapperOpacity },
          evolutionStage === 2 && {
            shadowColor: theme.accent,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.45,
            shadowRadius: 18,
            elevation: 8,
          },
          evolutionStage === 3 && {
            shadowColor: theme.accent,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.75,
            shadowRadius: 30,
            elevation: 14,
          },
          {
            transform: [
              { translateY: bobAnim },
              { scale: scaleAnim },
              { scale: evoScaleAnim },
              { rotateZ: wiggleRot },
              { rotateZ: sickWobbleRot },
            ],
          },
        ]}
      >
        <Image
          source={MONSTER_IMAGES[monster]}
          style={styles.monsterImage}
          resizeMode="contain"
        />
        {overlayColor !== null && (
          <View
            pointerEvents="none"
            style={[styles.moodOverlay, { backgroundColor: overlayColor }]}
          />
        )}
      </Animated.View>

      {/* ── Bottom panel ── */}
      <View style={[styles.bottomPanel, { backgroundColor: theme.panelBg }]}>
        {/* Name + stage badge row */}
        <View style={styles.nameRow}>
          <ThemedText style={[styles.monsterName, { color: theme.text }]}>
            {monsterName || (monster === 'nilly' ? 'Nilly' : 'Luna')}
          </ThemedText>
          <View style={[styles.stagePill, { backgroundColor: theme.accent + '33' }]}>
            <ThemedText style={[styles.stageLabel, { color: theme.accent }]}>
              {STAGE_LABELS[evolutionStage]}
            </ThemedText>
          </View>
        </View>

        {/* Health & happiness bars */}
        <View style={styles.statBars}>
          <StatBar icon="❤️" label="Health"    value={health}    color={theme.accent}       trackColor={theme.barTrack} />
          <StatBar icon="✨" label="Happiness" value={happiness} color={theme.particleColor} trackColor={theme.barTrack} />
        </View>

        {/* Mood section */}
        <View style={styles.moodSection}>
          <ThemedText style={[styles.moodLabel, { color: theme.accent }]}>
            {moodCfg.label}
          </ThemedText>
          <ThemedText style={[styles.moodMessage, { color: theme.text }]}>
            {moodCfg.message}
          </ThemedText>
        </View>

        {/* CTA button */}
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

      {/* ── Streak milestone banner ── */}
      {pendingMilestoneBanner !== null && (
        <Pressable
          style={[styles.milestoneBanner, { backgroundColor: theme.accent }]}
          onPress={clearMilestoneBanner}
          accessibilityRole="button"
          accessibilityLabel={`${pendingMilestoneBanner}-day streak milestone`}
        >
          <ThemedText style={[styles.milestoneBannerText, { color: theme.pillText }]}>
            🔥 {pendingMilestoneBanner}-day streak! +50 bonus points
          </ThemedText>
        </Pressable>
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Top pills — absolute, corner-anchored
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 54,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pillScrim: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  pillText: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.3,
  },

  // Monster — absolute, feet at ~50% screen height
  monsterImageWrapper: {
    position: 'absolute',
    top: MONSTER_TOP,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  monsterImage: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
  },
  moodOverlay: {
    position: 'absolute',
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    borderRadius: IMAGE_SIZE * 0.1,
  },

  // Bottom panel — anchored to screen bottom
  bottomPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
    paddingBottom: 28,
    gap: 12,
  },

  // Name + stage badge row
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  monsterName: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  stagePill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  stageLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },

  // Health + happiness bars
  statBars: {
    gap: 8,
  },

  // Mood section
  moodSection: {
    gap: 4,
  },
  moodLabel: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  moodMessage: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.85,
  },

  // CTA button
  ctaButton: {
    borderRadius: 16,
    paddingVertical: 16,
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

  // Streak milestone banner — floats above the bottom panel
  milestoneBanner: {
    position: 'absolute',
    bottom: 220,
    left: 24,
    right: 24,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 12,
  },
  milestoneBannerText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
