import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { PlayerProfile } from "./types";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

interface PlayerStore extends PlayerProfile {
  availablePointsValue: number; // Computed field: totalPoints - spentPoints
  availablePoints: () => number; // Selector function for backward compatibility
  earnPoints: (amount: number) => void;
  spendPoints: (amount: number) => boolean; // returns false if insufficient points
  recordActivity: () => void; // call after a task is logged; updates streak + activeDaysCount
  selectMonster: (monster: "nilly" | "luna") => void;
  setMonsterName: (name: string) => void;
  setPremium: (value: boolean) => void;
  completeOnboarding: () => void;
}

export const usePlayerStore = create<PlayerStore>()(
  persist(
    (set, get) => ({
      totalPoints: 100, // welcome gift so the store works on first launch
      spentPoints: 0,
      streak: 0,
      lastActiveDay: "",
      activeDaysCount: 0,
      isPremium: false,
      selectedMonster: null,
      monsterName: "",
      hasCompletedOnboarding: false,
      availablePointsValue: 100, // Initial value: 100 - 0

      // PERFORMANCE: Computed property updated whenever points change.
      // This provides a single source of truth that can be selected safely.
      // Use the selector: usePlayerStore((s) => s.availablePointsValue)
      // instead of calling availablePoints() to avoid function re-creation.
      availablePoints: () => get().totalPoints - get().spentPoints,

      earnPoints: (amount) =>
        set((s) => {
          const newTotal = s.totalPoints + amount;
          return {
            totalPoints: newTotal,
            availablePointsValue: newTotal - s.spentPoints,
          };
        }),

      spendPoints: (amount) => {
        if (get().availablePointsValue < amount) return false;
        set((s) => ({
          spentPoints: s.spentPoints + amount,
          availablePointsValue: s.availablePointsValue - amount,
        }));
        return true;
      },

      recordActivity: () => {
        const today = todayISO();
        set((s) => {
          if (s.lastActiveDay === today) return {};
          const yesterday = new Date(Date.now() - 86_400_000)
            .toISOString()
            .slice(0, 10);
          const newStreak = s.lastActiveDay === yesterday ? s.streak + 1 : 1;
          return {
            streak: newStreak,
            lastActiveDay: today,
            activeDaysCount: s.activeDaysCount + 1,
          };
        });
      },

      selectMonster: (monster) => set({ selectedMonster: monster }),
      setMonsterName: (name) => set({ monsterName: name }),
      setPremium: (value) => set({ isPremium: value }),
      completeOnboarding: () => set({ hasCompletedOnboarding: true }),
    }),
    {
      name: "mm-player",
      version: 1,
      migrate: (persistedState: any): any => {
        const totalPoints = persistedState?.totalPoints ?? 100;
        const spentPoints = persistedState?.spentPoints ?? 0;
        return {
          activeDaysCount: 0,
          isPremium: false,
          availablePointsValue: totalPoints - spentPoints,
          ...persistedState,
        };
      },
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
