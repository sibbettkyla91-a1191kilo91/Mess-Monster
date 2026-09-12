import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { PhotoRewardModal } from "@/components/photo-reward-modal";
import { TaskTimer } from "@/components/task-timer";
import {
  DEFAULT_MIN_TIME,
  RewardOutcome,
  TASK_MIN_TIMES,
  rollReward,
} from "@/constants/task-timers";
import { useHasHydrated } from "@/hooks/use-has-hydrated";
import { useMonsterTheme } from "@/hooks/use-monster-theme";
import {
  requestNudgePermission,
  rescheduleDailyNudges,
} from "@/utils/daily-nudge";
import { PresetTask } from "@/store/preset-tasks";
import { finishPhotoTaskWait } from "@/store/photo-task-reward";
import { recoverUnsettledGrants } from "@/store/recover-unsettled-grants";
import { usePetStore } from "@/store/use-pet-store";
import { usePhotoStore } from "@/store/use-photo-store";
import { usePlayerStore } from "@/store/use-player-store";
import { useStoreStore } from "@/store/use-store-store";
import {
  PendingReward,
  TaskProgress,
  useTasksStore,
} from "@/store/use-tasks-store";

const fontRounded = Platform.select({
  ios: "ui-rounded",
  android: "sans-serif-medium",
  default: "system-ui",
});

export default function TasksScreen() {
  const dailyRoll = useTasksStore((s) => s.dailyRoll);
  const refreshDailyRoll = useTasksStore((s) => s.refreshDailyRoll);
  const monsterName = usePlayerStore((s) => s.monsterName);
  const notifPermissionAsked = usePlayerStore((s) => s.notifPermissionAsked);
  const markNotifPermissionAsked = usePlayerStore(
    (s) => s.markNotifPermissionAsked,
  );
  const addPhoto = usePhotoStore((s) => s.addPhoto);
  // The task flow writes to all five persisted stores; a write landing before
  // AsyncStorage rehydration completes gets clobbered when the hydration
  // merge arrives, so the task list stays closed until every store is ready.
  const tasksHydrated = useHasHydrated(useTasksStore);
  const playerHydrated = useHasHydrated(usePlayerStore);
  const petHydrated = useHasHydrated(usePetStore);
  const photoHydrated = useHasHydrated(usePhotoStore);
  const storeHydrated = useHasHydrated(useStoreStore);
  const hydrated =
    tasksHydrated &&
    playerHydrated &&
    petHydrated &&
    photoHydrated &&
    storeHydrated;
  const {
    accent,
    accentInk,
    accentSoft,
    onSoft,
    page,
    surface,
    surfaceRaised,
    ink,
    inkMuted,
    line,
    monster,
  } = useMonsterTheme();

  // Persisted in the tasks store so a restart mid-wait resumes the time lock
  const taskProgress = useTasksStore((s) => s.taskProgress);
  const setTaskProgress = useTasksStore((s) => s.setTaskProgress);
  const pendingRewards = useTasksStore((s) => s.pendingRewards);
  const claimTaskReward = useTasksStore((s) => s.claimTaskReward);
  const claimPendingReward = useTasksStore((s) => s.claimPendingReward);

  const [celebration, setCelebration] = useState<string | null>(null);
  const [rewardModal, setRewardModal] = useState<{
    reward: RewardOutcome;
    basePoints: number;
    freeItemName?: string;
  } | null>(null);
  const celebTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setReduceMotion(value);
    });
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion,
    );
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  // Refresh the roll when the screen mounts in case the date ticked over.
  // Waits for hydration: pre-hydration the store still holds defaults, and
  // the tasks store already refreshes itself in onRehydrateStorage.
  useEffect(() => {
    if (hydrated) refreshDailyRoll();
  }, [hydrated, refreshDailyRoll]);

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
      // Backstop for the render gate: writes made before rehydration
      // completes get clobbered by the hydration merge.
      if (!hydrated) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setTaskProgress(taskId, { state: "pending_photo", hasPhoto: false });
    },
    [hydrated, setTaskProgress],
  );

  // Step 2a: User takes a photo → then starts time lock
  const handleTakePhoto = useCallback(
    async (task: PresetTask) => {
      if (!hydrated) return;
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
    [hydrated, addPhoto, setTaskProgress],
  );

  // Step 2b: User skips photo → starts time lock anyway
  const handleSkipPhoto = useCallback(
    (taskId: string) => {
      if (!hydrated) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setTaskProgress(taskId, {
        state: "waiting",
        hasPhoto: false,
        waitStartedAt: Date.now(),
      });
    },
    [hydrated, setTaskProgress],
  );

  // Step 3: Time lock expires → show claim button (don't award yet).
  // A free snack is recorded on the roll here and granted at claim, so a
  // crash before claim cannot add a second item if the timer fires again.
  const handleTimerComplete = useCallback(
    (task: PresetTask) => {
      if (!hydrated) return;
      const progress = taskProgress[task.id];
      // Only transition out of "waiting" — guards against a duplicate reward
      // roll if the timer fires again across a remount.
      if (!progress || progress.state !== "waiting") return;

      if (progress.hasPhoto) {
        setTaskProgress(
          task.id,
          finishPhotoTaskWait(task, progress, rollReward()),
        );
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
    [hydrated, taskProgress, setTaskProgress],
  );

  // Step 4: User claims reward → award points and mark as claimed
  const handleClaimReward = useCallback(
    (task: PresetTask) => {
      if (!hydrated) return;
      const progress = claimTaskReward(task.id);
      if (!progress) return;

      const { finalPoints } = progress.rewardInfo!;

      // Strong success haptic feedback for reward claim
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Reservation already persisted the unsettled grant. Apply (or resume)
      // points / tracking / history / activity / care through the same
      // idempotent recovery path used after a crash.
      recoverUnsettledGrants();

      // Photo-verified tasks get the full celebration modal; others get the
      // lightweight pill.
      const { outcome, basePoints, freeItemName } = progress.rewardInfo!;
      if (progress.hasPhoto && outcome) {
        setRewardModal({ reward: outcome, basePoints, freeItemName });
      } else {
        showCelebration(`✨ +${finalPoints} pts claimed!`);
      }

      // First reward claim is the moment we ask about gentle reminders —
      // the loop just paid off, so the request has context. Asked once ever.
      if (!notifPermissionAsked) {
        markNotifPermissionAsked();
        void requestNudgePermission().then((granted) => {
          if (granted) void rescheduleDailyNudges(monsterName, true);
        });
      }
    },
    [
      hydrated,
      claimTaskReward,
      showCelebration,
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
      if (!hydrated) return;
      const claimedReward = claimPendingReward(reward.id);
      if (!claimedReward) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const { finalPoints } = claimedReward.rewardInfo;
      recoverUnsettledGrants();

      const { outcome, basePoints, freeItemName } = claimedReward.rewardInfo;
      if (claimedReward.hasPhoto && outcome) {
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
      hydrated,
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

  const isLuna = monster === "luna";
  const photoPrompt = isLuna
    ? "Seal it with a photo?"
    : "Photo for a better treat?";

  const cardLift = isLuna
    ? null
    : {
        shadowColor: ink,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
      };

  const claimLift = {
    shadowColor: accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 6,
  };

  const pressScale = (pressed: boolean) =>
    reduceMotion ? 1 : pressed ? 0.98 : 1;

  return (
    <View style={[styles.container, { backgroundColor: page }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: ink, fontFamily: fontRounded }]}>
          Today
        </Text>
        <View style={styles.subrow}>
          <Text style={[styles.count, { color: inkMuted }]}>
            {completedCount}/{dailyRoll.length} claimed
          </Text>
          {celebration && (
            <View
              style={[styles.celebrationPill, { backgroundColor: accentSoft }]}
            >
              <Text style={[styles.celebrationText, { color: onSoft }]}>
                {celebration}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Task list — held behind a brief loading moment on cold start so a
          fast tap can't land before persisted progress finishes loading. */}
      {!hydrated ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={accent} />
          <Text style={[styles.loadingText, { color: inkMuted }]}>
            Lining up today…
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        >
          {/* Rewards earned on earlier days that were never collected. They
            never expire — zero shame, no lost progress. */}
          {pendingRewards.length > 0 && (
            <View style={styles.carriedSection}>
              <Text style={[styles.carriedTitle, { color: ink }]}>
                Still yours
              </Text>
              <Text style={[styles.carriedSubtitle, { color: inkMuted }]}>
                From earlier — claim whenever you want.
              </Text>
              {pendingRewards.map((reward) => (
                <View
                  key={reward.id}
                  style={[
                    styles.taskCard,
                    {
                      backgroundColor: surfaceRaised,
                      borderColor: line,
                    },
                    cardLift,
                  ]}
                >
                  <View
                    style={[styles.carriedBar, { backgroundColor: accent }]}
                  />
                  <View style={styles.taskRow}>
                    <View style={styles.taskInfo}>
                      <Text
                        style={[
                          styles.taskLabel,
                          { color: ink, fontFamily: fontRounded },
                        ]}
                      >
                        {reward.label}
                      </Text>
                      <Text style={[styles.categoryLabel, { color: inkMuted }]}>
                        {reward.category.replace("_", " ")}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.pointsText,
                        { color: accent, fontFamily: fontRounded },
                      ]}
                    >
                      +{reward.rewardInfo.finalPoints}
                    </Text>
                  </View>
                  {reward.rewardInfo.freeItemName && (
                    <Text style={[styles.freeItemText, { color: inkMuted }]}>
                      + {reward.rewardInfo.freeItemName}
                    </Text>
                  )}
                  <Pressable
                    style={({ pressed }) => [
                      styles.claimButton,
                      { backgroundColor: accent },
                      claimLift,
                      {
                        opacity: pressed ? 0.88 : 1,
                        transform: [{ scale: pressScale(pressed) }],
                      },
                    ]}
                    onPress={() => handleClaimCarriedReward(reward)}
                    accessibilityRole="button"
                    accessibilityLabel="Claim reward"
                  >
                    <Text
                      style={[
                        styles.claimButtonText,
                        { color: accentInk, fontFamily: fontRounded },
                      ]}
                    >
                      Claim reward
                    </Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          {dailyRoll.map((task) => {
            const progress = getProgress(task.id);
            const minTime = TASK_MIN_TIMES[task.id] ?? DEFAULT_MIN_TIME;
            const isReady = progress.state === "reward_ready";
            const isClaimed = progress.state === "claimed";

            return (
              <View
                key={task.id}
                style={[
                  styles.taskCard,
                  {
                    backgroundColor: isReady ? surfaceRaised : surface,
                    borderColor: isReady ? accent : line,
                    borderWidth: isReady ? 1.5 : 1,
                    opacity: isClaimed ? 0.64 : 1,
                  },
                  cardLift,
                ]}
              >
                {/* Task header row */}
                <View style={styles.taskRow}>
                  <View
                    style={[
                      styles.checkbox,
                      { borderColor: line },
                      isClaimed && {
                        backgroundColor: accent,
                        borderColor: accent,
                      },
                    ]}
                  >
                    {isClaimed && (
                      <Text style={[styles.checkmark, { color: accentInk }]}>
                        {"✓"}
                      </Text>
                    )}
                  </View>
                  <View style={styles.taskInfo}>
                    <Text
                      style={[
                        styles.taskLabel,
                        {
                          color: isClaimed ? inkMuted : ink,
                          fontWeight: isClaimed ? "500" : "600",
                          fontFamily: fontRounded,
                        },
                      ]}
                    >
                      {task.label}
                    </Text>
                    <Text style={[styles.categoryLabel, { color: inkMuted }]}>
                      {task.category.replace("_", " ")}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.pointsText,
                      {
                        color: accent,
                        opacity: isClaimed ? 1 : 0.7,
                        fontFamily: fontRounded,
                      },
                    ]}
                  >
                    +{task.pointValue}
                  </Text>
                </View>

                {/* State: idle — show "Mark done" button */}
                {progress.state === "idle" && (
                  <Pressable
                    style={({ pressed }) => [
                      styles.actionButton,
                      { backgroundColor: accent },
                      {
                        opacity: pressed ? 0.88 : 1,
                        transform: [{ scale: pressScale(pressed) }],
                      },
                    ]}
                    onPress={() => handleTapTask(task.id)}
                    accessibilityRole="button"
                    accessibilityLabel="Mark done"
                  >
                    <Text
                      style={[
                        styles.actionButtonText,
                        { color: accentInk, fontFamily: fontRounded },
                      ]}
                    >
                      That{"'"}s done
                    </Text>
                  </Pressable>
                )}

                {/* State: pending_photo — show photo + skip options */}
                {progress.state === "pending_photo" && (
                  <View style={styles.photoSection}>
                    <View
                      style={[
                        styles.photoChrome,
                        { backgroundColor: accentSoft },
                      ]}
                    >
                      <Text style={[styles.photoPrompt, { color: onSoft }]}>
                        {photoPrompt}
                      </Text>
                    </View>
                    <View style={styles.photoActions}>
                      <Pressable
                        style={({ pressed }) => [
                          styles.photoButton,
                          { backgroundColor: accent },
                          {
                            opacity: pressed ? 0.88 : 1,
                            transform: [{ scale: pressScale(pressed) }],
                          },
                        ]}
                        onPress={() => handleTakePhoto(task)}
                        accessibilityRole="button"
                        accessibilityLabel="Snap photo"
                      >
                        <Text
                          style={[
                            styles.photoButtonText,
                            { color: accentInk, fontFamily: fontRounded },
                          ]}
                        >
                          Snap photo
                        </Text>
                      </Pressable>
                      <Pressable
                        style={styles.skipButton}
                        onPress={() => handleSkipPhoto(task.id)}
                        accessibilityRole="button"
                        accessibilityLabel="Skip photo"
                      >
                        <Text
                          style={[styles.skipButtonText, { color: inkMuted }]}
                        >
                          Skip
                        </Text>
                      </Pressable>
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
                          { backgroundColor: accentSoft },
                        ]}
                      >
                        <Text
                          style={[styles.photoBadgeText, { color: onSoft }]}
                        >
                          Photo saved
                        </Text>
                      </View>
                    )}
                    <TaskTimer
                      totalSeconds={minTime}
                      startedAt={progress.waitStartedAt ?? Date.now()}
                      onComplete={() => handleTimerComplete(task)}
                      active={true}
                    />
                    <Text style={[styles.waitHint, { color: inkMuted }]}>
                      Settling. The reward waits on the timer.
                    </Text>
                  </View>
                )}

                {/* State: reward_ready — show claim button with point breakdown */}
                {isReady && progress.rewardInfo && (
                  <View style={styles.rewardSection}>
                    <View
                      style={[
                        styles.rewardBreakdown,
                        { backgroundColor: accentSoft },
                      ]}
                    >
                      <Text style={[styles.rewardLabel, { color: inkMuted }]}>
                        Base: {progress.rewardInfo.basePoints} pts
                      </Text>
                      {progress.rewardInfo.pointsMultiplier > 1 && (
                        <Text style={[styles.rewardLabel, { color: inkMuted }]}>
                          × {progress.rewardInfo.pointsMultiplier.toFixed(1)}{" "}
                          bonus
                        </Text>
                      )}
                      <Text
                        style={[
                          styles.rewardTotal,
                          { color: accent, fontFamily: fontRounded },
                        ]}
                      >
                        = {progress.rewardInfo.finalPoints} pts
                      </Text>
                    </View>
                    {progress.rewardInfo.freeItemName && (
                      <Text style={[styles.freeItemText, { color: inkMuted }]}>
                        + {progress.rewardInfo.freeItemName}
                      </Text>
                    )}
                    <Pressable
                      style={({ pressed }) => [
                        styles.claimButton,
                        { backgroundColor: accent },
                        claimLift,
                        {
                          opacity: pressed ? 0.88 : 1,
                          transform: [{ scale: pressScale(pressed) }],
                        },
                      ]}
                      onPress={() => handleClaimReward(task)}
                      accessibilityRole="button"
                      accessibilityLabel="Claim reward"
                    >
                      <Text
                        style={[
                          styles.claimButtonText,
                          { color: accentInk, fontFamily: fontRounded },
                        ]}
                      >
                        Claim reward
                      </Text>
                    </Pressable>
                  </View>
                )}

                {/* State: claimed — show verified badge */}
                {isClaimed && (
                  <View
                    style={[
                      styles.completedBadge,
                      { backgroundColor: accentSoft },
                    ]}
                  >
                    <Text style={[styles.completedText, { color: onSoft }]}>
                      Claimed
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Reward modal overlay */}
      {rewardModal && (
        <PhotoRewardModal
          reward={rewardModal.reward}
          basePoints={rewardModal.basePoints}
          freeItemName={rewardModal.freeItemName}
          onDismiss={() => setRewardModal(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 54, paddingHorizontal: 20 },
  header: { marginBottom: 20, gap: 8 },
  title: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  subrow: { flexDirection: "row", alignItems: "center", gap: 10 },
  count: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  celebrationPill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    flexShrink: 1,
  },
  celebrationText: { fontWeight: "700", fontSize: 13 },
  list: { gap: 12, paddingBottom: 40 },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingBottom: 80,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: "500",
  },
  carriedSection: { gap: 12 },
  carriedTitle: { fontSize: 13, fontWeight: "700" },
  carriedSubtitle: { fontSize: 12, fontWeight: "500", marginTop: -8 },
  taskCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  carriedBar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
  },
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  checkmark: { fontSize: 13, fontWeight: "700" },
  taskInfo: { flex: 1, gap: 3 },
  taskLabel: { fontSize: 16, fontWeight: "600" },
  categoryLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  pointsText: {
    fontWeight: "700",
    fontSize: 15,
    fontVariant: ["tabular-nums"],
  },
  actionButton: {
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtonText: {
    fontWeight: "700",
    fontSize: 15,
    letterSpacing: 0.2,
  },
  photoSection: {
    gap: 8,
  },
  photoChrome: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  photoPrompt: {
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  photoActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  photoButton: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  photoButtonText: {
    fontWeight: "700",
    fontSize: 15,
    letterSpacing: 0.2,
  },
  skipButton: {
    minHeight: 44,
    paddingVertical: 12,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  skipButtonText: {
    fontSize: 13,
    fontWeight: "600",
  },
  waitingSection: {
    gap: 6,
  },
  photoBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  photoBadgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  waitHint: {
    fontSize: 12,
    fontWeight: "500",
    fontStyle: "italic",
    textAlign: "center",
  },
  completedBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
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
    fontSize: 16,
    fontWeight: "800",
    marginTop: 4,
    fontVariant: ["tabular-nums"],
  },
  freeItemText: {
    fontSize: 12,
    fontWeight: "500",
    fontStyle: "italic",
    textAlign: "center",
  },
  claimButton: {
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  claimButtonText: {
    fontWeight: "700",
    fontSize: 16,
    letterSpacing: 0.3,
  },
});
