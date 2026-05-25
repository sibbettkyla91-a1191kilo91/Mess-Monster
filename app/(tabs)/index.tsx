import { Dimensions, Image, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { deriveMood, usePetStore } from '@/store/use-pet-store';
import { usePlayerStore } from '@/store/use-player-store';

// ─── Theme ───────────────────────────────────────────────────────────────────

const THEMES = {
  nilly: {
    background: '#f0faf5',
    accent: '#52b788',
    text: '#2d3436',
    cardBg: '#ffffff',
    pillText: '#ffffff',
  },
  luna: {
    background: '#1a1a2e',
    accent: '#cc2222',
    text: '#f0e6d3',
    cardBg: '#2a2a3e',
    pillText: '#f0e6d3',
  },
} as const;

// ─── Mood Config ─────────────────────────────────────────────────────────────

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

const SCREEN_WIDTH = Dimensions.get('window').width;

// ─── Component ───────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const lastCaredAt     = usePetStore((s) => s.lastCaredAt);
  const mood            = deriveMood(lastCaredAt);
  const availablePoints = usePlayerStore((s) => s.availablePoints());
  const streak          = usePlayerStore((s) => s.streak);
  const selectedMonster = usePlayerStore((s) => s.selectedMonster) ?? 'nilly';

  const monster = selectedMonster === 'luna' ? 'luna' : 'nilly';
  const theme   = THEMES[monster];
  const moodCfg = MOOD_CONFIG[monster][mood];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>

      {/* ── 1. Top stat bar ── */}
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

      {/* ── 2. Monster artwork ── */}
      <View style={styles.monsterArea}>
        <Image
          source={MONSTER_IMAGES[monster]}
          style={styles.monsterImage}
          resizeMode="contain"
        />
      </View>

      {/* ── 3. Monster name ── */}
      <ThemedText style={[styles.monsterName, { color: theme.text }]}>
        {monster === 'nilly' ? 'Nilly' : 'Luna'}
      </ThemedText>

      {/* ── 4. Mood status card ── */}
      <View style={[styles.moodCard, { backgroundColor: theme.cardBg }]}>
        <ThemedText style={[styles.moodLabel, { color: theme.accent }]}>
          {moodCfg.label}
        </ThemedText>
        <ThemedText style={[styles.moodMessage, { color: theme.text }]}>
          {moodCfg.message}
        </ThemedText>
      </View>

    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 40,
    alignItems: 'center',
  },

  // Top bar
  statBar: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
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

  // Monster image
  monsterArea: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
  },
  monsterImage: {
    width: SCREEN_WIDTH * 0.65,
    height: SCREEN_WIDTH * 0.65,
  },

  // Monster name
  monsterName: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: 28,
  },

  // Mood card
  moodCard: {
    width: '100%',
    borderRadius: 20,
    padding: 24,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
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
});
