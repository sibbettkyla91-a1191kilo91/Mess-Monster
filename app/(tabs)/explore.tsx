import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';

import { PhotoRewardModal } from '@/components/photo-reward-modal';
import { TaskTimer } from '@/components/task-timer';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  DEFAULT_MIN_TIME,
  FREE_ITEM_MAX_PRICE,
  RewardOutcome,
  TASK_MIN_TIMES,
  rollReward,
} from '@/constants/task-timers';
import { useMonsterTheme } from '@/hooks/use-monster-theme';
import { usePetStore } from '@/store/use-pet-store';
import { usePlayerStore } from '@/store/use-player-store';
import { usePhotoStore } from '@/store/use-photo-store';
import { useStoreStore } from '@/store/use-store-store';
import { PresetTask } from '@/store/preset-tasks';
import { useTasksStore } from '@/store/use-tasks-store';
import { STORE_ITEMS } from '@/store/store-items';
import { TaskCategory } from '@/store/types';

const CATEGORY_EMOJI: Record<TaskCategory, string> = {
  kitchen:     '\ud83c\udf73',
  bathroom:    '\ud83d\udebf',
  bedroom:     '\ud83d\udecf',
  living_room: '\ud83d\udecb',
  laundry:     '\ud83d\udc55',
  trash:       '\ud83d\uddd1',
  other:       '\ud83d\udce6',
};

/**
 * Task states:
 * - idle: not started
 * - pending_photo: user tapped task, can take photo or skip
 * - waiting: time lock counting down before reward
 * - completed: reward claimed
 */
type TaskState = 'idle' | 'pending_photo' | 'waiting' | 'completed';

interface TaskProgress {
  state: TaskState;
  hasPhoto: boolean;
  photoUri?: string;
  waitStartedAt?: number; // unix ms when time lock started
}

export default function TasksScreen() {
  const addTask = useTasksStore((s) => s.addTask);
  const dailyRoll = useTasksStore((s) => s.dailyRoll);
  const refreshDailyRoll = useTasksStore((s) => s.refreshDailyRoll);
  const earnPoints = usePlayerStore((s) => s.earnPoints);
  const recordActivity = usePlayerStore((s) => s.recordActivity);
  const care = usePetStore((s) => s.care);
  const addPhoto = usePhotoStore((s) => s.addPhoto);
  const buyItem = useStoreStore((s) => s.buyItem);
  const scheme = useColorScheme();
  const { accent, accentLight, accentDark, text: accentText } = useMonsterTheme();

  const [taskProgress, setTaskProgress] = useState<Record<string, TaskProgress>>({});
  const [celebration, setCelebration] = useState<string | null>(null);
  const [rewardModal, setRewardModal] = useState<{
    reward: RewardOutcome;
    basePoints: number;
    freeItemName?: string;
  } | null>(null);
  const celebTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isDark = scheme === 'dark';

  // Refresh the roll when the screen mounts in case the date ticked over
  useEffect(() => { refreshDailyRoll(); }, [refreshDailyRoll]);

  const getProgress = (taskId: string): TaskProgress => {
    return taskProgress[taskId] ?? { state: 'idle', hasPhoto: false };
  };

  const showCelebration = useCallback((message: string) => {
    if (celebTimerRef.current) clearTimeout(celebTimerRef.current);
    setCelebration(message);
    celebTimerRef.current = setTimeout(() => setCelebration(null), 2500);
  }, []);

  // Step 1: User taps a task → moves to pending_photo state
  const handleTapTask = useCallback((taskId: string) => {
    setTaskProgress((prev) => ({
      ...prev,
      [taskId]: { state: 'pending_photo', hasPhoto: false },
    }));
  }, []);

  // Step 2a: User takes a photo → then starts time lock
  const handleTakePhoto = useCallback(async (task: PresetTask) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Camera Permission',
        'Camera access is needed to verify completed tasks. You can still complete without a photo.',
        [{ text: 'OK' }]
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.5,
      allowsEditing: false,
    });

    if (result.canceled) return;

    const photoUri = result.assets[0].uri;

    // Save photo record
    addPhoto({ taskId: task.id, photoUri, takenAt: Date.now() });

    // Move to waiting state (time lock starts)
    setTaskProgress((prev) => ({
      ...prev,
      [task.id]: {
        state: 'waiting',
        hasPhoto: true,
        photoUri,
        waitStartedAt: Date.now(),
      },
    }));
  }, [addPhoto]);

  // Step 2b: User skips photo → starts time lock anyway
  const handleSkipPhoto = useCallback((taskId: string) => {
    setTaskProgress((prev) => ({
      ...prev,
      [taskId]: {
        state: 'waiting',
        hasPhoto: false,
        waitStartedAt: Date.now(),
      },
    }));
  }, []);

  // Step 3: Time lock expires → claim reward
  const handleTimerComplete = useCallback((task: PresetTask) => {
    const progress = taskProgress[task.id];
    if (!progress) return;

    // Log the task
    addTask({ ...task, completedAt: Date.now() });
    recordActivity();
    care();

    if (progress.hasPhoto) {
      // Roll reward for photo-verified tasks
      const reward = rollReward();
      const totalPoints = Math.round(task.pointValue * reward.pointsMultiplier);
      earnPoints(totalPoints);

      // Handle free item if applicable
      let freeItemName: string | undefined;
      if (reward.includesFreeItem) {
        const affordableItems = STORE_ITEMS.filter(
          (i) => i.price <= FREE_ITEM_MAX_PRICE && i.repeatable
        );
        if (affordableItems.length > 0) {
          const randomItem = affordableItems[Math.floor(Math.random() * affordableItems.length)];
          buyItem(randomItem);
          freeItemName = `${randomItem.emoji} ${randomItem.name}`;
        }
      }

      // Show reward modal
      setRewardModal({ reward, basePoints: task.pointValue, freeItemName });
    } else {
      // No photo — base points only
      earnPoints(task.pointValue);
      showCelebration(`\u2728 +${task.pointValue} pts (snap a photo next time for bonuses!)`);
    }

    // Mark completed
    setTaskProgress((prev) => ({
      ...prev,
      [task.id]: { ...prev[task.id], state: 'completed' },
    }));
  }, [taskProgress, addTask, recordActivity, care, earnPoints, buyItem, showCelebration]);

  const completedCount = Object.values(taskProgress).filter(
    (p) => p.state === 'completed'
  ).length;

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="title">{"Today\u2019s Tasks"}</ThemedText>
        <View style={styles.subrow}>
          <ThemedText style={styles.count}>
            {completedCount}/{dailyRoll.length} done
          </ThemedText>
          {celebration && (
            <View style={[styles.celebrationPill, { backgroundColor: isDark ? accentDark : accentLight }]}>
              <Text style={[styles.celebrationText, { color: isDark ? accentLight : accentText }]}>
                {celebration}
              </Text>
            </View>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {dailyRoll.map((task) => {
          const progress = getProgress(task.id);
          const minTime = TASK_MIN_TIMES[task.id] ?? DEFAULT_MIN_TIME;

          return (
            <View
              key={task.id}
              style={[
                styles.taskCard,
                isDark ? styles.taskCardDark : styles.taskCardLight,
                progress.state === 'completed' && styles.taskCardCompleted,
              ]}
            >
              {/* Task header row */}
              <View style={styles.taskRow}>
                <View style={[
                  styles.checkbox,
                  progress.state === 'completed' && { backgroundColor: accent, borderColor: accent },
                ]}>
                  {progress.state === 'completed' && <Text style={styles.checkmark}>{'\u2713'}</Text>}
                </View>
                <View style={styles.taskInfo}>
                  <ThemedText style={[styles.taskLabel, progress.state === 'completed' && styles.taskLabelDone]}>
                    {task.label}
                  </ThemedText>
                  <ThemedText style={styles.categoryLabel}>
                    {CATEGORY_EMOJI[task.category]} {task.category.replace('_', ' ')}
                  </ThemedText>
                </View>
                <Text style={[styles.pointsText, progress.state === 'completed' ? { color: accent } : styles.pointsPending]}>
                  +{task.pointValue}
                </Text>
              </View>

              {/* State: idle — show "Mark Done" button */}
              {progress.state === 'idle' && (
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: accent }]}
                  onPress={() => handleTapTask(task.id)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.actionButtonText}>
                    {'\u2705'} Mark Done
                  </Text>
                </TouchableOpacity>
              )}

              {/* State: pending_photo — show photo + skip options */}
              {progress.state === 'pending_photo' && (
                <View style={styles.photoSection}>
                  <Text style={[styles.photoPrompt, { color: isDark ? '#ccc' : '#555' }]}>
                    Take a photo for bonus rewards!
                  </Text>
                  <View style={styles.photoActions}>
                    <TouchableOpacity
                      style={[styles.photoButton, { backgroundColor: accent }]}
                      onPress={() => handleTakePhoto(task)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.photoButtonText}>
                        {'\ud83d\udcf8'} Snap Photo
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.skipButton}
                      onPress={() => handleSkipPhoto(task.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.skipButtonText, { color: isDark ? '#888' : '#999' }]}>
                        Skip
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* State: waiting — show timer countdown */}
              {progress.state === 'waiting' && (
                <View style={styles.waitingSection}>
                  {progress.hasPhoto && (
                    <View style={[styles.photoBadge, { backgroundColor: isDark ? accentDark : accentLight }]}>
                      <Text style={[styles.photoBadgeText, { color: accentText }]}>
                        {'\ud83d\udcf7'} Photo saved
                      </Text>
                    </View>
                  )}
                  <TaskTimer
                    totalSeconds={minTime}
                    onComplete={() => handleTimerComplete(task)}
                    active={true}
                  />
                  <Text style={[styles.waitHint, { color: isDark ? '#888' : '#999' }]}>
                    Reward in progress...
                  </Text>
                </View>
              )}

              {/* State: completed — show verified badge */}
              {progress.state === 'completed' && (
                <View style={[styles.completedBadge, { backgroundColor: isDark ? accentDark : accentLight }]}>
                  <Text style={[styles.completedText, { color: accentText }]}>
                    {progress.hasPhoto ? '\ud83d\udcf7 Verified & rewarded' : '\u2728 Completed'}
                  </Text>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* Reward modal overlay */}
      {rewardModal && (
        <PhotoRewardModal
          reward={rewardModal.reward}
          basePoints={rewardModal.basePoints}
          freeItemName={rewardModal.freeItemName}
          onDismiss={() => setRewardModal(null)}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60, paddingHorizontal: 20 },
  header: { marginBottom: 20, gap: 8 },
  subrow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  count: { opacity: 0.5, fontSize: 14 },
  celebrationPill: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    flexShrink: 1,
  },
  celebrationText: { fontWeight: '600', fontSize: 12 },
  list: { gap: 12, paddingBottom: 40 },
  taskCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  taskCardLight: { backgroundColor: '#f8f9fa', borderColor: '#e2e5e8' },
  taskCardDark: { backgroundColor: '#1e2124', borderColor: '#2e3236' },
  taskCardCompleted: { opacity: 0.7 },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#aaa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: '700' },
  taskInfo: { flex: 1, gap: 3 },
  taskLabel: { fontSize: 16, fontWeight: '500' },
  taskLabelDone: { opacity: 0.45 },
  categoryLabel: { fontSize: 12, opacity: 0.5, textTransform: 'capitalize' },
  pointsText: { fontWeight: '700', fontSize: 15 },
  pointsPending: { color: '#0a7ea4' },
  actionButton: {
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  photoSection: {
    gap: 8,
  },
  photoPrompt: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  photoActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  photoButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  photoButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  skipButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  skipButtonText: {
    fontSize: 13,
    fontWeight: '500',
  },
  waitingSection: {
    gap: 6,
  },
  photoBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  photoBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  waitHint: {
    fontSize: 12,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  completedBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  completedText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
