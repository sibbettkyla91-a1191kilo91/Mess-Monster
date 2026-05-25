import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useMonsterTheme } from '@/hooks/use-monster-theme';
import { deriveMood, usePetStore } from '@/store/use-pet-store';
import { usePlayerStore } from '@/store/use-player-store';

/**
 * Mood config factory — returns palette-aware background colors.
 * Nilly uses green-to-red gradient; Luna uses dark purple-to-red gradient.
 */
function getMoodConfig(monster: 'nilly' | 'luna') {
  if (monster === 'luna') {
    return {
      thriving: { emoji: '🌟', bg: '#2a0a3a', darkBg: '#1a0a2a' },
      happy:    { emoji: '😊', bg: '#2a0a30', darkBg: '#180a20' },
      neutral:  { emoji: '😐', bg: '#2a1a2a', darkBg: '#1a1018' },
      sad:      { emoji: '😢', bg: '#3a1020', darkBg: '#2a0a18' },
      sick:     { emoji: '🤒', bg: '#4a1020', darkBg: '#3a0a14' },
    } as const;
  }
  // Nilly (default)
  return {
    thriving: { emoji: '🌟', bg: '#b8f5c8', darkBg: '#1a4d2e' },
    happy:    { emoji: '😊', bg: '#d4f0b8', darkBg: '#2a4a1a' },
    neutral:  { emoji: '😐', bg: '#f5f0c0', darkBg: '#3d3a10' },
    sad:      { emoji: '😢', bg: '#fcd9a8', darkBg: '#4d2e10' },
    sick:     { emoji: '🤒', bg: '#f5b8b8', darkBg: '#4d1a1a' },
  } as const;
}

export default function HomeScreen() {
  const lastCaredAt = usePetStore((s) => s.lastCaredAt);
  const mood = deriveMood(lastCaredAt);
  const availablePoints = usePlayerStore((s) => s.availablePoints());
  const streak = usePlayerStore((s) => s.streak);
  const monsterName = usePlayerStore((s) => s.monsterName);
  const selectedMonster = usePlayerStore((s) => s.selectedMonster);
  const { accent, monster } = useMonsterTheme();

  const moodConfig = getMoodConfig(monster);
  const config = moodConfig[mood];
  const displayName = monsterName || (selectedMonster === 'luna' ? 'Luna' : 'Nilly');

  const moodMessages = {
    thriving: `${displayName} is absolutely thriving!`,
    happy: `${displayName} is happy and content.`,
    neutral: `${displayName} could use some attention.`,
    sad: `${displayName} is feeling neglected...`,
    sick: `${displayName} is sick. Please help!`,
  };

  return (
    <ThemedView
      style={styles.container}
      lightColor={config.bg}
      darkColor={config.darkBg}
    >
      <View style={styles.header}>
        <ThemedText type="defaultSemiBold" style={styles.points}>
          ⭐ {availablePoints} pts
        </ThemedText>
        {streak > 0 && (
          <ThemedText type="defaultSemiBold" style={styles.streak}>
            🔥 {streak}d streak
          </ThemedText>
        )}
      </View>

      <View style={styles.monsterContainer}>
        <View style={styles.monsterBody}>
          <ThemedText style={styles.monsterEmoji}>{config.emoji}</ThemedText>
          <ThemedText style={[styles.monsterName, { color: accent }]}>
            {displayName}
          </ThemedText>
        </View>
      </View>

      <View style={styles.footer}>
        <ThemedText type="subtitle" style={styles.moodLabel}>
          {mood.charAt(0).toUpperCase() + mood.slice(1)}
        </ThemedText>
        <ThemedText style={styles.moodMessage}>
          {moodMessages[mood]}
        </ThemedText>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  points: {
    fontSize: 18,
  },
  streak: {
    fontSize: 18,
  },
  monsterContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  monsterBody: {
    alignItems: 'center',
    gap: 12,
  },
  monsterEmoji: {
    fontSize: 140,
    lineHeight: 160,
  },
  monsterName: {
    fontSize: 28,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  footer: {
    alignItems: 'center',
    paddingBottom: 48,
    gap: 8,
  },
  moodLabel: {
    fontSize: 22,
  },
  moodMessage: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.8,
  },
});
