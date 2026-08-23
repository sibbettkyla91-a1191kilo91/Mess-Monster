import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { RewardOutcome } from "@/constants/task-timers";
import { localDayString } from "@/utils/local-day";

import { getDailyRoll, PRESET_TASKS, PresetTask } from "./preset-tasks";
import { CleaningTask, TaskCategory } from "./types";

function todayStr(): string {
  return localDayString();
}

/**
 * Task states:
 * - idle: not started
 * - pending_photo: user tapped task, can take photo or skip
 * - waiting: time lock counting down before reward
 * - reward_ready: timer done, waiting for user to claim reward
 * - claimed: reward claimed
 */
export type TaskState =
  "idle" | "pending_photo" | "waiting" | "reward_ready" | "claimed";

export interface TaskProgress {
  state: TaskState;
  hasPhoto: boolean;
  photoUri?: string;
  waitStartedAt?: number; // unix ms when time lock started
  rewardInfo?: {
    basePoints: number;
    pointsMultiplier: number;
    finalPoints: number;
    freeItemName?: string;
    /** Rolled outcome for photo tasks — drives the celebration modal at claim */
    outcome?: RewardOutcome;
  };
}

/**
 * A reward that was earned (timer completed, reward rolled) but not yet
 * collected when the day rolled over. Zero-shame rule: earned rewards never
 * expire — they queue here until the player claims them, however long that
 * takes. Kept separate from taskProgress so "did I do today's chore" and
 * "did I collect a reward" stay independent pieces of state.
 */
export interface PendingReward {
  /** Unique per earn: `${earnedDate}:${taskId}` */
  id: string;
  taskId: string;
  label: string;
  category: TaskCategory;
  pointValue: number;
  /** Roll date (YYYY-MM-DD, local) the reward was earned on */
  earnedDate: string;
  hasPhoto: boolean;
  rewardInfo: NonNullable<TaskProgress["rewardInfo"]>;
}

/**
 * Durable intent to finish applying a reserved reward across the independently
 * persisted player/pet/tasks stores. Written in the same tasks-store set() as
 * the source claim/removal so a crash after reservation can still complete
 * the grant. Receipts for each effect live on the store that owns the effect.
 */
export interface UnsettledRewardGrant {
  /** Same uniqueness as PendingReward.id: `${earnedDate}:${taskId}` */
  id: string;
  taskId: string;
  label: string;
  category: TaskCategory;
  pointValue: number;
  earnedDate: string;
  hasPhoto: boolean;
  rewardInfo: NonNullable<TaskProgress["rewardInfo"]>;
  claimedAt: number;
  /**
   * True for a claim from today's roll. False for a carried pending reward —
   * those award points/history/care but must not mint a new active day.
   */
  countsTowardActivity: boolean;
}

export type TasksGrantReceipt = {
  history?: true;
};

interface TasksState {
  tasks: CleaningTask[];
  dailyRoll: PresetTask[];
  dailyRollDate: string;
  /** Uncollected rewards carried across day rollovers; never expire. */
  pendingRewards: PendingReward[];
  /**
   * Per-task progress for today's roll. Persisted so an app restart mid-wait
   * resumes the time lock (wall-clock based) instead of resetting to idle,
   * and so an already-rolled reward can't be re-rolled by force-quitting.
   * Reset whenever the daily roll refreshes, except for time locks still
   * counting down — those carry over anchored to their original waitStartedAt.
   */
  taskProgress: Record<string, TaskProgress>;
  /** Reserved grants whose player/pet/history effects may still be in flight. */
  unsettledGrants: UnsettledRewardGrant[];
  /** History-entry receipts, keyed by grant id. */
  appliedRewardGrants: Record<string, TasksGrantReceipt>;
  addTask: (task: CleaningTask) => void;
  removeTask: (id: string) => void;
  clearHistory: () => void;
  refreshDailyRoll: () => void;
  setTaskProgress: (taskId: string, progress: TaskProgress) => void;
  /** Atomically reserve a ready reward for collection. Points are awarded by the caller. */
  claimTaskReward: (taskId: string) => TaskProgress | null;
  /** Atomically remove and return a carried-over reward. Points are awarded by the caller. */
  claimPendingReward: (id: string) => PendingReward | null;
  applyRewardGrantHistory: (grant: UnsettledRewardGrant) => void;
  clearUnsettledGrant: (id: string) => void;
}

function lookupTask(
  s: Pick<TasksState, "dailyRoll">,
  taskId: string,
): PresetTask | undefined {
  return s.dailyRoll.find((t) => t.id === taskId) ?? PRESET_TASKS.find((t) => t.id === taskId);
}

export function migrateTasksState(persistedState: any): any {
  return {
    ...persistedState,
    taskProgress: persistedState?.taskProgress ?? {},
    pendingRewards: persistedState?.pendingRewards ?? [],
    unsettledGrants: persistedState?.unsettledGrants ?? [],
    appliedRewardGrants: persistedState?.appliedRewardGrants ?? {},
  };
}

export const useTasksStore = create<TasksState>()(
  persist(
    (set, get) => ({
      tasks: [],
      dailyRoll: getDailyRoll(todayStr()),
      dailyRollDate: todayStr(),
      taskProgress: {},
      pendingRewards: [],
      unsettledGrants: [],
      appliedRewardGrants: {},

      addTask: (task) => set((s) => ({ tasks: [task, ...s.tasks] })),
      removeTask: (id) =>
        set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),
      clearHistory: () => set({ tasks: [] }),

      refreshDailyRoll: () => {
        const today = todayStr();
        const s = get();
        if (s.dailyRollDate === today) return;

        // Zero-shame rule: a reward that was earned but not tapped before the
        // day rolled over must not vanish. Harvest reward_ready entries into
        // the persistent queue before the per-day progress map resets.
        const carried: PendingReward[] = [];
        // A time lock in flight is wall-clock based, anchored to its
        // waitStartedAt. The day rolling over mid-wait must neither restart it
        // nor throw the wait away, so the entry carries over untouched — and
        // its task carries into the new roll, keeping the timer on screen so
        // it can still finish (immediately, if the wait already elapsed).
        const carriedProgress: Record<string, TaskProgress> = {};
        const carriedTasks: PresetTask[] = [];
        for (const [taskId, progress] of Object.entries(s.taskProgress)) {
          const task =
            s.dailyRoll.find((t) => t.id === taskId) ??
            PRESET_TASKS.find((t) => t.id === taskId);
          if (!task) continue;
          if (progress.state === "waiting") {
            carriedProgress[taskId] = progress;
            carriedTasks.push(task);
            continue;
          }
          if (progress.state !== "reward_ready" || !progress.rewardInfo)
            continue;
          carried.push({
            id: `${s.dailyRollDate}:${taskId}`,
            taskId,
            label: task.label,
            category: task.category,
            pointValue: task.pointValue,
            earnedDate: s.dailyRollDate,
            hasPhoto: progress.hasPhoto,
            rewardInfo: progress.rewardInfo,
          });
        }

        const nextRoll = getDailyRoll(today);
        const nextRollIds = new Set(nextRoll.map((t) => t.id));

        set({
          dailyRoll: [
            ...nextRoll,
            ...carriedTasks.filter((t) => !nextRollIds.has(t.id)),
          ],
          dailyRollDate: today,
          taskProgress: carriedProgress,
          pendingRewards: [...s.pendingRewards, ...carried],
        });
      },

      setTaskProgress: (taskId, progress) =>
        set((s) => ({
          taskProgress: { ...s.taskProgress, [taskId]: progress },
        })),

      claimTaskReward: (taskId) => {
        const s = get();
        const progress = s.taskProgress[taskId];
        if (progress?.state !== "reward_ready" || !progress.rewardInfo) {
          return null;
        }
        const task = lookupTask(s, taskId);
        if (!task) return null;
        const grant: UnsettledRewardGrant = {
          id: `${s.dailyRollDate}:${taskId}`,
          taskId,
          label: task.label,
          category: task.category,
          pointValue: task.pointValue,
          earnedDate: s.dailyRollDate,
          hasPhoto: progress.hasPhoto,
          rewardInfo: progress.rewardInfo,
          claimedAt: Date.now(),
          countsTowardActivity: true,
        };
        set({
          taskProgress: {
            ...s.taskProgress,
            [taskId]: { ...progress, state: "claimed" },
          },
          unsettledGrants: [...s.unsettledGrants, grant],
        });
        return progress;
      },

      claimPendingReward: (id) => {
        const s = get();
        const reward = s.pendingRewards.find((r) => r.id === id);
        if (!reward) return null;
        const grant: UnsettledRewardGrant = {
          id: reward.id,
          taskId: reward.taskId,
          label: reward.label,
          category: reward.category,
          pointValue: reward.pointValue,
          earnedDate: reward.earnedDate,
          hasPhoto: reward.hasPhoto,
          rewardInfo: reward.rewardInfo,
          claimedAt: Date.now(),
          countsTowardActivity: false,
        };
        set({
          pendingRewards: s.pendingRewards.filter((r) => r.id !== id),
          unsettledGrants: [...s.unsettledGrants, grant],
        });
        return reward;
      },

      applyRewardGrantHistory: (grant) => {
        set((s) => {
          if (s.appliedRewardGrants[grant.id]?.history) return {};
          const task: CleaningTask = {
            id: grant.taskId,
            label: grant.label,
            category: grant.category,
            pointValue: grant.pointValue,
            completedAt: grant.claimedAt,
          };
          return {
            tasks: [task, ...s.tasks],
            appliedRewardGrants: {
              ...s.appliedRewardGrants,
              [grant.id]: { ...s.appliedRewardGrants[grant.id], history: true },
            },
          };
        });
      },

      clearUnsettledGrant: (id) =>
        set((s) => ({
          unsettledGrants: s.unsettledGrants.filter((g) => g.id !== id),
        })),
    }),
    {
      name: "mm-tasks",
      storage: createJSONStorage(() => AsyncStorage),
      version: 3,
      // v0 → v1: per-task progress is now persisted; older state just starts
      // with an empty progress map.
      // v1 → v2: uncollected rewards carry across rollovers; older state
      // starts with an empty queue.
      // v2 → v3: reserved grants persist as an intent log so a crash between
      // claim and player/pet writes can still complete the grant.
      migrate: migrateTasksState,
      // After AsyncStorage rehydration, refresh the roll if the device date has
      // moved past the stored roll date (e.g. app left open overnight).
      onRehydrateStorage: () => (state) => {
        state?.refreshDailyRoll();
      },
    },
  ),
);
