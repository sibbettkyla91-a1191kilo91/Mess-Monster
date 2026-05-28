import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { getDailyRoll, PresetTask } from './preset-tasks';
import { CleaningTask } from './types';

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

interface TasksState {
  tasks: CleaningTask[];
  dailyRoll: PresetTask[];
  dailyRollDate: string;
  addTask: (task: CleaningTask) => void;
  removeTask: (id: string) => void;
  clearHistory: () => void;
  refreshDailyRoll: () => void;
}

export const useTasksStore = create<TasksState>()(
  persist(
    (set, get) => ({
      tasks: [],
      dailyRoll: getDailyRoll(todayStr()),
      dailyRollDate: todayStr(),

      addTask: (task) => set((s) => ({ tasks: [task, ...s.tasks] })),
      removeTask: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),
      clearHistory: () => set({ tasks: [] }),

      refreshDailyRoll: () => {
        const today = todayStr();
        if (get().dailyRollDate !== today) {
          set({ dailyRoll: getDailyRoll(today), dailyRollDate: today });
        }
      },
    }),
    {
      name: 'mm-tasks',
      storage: createJSONStorage(() => AsyncStorage),
      // After AsyncStorage rehydration, refresh the roll if the device date has
      // moved past the stored roll date (e.g. app left open overnight).
      onRehydrateStorage: () => (state) => {
        state?.refreshDailyRoll();
      },
    },
  ),
);
