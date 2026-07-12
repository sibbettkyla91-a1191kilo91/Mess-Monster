import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { RewardOutcome } from "@/constants/task-timers";
import { localDayString } from "@/utils/local-day";

import { getDailyRoll, PresetTask } from "./preset-tasks";
import { CleaningTask } from "./types";

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

interface TasksState {
  tasks: CleaningTask[];
  dailyRoll: PresetTask[];
  dailyRollDate: string;
  /**
   * Per-task progress for today's roll. Persisted so an app restart mid-wait
   * resumes the time lock (wall-clock based) instead of resetting to idle,
   * and so an already-rolled reward can't be re-rolled by force-quitting.
   * Cleared whenever the daily roll refreshes.
   */
  taskProgress: Record<string, TaskProgress>;
  addTask: (task: CleaningTask) => void;
  removeTask: (id: string) => void;
  clearHistory: () => void;
  refreshDailyRoll: () => void;
  setTaskProgress: (taskId: string, progress: TaskProgress) => void;
}

export const useTasksStore = create<TasksState>()(
  persist(
    (set, get) => ({
      tasks: [],
      dailyRoll: getDailyRoll(todayStr()),
      dailyRollDate: todayStr(),
      taskProgress: {},

      addTask: (task) => set((s) => ({ tasks: [task, ...s.tasks] })),
      removeTask: (id) =>
        set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),
      clearHistory: () => set({ tasks: [] }),

      refreshDailyRoll: () => {
        const today = todayStr();
        if (get().dailyRollDate !== today) {
          set({
            dailyRoll: getDailyRoll(today),
            dailyRollDate: today,
            taskProgress: {},
          });
        }
      },

      setTaskProgress: (taskId, progress) =>
        set((s) => ({
          taskProgress: { ...s.taskProgress, [taskId]: progress },
        })),
    }),
    {
      name: "mm-tasks",
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      // v0 → v1: per-task progress is now persisted; older state just starts
      // with an empty progress map.
      migrate: (persistedState: any): any => ({
        ...persistedState,
        taskProgress: persistedState?.taskProgress ?? {},
      }),
      // After AsyncStorage rehydration, refresh the roll if the device date has
      // moved past the stored roll date (e.g. app left open overnight).
      onRehydrateStorage: () => (state) => {
        state?.refreshDailyRoll();
      },
    },
  ),
);
