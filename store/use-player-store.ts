import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import {
  localDayString,
  localTomorrowString,
  localYesterdayString,
} from "@/utils/local-day";

import { MonsterId, resolveMonsterId } from "./monster-id";
import { PlayerProfile } from "./types";

// Exported for tests.
export function migratePlayerState(persistedState: any, version: number): any {
  const migrated = {
    activeDaysCount: 0,
    isPremium: false,
    lastTapReactionDate: "",
    tapReactionCount: 0,
    statPanelCollapsed: false,
    appliedRewardGrants: {},
    appliedPurchases: {},
    ...persistedState,
  };
  migrated.appliedRewardGrants = persistedState?.appliedRewardGrants ?? {};
  migrated.appliedPurchases = persistedState?.appliedPurchases ?? {};
  if (!migrated.tapReactions) {
    const date = migrated.lastTapReactionDate ?? "";
    const count = migrated.tapReactionCount ?? 0;
    const target = resolveMonsterId(migrated.selectedMonster);
    migrated.tapReactions = {
      nilly: { date: "", count: 0 },
      luna: { date: "", count: 0 },
      [target]: { date, count },
    };
    migrated.lastTapReactionDate = date;
    migrated.tapReactionCount = count;
  }
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

export type TapReactionSlice = { date: string; count: number };

interface PlayerStore extends PlayerProfile {
  lastTapReactionDate: string; // ISO date of last tap reaction (active monster)
  tapReactionCount: number; // taps used today (resets daily, active monster)
  tapReactions: Record<MonsterId, TapReactionSlice>;
  notifPermissionAsked: boolean; // asked once ever, at the first reward claim
  statPanelCollapsed: boolean; // Home stat panel shrunk to its peek handle
  appliedRewardGrants: Record<string, PlayerGrantReceipt>;
  appliedPurchases: Record<string, PlayerPurchaseReceipt>;
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
  applyRewardGrantPoints: (grantId: string, amount: number) => void;
  applyRewardGrantActivity: (grantId: string, activityDay: string) => void;
  applyRewardGrantStreakBonus: (grantId: string, amount: number) => void;
  chargePurchase: (
    purchaseId: string,
    itemId: string,
    price: number,
    autoConsume: boolean,
    monsterId?: MonsterId,
  ) => void;
}

export type PlayerGrantReceipt = {
  points?: true;
  activity?: true;
  streak?: true;
};

export type PlayerPurchaseReceipt = {
  charged?: true;
  itemId: string;
  price: number;
  autoConsume: boolean;
  monsterId?: MonsterId;
};

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
      tapReactions: {
        nilly: { date: "", count: 0 },
        luna: { date: "", count: 0 },
      },
      notifPermissionAsked: false,
      // New key on existing installs is filled by the hydration merge (same
      // version) or the migrate defaults (older versions) — no version bump.
      statPanelCollapsed: false,
      appliedRewardGrants: {},
      appliedPurchases: {},

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

      selectMonster: (monster) =>
        set((s) => {
          const tap = s.tapReactions?.[monster] ?? { date: "", count: 0 };
          return {
            selectedMonster: monster,
            lastTapReactionDate: tap.date,
            tapReactionCount: tap.count,
          };
        }),
      setMonsterName: (name) => set({ monsterName: name }),
      // Writer for the one premium flag. Readers go through store/premium.ts.
      setPremium: (value) => set({ isPremium: value }),

      recordTapReaction: () => {
        const today = todayISO();
        const state = get();
        const TAP_LIMIT = 5;
        const monster = resolveMonsterId(state.selectedMonster);
        const reactions = state.tapReactions ?? {
          nilly: { date: "", count: 0 },
          luna: { date: "", count: 0 },
        };
        const current = reactions[monster] ?? { date: "", count: 0 };

        // Check if we're still on the same day
        if (current.date !== today) {
          // New day, reset counter
          set({
            tapReactions: {
              ...reactions,
              [monster]: { date: today, count: 1 },
            },
            lastTapReactionDate: today,
            tapReactionCount: 1,
          });
          return true;
        }

        // Same day — check if we've hit the limit
        if (current.count >= TAP_LIMIT) {
          return false; // Limit reached, no tap recorded
        }

        // Increment counter and return success
        const next = current.count + 1;
        set({
          tapReactions: {
            ...reactions,
            [monster]: { date: current.date, count: next },
          },
          lastTapReactionDate: current.date,
          tapReactionCount: next,
        });
        return true;
      },

      markNotifPermissionAsked: () => set({ notifPermissionAsked: true }),

      toggleStatPanel: () =>
        set((s) => ({ statPanelCollapsed: !s.statPanelCollapsed })),

      completeOnboarding: () => set({ hasCompletedOnboarding: true }),

      applyRewardGrantPoints: (grantId, amount) => {
        set((s) => {
          if (s.appliedRewardGrants[grantId]?.points) return {};
          return {
            totalPoints: s.totalPoints + amount,
            appliedRewardGrants: {
              ...s.appliedRewardGrants,
              [grantId]: { ...s.appliedRewardGrants[grantId], points: true },
            },
          };
        });
      },

      applyRewardGrantActivity: (grantId, activityDay) => {
        set((s) => {
          if (s.appliedRewardGrants[grantId]?.activity) return {};
          const receipt = {
            appliedRewardGrants: {
              ...s.appliedRewardGrants,
              [grantId]: { ...s.appliedRewardGrants[grantId], activity: true },
            },
          };
          // Already counted that day, or the claim's day has passed — stamp
          // the receipt without minting a new (or the wrong) active day.
          if (s.lastActiveDay === activityDay || activityDay !== todayISO()) {
            return receipt;
          }
          const yesterday = localYesterdayString();
          const newStreak = s.lastActiveDay === yesterday ? s.streak + 1 : 1;
          return {
            ...receipt,
            streak: newStreak,
            lastActiveDay: activityDay,
            activeDaysCount: s.activeDaysCount + 1,
          };
        });
      },

      applyRewardGrantStreakBonus: (grantId, amount) => {
        set((s) => {
          if (s.appliedRewardGrants[grantId]?.streak) return {};
          return {
            totalPoints: s.totalPoints + amount,
            appliedRewardGrants: {
              ...s.appliedRewardGrants,
              [grantId]: { ...s.appliedRewardGrants[grantId], streak: true },
            },
          };
        });
      },

      chargePurchase: (purchaseId, itemId, price, autoConsume, monsterId) => {
        set((s) => {
          const receipts = s.appliedPurchases ?? {};
          if (receipts[purchaseId]?.charged) return {};
          if (s.totalPoints - s.spentPoints < price) return {};
          return {
            spentPoints: s.spentPoints + price,
            appliedPurchases: {
              ...receipts,
              [purchaseId]: {
                charged: true,
                itemId,
                price,
                autoConsume,
                monsterId: resolveMonsterId(monsterId ?? s.selectedMonster),
              },
            },
          };
        });
      },
    }),
    {
      name: "mm-player",
      version: 6,
      migrate: migratePlayerState,
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

const innerPlayerSetState = usePlayerStore.setState.bind(usePlayerStore);
usePlayerStore.setState = ((
  partial: Parameters<typeof usePlayerStore.setState>[0],
  replace?: boolean,
) => {
  if (replace === true) {
    innerPlayerSetState(partial as PlayerStore, true);
    return;
  }
  const project = (s: PlayerStore, patch: Partial<PlayerStore>) => {
    if (
      patch.tapReactionCount === undefined &&
      patch.lastTapReactionDate === undefined
    ) {
      return patch;
    }
    const monster = resolveMonsterId(
      patch.selectedMonster ?? s.selectedMonster,
    );
    const reactions = patch.tapReactions ??
      s.tapReactions ?? {
        nilly: { date: "", count: 0 },
        luna: { date: "", count: 0 },
      };
    const current = reactions[monster] ?? { date: "", count: 0 };
    return {
      ...patch,
      tapReactions: {
        ...reactions,
        [monster]: {
          date: patch.lastTapReactionDate ?? current.date,
          count: patch.tapReactionCount ?? current.count,
        },
      },
    };
  };
  if (typeof partial === "function") {
    innerPlayerSetState((s) => {
      const next = partial(s);
      if (!next) return next;
      return project(s, next);
    });
  } else {
    innerPlayerSetState((s) => project(s, partial));
  }
}) as typeof usePlayerStore.setState;
