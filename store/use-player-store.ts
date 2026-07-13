import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import {
  localDayString,
  localTomorrowString,
  localYesterdayString,
} from "@/utils/local-day";

import { PlayerProfile } from "./types";

// Exported for tests.
export function migratePlayerState(persistedState: any, version: number): any {
  const migrated = {
    activeDaysCount: 0,
    isPremium: false,
    lastTapReactionDate: "",
    tapReactionCount: 0,
    statPanelCollapsed: false,
    ...persistedState,
  };
  // v3 -> v4: availablePointsValue was a persisted cache of
  // totalPoints - spentPoints that could desync from its inputs.
  // It is now always derived on read; strip the stale copy.
  delete migrated.availablePointsValue;
  // v2 -> v3: lastActiveDay used to be derived from toISOString() (UTC),
  // which for users west of UTC can be one day AHEAD of their local day.
  // Left as-is, that value fails both the "today" and "yesterday" checks
  // in recordActivity and wrongly resets the streak. Clamp an
  // exactly-tomorrow value back to today; today's or genuinely stale
  // dates pass through so real broken streaks still reset.
  if (version < 3 && migrated.lastActiveDay === localTomorrowString()) {
    migrated.lastActiveDay = localDayString();
  }
  return migrated;
}

function todayISO() {
  return localDayString();
}

interface PlayerStore extends PlayerProfile {
  lastTapReactionDate: string; // ISO date of last tap reaction
  tapReactionCount: number; // taps used today (resets daily)
  notifPermissionAsked: boolean; // asked once ever, at the first reward claim
  statPanelCollapsed: boolean; // Home stat panel shrunk to its peek handle
  markNotifPermissionAsked: () => void;
  toggleStatPanel: () => void;
  availablePoints: () => number; // derived: totalPoints - spentPoints
  earnPoints: (amount: number) => void;
  spendPoints: (amount: number) => boolean; // returns false if insufficient points
  recordActivity: () => void; // call after a task is logged; updates streak + activeDaysCount
  recordTapReaction: () => boolean; // Returns true if tap was recorded (under 5/day), false if limit reached
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
      lastTapReactionDate: "",
      tapReactionCount: 0,
      notifPermissionAsked: false,
      // New key on existing installs is filled by the hydration merge (same
      // version) or the migrate defaults (older versions) — no version bump.
      statPanelCollapsed: false,

      // Always derived from totalPoints/spentPoints — never stored, so it
      // can't desync. In components, select the primitive directly:
      // usePlayerStore((s) => s.totalPoints - s.spentPoints)
      availablePoints: () => get().totalPoints - get().spentPoints,

      earnPoints: (amount) =>
        set((s) => ({ totalPoints: s.totalPoints + amount })),

      spendPoints: (amount) => {
        if (get().availablePoints() < amount) return false;
        set((s) => ({ spentPoints: s.spentPoints + amount }));
        return true;
      },

      recordActivity: () => {
        const today = todayISO();
        set((s) => {
          if (s.lastActiveDay === today) return {};
          const yesterday = localYesterdayString();
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

      recordTapReaction: () => {
        const today = todayISO();
        const state = get();
        const TAP_LIMIT = 5;

        // Check if we're still on the same day
        if (state.lastTapReactionDate !== today) {
          // New day, reset counter
          set({
            lastTapReactionDate: today,
            tapReactionCount: 1,
          });
          return true;
        }

        // Same day — check if we've hit the limit
        if (state.tapReactionCount >= TAP_LIMIT) {
          return false; // Limit reached, no tap recorded
        }

        // Increment counter and return success
        set((s) => ({
          tapReactionCount: s.tapReactionCount + 1,
        }));
        return true;
      },

      markNotifPermissionAsked: () => set({ notifPermissionAsked: true }),

      toggleStatPanel: () =>
        set((s) => ({ statPanelCollapsed: !s.statPanelCollapsed })),

      completeOnboarding: () => set({ hasCompletedOnboarding: true }),
    }),
    {
      name: "mm-player",
      version: 4,
      migrate: migratePlayerState,
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
