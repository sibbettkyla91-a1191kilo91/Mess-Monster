import { useCallback, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, useColorScheme } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { usePetStore } from '@/store/use-pet-store';
import { usePlayerStore } from '@/store/use-player-store';
import { useTasksStore } from '@/store/use-tasks-store';
import { TaskCategory } from '@/store/types';

interface PresetTask {
  id: string;
  label: string;
  category: TaskCategory;
  pointValue: number;
}

const PRESET_TASKS: PresetTask[] = [
  { id: 'wash-dishes',    label: 'Wash the dishes',    category: 'kitchen',     pointValue: 20 },
  { id: 'wipe-counters',  label: 'Wipe down counters', category: 'kitchen',     pointValue: 15 },
  { id: 'clean-stovetop', label: 'Clean the stovetop', category: 'kitchen',     pointValue: 30 },
  { id: 'scrub-toilet',   label: 'Scrub the toilet',   category: 'bathroom',    pointValue: 40 },
  { id: 'wipe-sink',      label: 'Wipe sink & mirror', category: 'bathroom',    pointValue: 20 },
  { id: 'make-bed',       label: 'Make the bed',       category: 'bedroom',     pointValue: 10 },
  { id: 'tidy-floor',     label: 'Tidy the floor',     category: 'bedroom',     pointValue: 15 },
  { id: 'vacuum',         label: 'Vacuum the floor',   category: 'living_room', pointValue: 30 },
  { id: 'dust-surfaces',  label: 'Dust surfaces',      category: 'living_room', pointValue: 20 },
  { id: 'take-out-trash', label: 'Take out the trash', category: 'trash',       pointValue: 15 },
];

const CATEGORY_EMOJI: Record<TaskCategory, string> = {
  kitchen:     '🍳',
  bathroom:    '🚿',
  bedroom:     '🛏',
  living_room: '🛋',
  laundry:     '👕',
  trash:       '🗑',
  other:       '📦',
};

export default function TasksScreen() {
  const addTask        = useTasksStore((s) => s.addTask);
  const earnPoints     = usePlayerStore((s) => s.earnPoints);
  const recordActivity = usePlayerStore((s) => s.recordActivity);
  const care           = usePetStore((s) => s.care);
  const selectedMonster = usePlayerStore((s) => s.selectedMonster) ?? 'nilly';
  const scheme         = useColorScheme();

  const accentColor = selectedMonster === 'luna' ? '#cc2222' : '#52b788';

  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [celebration, setCelebration]   = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCheck = useCallback(
    (task: PresetTask) => {
      if (completedIds.has(task.id)) return;
      addTask({ ...task, completedAt: Date.now() });
      earnPoints(task.pointValue);
      recordActivity();
      care();
      setCompletedIds((prev) => new Set(prev).add(task.id));
      if (timerRef.current) clearTimeout(timerRef.current);
      setCelebration(`✨ +${task.pointValue} pts! Keep going!`);
      timerRef.current = setTimeout(() => setCelebration(null), 2000);
    },
    [completedIds, addTask, earnPoints, recordActivity, care],
  );

  const isDark = scheme === 'dark';
  const progressPct = (completedIds.size / PRESET_TASKS.length) * 100;

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="title">Today&apos;s Tasks</ThemedText>

        <View style={styles.subrow}>
          <ThemedText style={styles.count}>
            {completedIds.size}/{PRESET_TASKS.length} done
          </ThemedText>
          {celebration && (
            <View style={[styles.celebrationPill, { backgroundColor: accentColor + '28' }]}>
              <Text style={[styles.celebrationText, { color: accentColor }]}>{celebration}</Text>
            </View>
          )}
        </View>

        {/* Progress bar */}
        <View style={[styles.progressTrack, { backgroundColor: isDark ? '#2c2c2c' : '#e4e8ec' }]}>
          <View
            style={[
              styles.progressFill,
              {
                backgroundColor: accentColor,
                width: `${progressPct}%`,
              },
            ]}
          />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {PRESET_TASKS.map((task) => {
          const done = completedIds.has(task.id);
          return (
            <TouchableOpacity
              key={task.id}
              style={[
                styles.taskRow,
                isDark
                  ? done ? styles.taskRowDoneDark  : styles.taskRowDark
                  : done ? styles.taskRowDoneLight : styles.taskRowLight,
              ]}
              onPress={() => handleCheck(task)}
              activeOpacity={done ? 1 : 0.7}
              disabled={done}
            >
              <View
                style={[
                  styles.checkbox,
                  done && { backgroundColor: accentColor, borderColor: accentColor },
                ]}
              >
                {done && <Text style={styles.checkmark}>✓</Text>}
              </View>

              <View style={styles.taskInfo}>
                <ThemedText style={[styles.taskLabel, done && styles.taskLabelDone]}>
                  {task.label}
                </ThemedText>
                <ThemedText style={styles.categoryLabel}>
                  {CATEGORY_EMOJI[task.category]} {task.category.replace('_', ' ')}
                </ThemedText>
              </View>

              <Text style={[styles.pointsText, { color: accentColor, opacity: done ? 0.45 : 1 }]}>
                +{task.pointValue}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60, paddingHorizontal: 20 },
  header:    { marginBottom: 16, gap: 6 },
  subrow:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  count:     { opacity: 0.5, fontSize: 14 },
  celebrationPill: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  celebrationText: { fontWeight: '600', fontSize: 13 },

  // Progress bar
  progressTrack: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 4,
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },

  list: { gap: 10, paddingBottom: 40 },

  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  taskRowLight:     { backgroundColor: '#f8f9fa', borderColor: 'rgba(0,0,0,0.08)' },
  taskRowDark:      { backgroundColor: '#1e2124', borderColor: 'rgba(255,255,255,0.09)' },
  taskRowDoneLight: { backgroundColor: '#f1f7f1', borderColor: 'rgba(0,0,0,0.07)' },
  taskRowDoneDark:  { backgroundColor: '#182518', borderColor: 'rgba(255,255,255,0.07)' },

  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#aaa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark:     { color: '#fff', fontSize: 13, fontWeight: '700' },
  taskInfo:      { flex: 1, gap: 3 },
  taskLabel:     { fontSize: 16, fontWeight: '500' },
  taskLabelDone: { opacity: 0.45 },
  categoryLabel: { fontSize: 12, opacity: 0.5, textTransform: 'capitalize' },
  pointsText:    { fontWeight: '700', fontSize: 15 },
});
