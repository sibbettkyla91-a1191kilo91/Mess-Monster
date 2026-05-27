import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useMonsterTheme } from '@/hooks/use-monster-theme';
import { RewardOutcome } from '@/constants/task-timers';

interface PhotoRewardModalProps {
  /** The reward outcome to display */
  reward: RewardOutcome;
  /** Base points earned for the task */
  basePoints: number;
  /** Name of the free item (if applicable) */
  freeItemName?: string;
  /** Called when the user dismisses the modal */
  onDismiss: () => void;
}

export function PhotoRewardModal({
  reward,
  basePoints,
  freeItemName,
  onDismiss,
}: PhotoRewardModalProps) {
  const { accent, accentLight, accentDark, text: accentText, monster } = useMonsterTheme();
  const isDark = monster === 'luna';

  const totalPoints = Math.round(basePoints * reward.pointsMultiplier);
  const bonusPoints = totalPoints - basePoints;

  return (
    <View style={styles.overlay}>
      <View style={[styles.modal, { backgroundColor: isDark ? '#1a1a2e' : '#fff' }]}>
        {/* Big emoji */}
        <Text style={styles.bigEmoji}>{reward.emoji}</Text>

        {/* Title */}
        <Text style={[styles.title, { color: accent }]}>{reward.label}</Text>

        {/* Description */}
        <Text style={[styles.description, { color: isDark ? '#ccc' : '#555' }]}>
          {reward.description}
        </Text>

        {/* Points breakdown */}
        <View style={[styles.pointsBox, { backgroundColor: isDark ? accentDark : accentLight }]}>
          <Text style={[styles.pointsLine, { color: accentText }]}>
            Base: +{basePoints} pts
          </Text>
          {bonusPoints > 0 && (
            <Text style={[styles.pointsLine, styles.bonusLine, { color: accent }]}>
              Bonus: +{bonusPoints} pts
            </Text>
          )}
          <Text style={[styles.pointsTotal, { color: accentText }]}>
            Total: +{totalPoints} pts
          </Text>
        </View>

        {/* Free item callout */}
        {reward.includesFreeItem && freeItemName && (
          <View style={[styles.itemBox, { borderColor: accent }]}>
            <Text style={[styles.itemText, { color: isDark ? '#eee' : '#333' }]}>
              {'\ud83c\udf81'} Free item: {freeItemName}
            </Text>
          </View>
        )}

        {/* Dismiss button */}
        <TouchableOpacity
          style={[styles.dismissButton, { backgroundColor: accent }]}
          onPress={onDismiss}
          activeOpacity={0.7}
        >
          <Text style={styles.dismissText}>Awesome!</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
    padding: 24,
  },
  modal: {
    width: '100%',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  bigEmoji: {
    fontSize: 56,
    marginBottom: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  description: {
    fontSize: 15,
    textAlign: 'center',
  },
  pointsBox: {
    width: '100%',
    borderRadius: 12,
    padding: 14,
    gap: 4,
    marginTop: 8,
  },
  pointsLine: {
    fontSize: 14,
    fontWeight: '600',
  },
  bonusLine: {
    fontWeight: '800',
  },
  pointsTotal: {
    fontSize: 16,
    fontWeight: '900',
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
    paddingTop: 6,
  },
  itemBox: {
    width: '100%',
    borderRadius: 12,
    borderWidth: 2,
    padding: 12,
    alignItems: 'center',
  },
  itemText: {
    fontSize: 15,
    fontWeight: '700',
  },
  dismissButton: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 8,
  },
  dismissText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
});
