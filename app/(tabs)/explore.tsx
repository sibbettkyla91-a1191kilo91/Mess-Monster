import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";

import { PhotoRewardModal } from "@/components/photo-reward-modal";
import { TaskTimer } from "@/components/task-timer";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import {
  DEFAULT_MIN_TIME,
  FREE_ITEM_MAX_PRICE,
  RewardOutcome,
  TASK_MIN_TIMES,
  rollReward,
} from "@/constants/task-timers";
import { useMonsterTheme } from "@/hooks/use-monster-theme";
import {
  requestNudgePermission,
  rescheduleDailyNudges,
} from "@/utils/daily-nudge";
import { PresetTask } from "@/store/preset-tasks";
import { STORE_ITEMS } from "@/store/store-items";
import { TaskCategory } from "@/store/types";
import { usePetStore } from "@/store/use-pet-store";
import { usePhotoStore } from "@/store/use-photo-store";
import { usePlayerStore } from "@/store/use-player-store";
import { useStoreStore } from "@/store/use-store-store";
import {
  PendingReward,
  TaskProgress,
  useTasksStore,
} from "@/store/use-tasks-store";

const CATEGORY_EMOJI: Record<TaskCategory, string> = {
  kitchen: "\ud83c\udf73",
  bathroom: "\ud83d\udebf",
  bedroom: "\ud83d\udecf",
  living_room: "\ud83d\udecb",
  laundry: "\ud83d\udc55",
  trash: "\ud83d\uddd1",
  other: "\ud83d\udce6",
};

export default function TasksScreen() {
  const addTask = useTasksStore((s) => s.addTask);
  const dailyRoll = useTasksStore((s) => s.dailyRoll);
  const refreshDailyRoll = useTasksStore((s) => s.refreshDailyRoll);
  const earnPoints = usePlayerStore((s) => s.earnPoints);
  const recordActivity = usePlayerStore((s) => s.recordActivity);
  const monsterName = usePlayerStore((s) => s.monsterName);
  const notifPermissionAsked = usePlayerStore((s) => s.notifPermissionAsked);
  const markNotifPermissionAsked = usePlayerStore(
    (s) => s.markNotifPermissionAsked,
  );
  const care = usePetStore((s) => s.care);
  const trackEarned = usePetStore((s) => s.trackEarned);
  const checkStreakMilestones = usePetStore((s) => s.checkStreakMilestones);
  const addPhoto = usePhotoStore((s) => s.addPhoto);
  const buyItem = useStoreStore((s) => s.buyItem);
  const scheme = useColorScheme();
  const {
    accent,
    accentLight,
    accentDark,
    text: accentText,
  } = useMonsterTheme();

  // Persisted in the tasks store so a restart mid-wait resumes the time lock
  const taskProgress = useTasksStore((s) => s.taskProgress);
  const setTaskProgress = useTasksStore((s) => s.setTaskProgress);
  const pendingRewards = useTasksStore((s) => s.pendingRewards);
  const claimPendingReward = useTasksStore((s) => s.claimPendingReward);

  const [celebration, setCelebration] = useState<string | null>(null);
  const [rewardModal, setRewardModal] = useState<{
    reward: RewardOutcome;
    basePoints: number;
    freeItemName?: string;
  } | null>(null);
  const celebTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isDark = scheme === "dark";

  // Refresh the roll when the screen mounts in case the date ticked over
  useEffect(() => {
    refreshDailyRoll();
  }, [refreshDailyRoll]);

  const getProgress = (taskId: string): TaskProgress => {
    return taskProgress[taskId] ?? { state: "idle", hasPhoto: false };
  };

  const showCelebration = useCallback((message: string) => {
    if (celebTimerRef.current) clearTimeout(celebTimerRef.current);
    setCelebration(message);
    celebTimerRef.current = setTimeout(() => setCelebration(null), 2500);
  }, []);

  // Step 1: User taps a task → moves to pending_photo state
  const handleTapTask = useCallback(
    (taskId: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setTaskProgress(taskId, { state: "pending_photo", hasPhoto: false });
    },
    [setTaskProgress],
  );

  // Step 2a: User takes a photo → then starts time lock
  const handleTakePhoto = useCallback(
    async (task: PresetTask) => {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Camera Permission",
          "Camera access is needed to verify completed tasks. You can still complete without a photo.",
          [{ text: "OK" }],
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 0.5,
        allowsEditing: false,
      });

      if (result.canceled) return;

      const photoUri = result.assets[0].uri;

      // Haptic feedback for photo capture
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      // Save photo record
      addPhoto({ taskId: task.id, photoUri, takenAt: Date.now() });

      // Move to waiting state (time lock starts)
      setTaskProgress(task.id, {
        state: "waiting",
        hasPhoto: true,
        photoUri,
        waitStartedAt: Date.now(),
      });
    },
    [addPhoto, setTaskProgress],
  );

  // Step 2b: User skips photo → starts time lock anyway
  const handleSkipPhoto = useCallback(
    (taskId: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setTaskProgress(taskId, {
        state: "waiting",
        hasPhoto: false,
        waitStartedAt: Date.now(),
      });
    },
    [setTaskProgress],
  );

  // Step 3: Time lock expires → show claim button (don't award yet)
  const handleTimerComplete = useCallback(
    (task: PresetTask) => {
      const progress = taskProgress[task.id];
      // Only transition out of "waiting" — guards against a duplicate reward
      // roll if the timer fires again across a remount.
      if (!progress || progress.state !== "waiting") return;

      if (progress.hasPhoto) {
        // Calculate photo reward
        const reward = rollReward();
        const finalPoints = Math.round(
          task.pointValue * reward.pointsMultiplier,
        );

        // Handle free item if applicable
        let freeItemName: string | undefined;
        if (reward.includesFreeItem) {
          const affordableItems = STORE_ITEMS.filter(
            (i) => i.price <= FREE_ITEM_MAX_PRICE && i.repeatable,
          );
          if (affordableItems.length > 0) {
            const randomItem =
              affordableItems[
                Math.floor(Math.random() * affordableItems.length)
              ];
            buyItem(randomItem);
            freeItemName = `${randomItem.emoji} ${randomItem.name}`;
          }
        }

        // Transition to reward_ready with reward info
        setTaskProgress(task.id, {
          ...progress,
          state: "reward_ready",
          rewardInfo: {
            basePoints: task.pointValue,
            pointsMultiplier: reward.pointsMultiplier,
            finalPoints,
            freeItemName,
            outcome: reward,
          },
        });
      } else {
        // No photo — base points only
        setTaskProgress(task.id, {
          ...progress,
          state: "reward_ready",
          rewardInfo: {
            basePoints: task.pointValue,
            pointsMultiplier: 1,
            finalPoints: task.pointValue,
          },
        });
      }
    },
    [taskProgress, buyItem, setTaskProgress],
  );

  // Step 4: User claims reward → award points and mark as claimed
  const handleClaimReward = useCallback(
    (task: PresetTask) => {
      const progress = taskProgress[task.id];
      if (!progress || !progress.rewardInfo) return;

      const { finalPoints } = progress.rewardInfo;

      // Strong success haptic feedback for reward claim
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Award points and track
      earnPoints(finalPoints);
      trackEarned(finalPoints, task.category);

      // Log the task
      addTask({ ...task, completedAt: Date.now() });
      recordActivity();
      checkStreakMilestones();
      care();

      // Mark as claimed
      setTaskProgress(task.id, { ...progress, state: "claimed" });

      // Photo-verified tasks get the full celebration modal; others get the
      // lightweight pill.
      const { outcome, basePoints, freeItemName } = progress.rewardInfo;
      if (progress.hasPhoto && outcome) {
        setRewardModal({ reward: outcome, basePoints, freeItemName });
      } else {
        showCelebration(`\u2728 +${finalPoints} pts claimed!`);
      }

      // First reward claim is the moment we ask about gentle reminders \u2014
      // the loop just paid off, so the request has context. Asked once ever.
      if (!notifPermissionAsked) {
        markNotifPermissionAsked();
        void requestNudgePermission().then((granted) => {
          if (granted) void rescheduleDailyNudges(monsterName, true);
        });
      }
    },
    [
      taskProgress,
      earnPoints,
      trackEarned,
      addTask,
      recordActivity,
      checkStreakMilestones,
      care,
      showCelebration,
      setTaskProgress,
      notifPermissionAsked,
      markNotifPermissionAsked,
      monsterName,
    ],
  );

  // Claiming a reward carried over from an earlier day. Awards points and
  // logs the task, but deliberately does NOT call recordActivity or
  // checkStreakMilestones: streaks answer "did I clean today" and stay a
  // per-day system, while reward collection is independent and never expires.
  const handleClaimCarriedReward = useCallback(
    (reward: PendingReward) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const { finalPoints } = reward.rewardInfo;
      earnPoints(finalPoints);
      trackEarned(finalPoints, reward.category);
      addTask({
        id: reward.taskId,
        label: reward.label,
        category: reward.category,
        pointValue: reward.pointValue,
        completedAt: Date.now(),
      });
      care();

      claimPendingReward(reward.id);

      const { outcome, basePoints, freeItemName } = reward.rewardInfo;
      if (reward.hasPhoto && outcome) {
        setRewardModal({ reward: outcome, basePoints, freeItemName });
      } else {
        showCelebration(`✨ +${finalPoints} pts claimed!`);
      }

      if (!notifPermissionAsked) {
        markNotifPermissionAsked();
        void requestNudgePermission().then((granted) => {
          if (granted) void rescheduleDailyNudges(monsterName, true);
        });
      }
    },
    [
      earnPoints,
      trackEarned,
      addTask,
      care,
      claimPendingReward,
      showCelebration,
      notifPermissionAsked,
      markNotifPermissionAsked,
      monsterName,
    ],
  );

  const completedCount = Object.values(taskProgress).filter(
    (p) => p.state === "claimed",
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
            <View
              style={[
                styles.celebrationPill,
                { backgroundColor: isDark ? accentDark : accentLight },
              ]}
            >
              <Text
                style={[
                  styles.celebrationText,
                  { color: isDark ? accentLight : accentText },
                ]}
              >
                {celebration}
              </Text>
            </View>
          )}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      >
        {/* Rewards earned on earlier days that were never collected. They
            never expire — zero shame, no lost progress. */}
        {pendingRewards.length > 0 && (
          <View style={styles.carriedSection}>
            <ThemedText style={styles.carriedTitle}>
              {"🎁"} Rewards waiting for you
            </ThemedText>
            <ThemedText style={styles.carriedSubtitle}>
              Earned earlier — yours whenever you&apos;re ready.
            </ThemedText>
            {pendingRewards.map((reward) => (
              <View
                key={reward.id}
                style={[
                  styles.taskCard,
                  isDark ? styles.taskCardDark : styles.taskCardLight,
                ]}
              >
                <View style={styles.taskRow}>
                  <View style={styles.taskInfo}>
                    <ThemedText style={styles.taskLabel}>
                      {reward.label}
                    </ThemedText>
                    <ThemedText style={styles.categoryLabel}>
                      {CATEGORY_EMOJI[reward.category]}{" "}
                      {reward.category.replace("_", " ")}
                    </ThemedText>
                  </View>
                  <Text style={[styles.pointsText, { color: accent }]}>
                    +{reward.rewardInfo.finalPoints}
                  </Text>
                </View>
                {reward.rewardInfo.freeItemName && (
                  <Text
                    style={[
                      styles.freeItemText,
                      { color: isDark ? "#aaa" : "#666" },
                    ]}
                  >
                    + {reward.rewardInfo.freeItemName}
                  </Text>
                )}
                <TouchableOpacity
                  style={[styles.claimButton, { backgroundColor: accent }]}
                  onPress={() => handleClaimCarriedReward(reward)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.claimButtonText}>
                    {"🌟"} Claim Reward
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {dailyRoll.map((task) => {
          const progress = getProgress(task.id);
          const minTime = TASK_MIN_TIMES[task.id] ?? DEFAULT_MIN_TIME;

          return (
            <View
              key={task.id}
              style={[
                styles.taskCard,
                isDark ? styles.taskCardDark : styles.taskCardLight,
                progress.state === "claimed" && styles.taskCardCompleted,
              ]}
            >
              {/* Task header row */}
              <View style={styles.taskRow}>
                <View
                  style={[
                    styles.checkbox,
                    progress.state === "claimed" && {
                      backgroundColor: accent,
                      borderColor: accent,
                    },
                  ]}
                >
                  {progress.state === "claimed" && (
                    <Text style={styles.checkmark}>{"\u2713"}</Text>
                  )}
                </View>
                <View style={styles.taskInfo}>
                  <ThemedText
                    style={[
                      styles.taskLabel,
                      progress.state === "claimed" && styles.taskLabelDone,
                    ]}
                  >
                    {task.label}
                  </ThemedText>
                  <ThemedText style={styles.categoryLabel}>
                    {CATEGORY_EMOJI[task.category]}{" "}
                    {task.category.replace("_", " ")}
                  </ThemedText>
                </View>
                <Text
                  style={[
                    styles.pointsText,
                    progress.state === "claimed"
                      ? { color: accent }
                      : styles.pointsPending,
                  ]}
                >
                  +{task.pointValue}
                </Text>
              </View>

              {/* State: idle — show "Mark Done" button */}
              {progress.state === "idle" && (
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: accent }]}
                  onPress={() => handleTapTask(task.id)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.actionButtonText}>
                    {"\u2705"} Mark Done
                  </Text>
                </TouchableOpacity>
              )}

              {/* State: pending_photo — show photo + skip options */}
              {progress.state === "pending_photo" && (
                <View style={styles.photoSection}>
                  <Text
                    style={[
                      styles.photoPrompt,
                      { color: isDark ? "#ccc" : "#555" },
                    ]}
                  >
                    Take a photo for bonus rewards!
                  </Text>
                  <View style={styles.photoActions}>
                    <TouchableOpacity
                      style={[styles.photoButton, { backgroundColor: accent }]}
                      onPress={() => handleTakePhoto(task)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.photoButtonText}>
                        {"\ud83d\udcf8"} Snap Photo
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.skipButton}
                      onPress={() => handleSkipPhoto(task.id)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.skipButtonText,
                          { color: isDark ? "#888" : "#999" },
                        ]}
                      >
                        Skip
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* State: waiting — show timer countdown */}
              {progress.state === "waiting" && (
                <View style={styles.waitingSection}>
                  {progress.hasPhoto && (
                    <View
                      style={[
                        styles.photoBadge,
                        { backgroundColor: isDark ? accentDark : accentLight },
                      ]}
                    >
                      <Text
                        style={[styles.photoBadgeText, { color: accentText }]}
                      >
                        {"\ud83d\udcf7"} Photo saved
                      </Text>
                    </View>
                  )}
                  <TaskTimer
                    totalSeconds={minTime}
                    startedAt={progress.waitStartedAt ?? Date.now()}
                    onComplete={() => handleTimerComplete(task)}
                    active={true}
                  />
                  <Text
                    style={[
                      styles.waitHint,
                      { color: isDark ? "#888" : "#999" },
                    ]}
                  >
                    Reward ready when timer expires...
                  </Text>
                </View>
              )}

              {/* State: reward_ready — show claim button with point breakdown */}
              {progress.state === "reward_ready" && progress.rewardInfo && (
                <View style={styles.rewardSection}>
                  <View
                    style={[
                      styles.rewardBreakdown,
                      { backgroundColor: isDark ? "#2a2a3e" : "#f5f5f5" },
                    ]}
                  >
                    <Text
                      style={[
                        styles.rewardLabel,
                        { color: isDark ? "#ccc" : "#555" },
                      ]}
                    >
                      Base: {progress.rewardInfo.basePoints} pts
                    </Text>
                    {progress.rewardInfo.pointsMultiplier > 1 && (
                      <Text
                        style={[
                          styles.rewardLabel,
                          { color: accent, fontWeight: "700" },
                        ]}
                      >
                        × {progress.rewardInfo.pointsMultiplier.toFixed(1)}{" "}
                        bonus
                      </Text>
                    )}
                    <Text style={[styles.rewardTotal, { color: accent }]}>
                      = {progress.rewardInfo.finalPoints} pts
                    </Text>
                  </View>
                  {progress.rewardInfo.freeItemName && (
                    <Text
                      style={[
                        styles.freeItemText,
                        { color: isDark ? "#aaa" : "#666" },
                      ]}
                    >
                      + {progress.rewardInfo.freeItemName}
                    </Text>
                  )}
                  <TouchableOpacity
                    style={[styles.claimButton, { backgroundColor: accent }]}
                    onPress={() => handleClaimReward(task)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.claimButtonText}>
                      {"\ud83c\udf1f"} Claim Reward
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* State: claimed — show verified badge */}
              {progress.state === "claimed" && (
                <View
                  style={[
                    styles.completedBadge,
                    { backgroundColor: isDark ? accentDark : accentLight },
                  ]}
                >
                  <Text style={[styles.completedText, { color: accentText }]}>
                    {"\u2705"} Claimed
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
  subrow: { flexDirection: "row", alignItems: "center", gap: 10 },
  count: { opacity: 0.5, fontSize: 14 },
  celebrationPill: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    flexShrink: 1,
  },
  celebrationText: { fontWeight: "600", fontSize: 12 },
  list: { gap: 12, paddingBottom: 40 },
  carriedSection: { gap: 12 },
  carriedTitle: { fontSize: 16, fontWeight: "700" },
  carriedSubtitle: { fontSize: 12, opacity: 0.5, marginTop: -8 },
  taskCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  taskCardLight: { backgroundColor: "#f8f9fa", borderColor: "#e2e5e8" },
  taskCardDark: { backgroundColor: "#1e2124", borderColor: "#2e3236" },
  taskCardCompleted: { opacity: 0.7 },
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#aaa",
    alignItems: "center",
    justifyContent: "center",
  },
  checkmark: { color: "#fff", fontSize: 13, fontWeight: "700" },
  taskInfo: { flex: 1, gap: 3 },
  taskLabel: { fontSize: 16, fontWeight: "500" },
  taskLabelDone: { opacity: 0.45 },
  categoryLabel: { fontSize: 12, opacity: 0.5, textTransform: "capitalize" },
  pointsText: { fontWeight: "700", fontSize: 15 },
  pointsPending: { color: "#0a7ea4" },
  actionButton: {
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  actionButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
  photoSection: {
    gap: 8,
  },
  photoPrompt: {
    fontSize: 13,
    fontWeight: "500",
    textAlign: "center",
  },
  photoActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  photoButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  photoButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
  skipButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  skipButtonText: {
    fontSize: 13,
    fontWeight: "500",
  },
  waitingSection: {
    gap: 6,
  },
  photoBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  photoBadgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  waitHint: {
    fontSize: 12,
    textAlign: "center",
    fontStyle: "italic",
  },
  completedBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  completedText: {
    fontSize: 12,
    fontWeight: "600",
  },
  rewardSection: {
    gap: 10,
  },
  rewardBreakdown: {
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  rewardLabel: {
    fontSize: 13,
    fontWeight: "500",
  },
  rewardTotal: {
    fontSize: 14,
    fontWeight: "700",
    marginTop: 4,
  },
  freeItemText: {
    fontSize: 12,
    textAlign: "center",
    fontStyle: "italic",
  },
  claimButton: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  claimButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
});
