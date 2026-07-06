import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { AdultVariant, EvolutionStage, PetState, TaskCategory } from "./types";
import { usePlayerStore } from "./use-player-store";

const STREAK_MILESTONES = [3, 7, 14, 30];

// Lazy-load notifications to avoid import-time crash in Expo Go
async function scheduleDecayReminderAsync(
  healthLow: boolean,
  happinessLow: boolean,
  monsterName: string,
) {
  try {
    const Notifications = await import("expo-notifications");

    // Generate personalized message based on which stat is low
    let title = "Your pet needs you! 🧹";
    let body: string;

    if (healthLow && happinessLow) {
      body = `${monsterName} is struggling. Time to clean up and show some care!`;
    } else if (healthLow) {
      body = `${monsterName}'s health is declining. A quick cleaning task will help!`;
    } else {
      body = `${monsterName} is sad. Complete a cleaning task to brighten their day!`;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: "default",
        // Android-specific: route to decay-reminders channel if available
        android: {
          channelId: "decay-reminders",
          color: "#52b788", // Nilly's accent green
          priority: "max",
        },
      },
      trigger: null, // Show immediately
    });
  } catch (e) {
    if (__DEV__) console.warn("Notification error:", e);
  }
}

export type PetMood = "thriving" | "happy" | "neutral" | "sad" | "sick";

// Both points AND days must be met to evolve. Never de-evolve.
const EVOLUTION_THRESHOLDS: Partial<
  Record<EvolutionStage, { points: number; days: number }>
> = {
  baby: { points: 50, days: 3 },
  teen: { points: 200, days: 7 },
  adult: { points: 500, days: 14 },
};

const STAGE_ORDER: EvolutionStage[] = [
  "egg",
  "baby",
  "teen",
  "adult",
  "ascended",
];

// Adult variant is determined by which room category the user has completed most (lifetime).
const ROOM_CATEGORY_MAP: Partial<Record<TaskCategory, AdultVariant>> = {
  kitchen: "kitchen",
  living_room: "livingroom",
  bedroom: "bedroom",
  bathroom: "bathroom",
};

const HEALTH_DECAY_RATE = 1.5; // pts lost per hour
const HAPPINESS_DECAY_RATE = 2.0; // pts lost per hour
const HEALTH_CARE_BOOST = 15;
const HAPPINESS_CARE_BOOST = 20;
const MIN_DECAY_HOURS = 0.01; // ~36 s — skip trivially small gaps

function clamp(v: number): number {
  return Math.min(100, Math.max(0, v));
}

export function deriveMood(health: number, happiness: number): PetMood {
  const avg = (health + happiness) / 2;
  if (avg >= 75) return "thriving";
  if (avg >= 55) return "happy";
  if (avg >= 35) return "neutral";
  if (avg >= 15) return "sad";
  return "sick";
}

function nextStage(current: EvolutionStage): EvolutionStage | null {
  const idx = STAGE_ORDER.indexOf(current);
  if (idx === -1 || idx >= STAGE_ORDER.length - 1) return null;
  return STAGE_ORDER[idx + 1];
}

function determineAdultVariant(
  categoryCompletions: Partial<Record<TaskCategory, number>>,
): AdultVariant {
  let maxCount = 0;
  let topCat: TaskCategory | null = null;
  let tied = false;

  for (const [cat, count] of Object.entries(categoryCompletions) as [
    TaskCategory,
    number,
  ][]) {
    const variant = ROOM_CATEGORY_MAP[cat];
    if (!variant || !count) continue;
    if (count > maxCount) {
      maxCount = count;
      topCat = cat;
      tied = false;
    } else if (count === maxCount) {
      tied = true;
    }
  }

  if (!topCat || tied || !ROOM_CATEGORY_MAP[topCat]) return "base";
  return ROOM_CATEGORY_MAP[topCat]!;
}

interface PetStore extends PetState {
  care: () => void;
  applyDecay: () => void;
  trackEarned: (amount: number, category?: TaskCategory) => void;
  recheckEvolution: () => void; // re-run evolution check (e.g., after premium unlock)
  checkStreakMilestones: () => void;
  clearMilestoneBanner: () => void;
  clearPendingEvolution: () => void;
  clearPremiumGate: () => void;
}

export const usePetStore = create<PetStore>()(
  persist(
    (set, get) => ({
      health: 100,
      happiness: 100,
      lastCaredAt: Date.now(),
      lastSessionAt: Date.now(),
      lastDecayReminderAt: 0,
      evolutionStage: "egg" as EvolutionStage,
      totalPointsEarned: 0,
      adultVariant: "base" as AdultVariant,
      categoryCompletions: {},
      claimedStreakMilestones: [],
      pendingMilestoneBanner: null,
      pendingEvolution: null,
      pendingPremiumGate: null,
      premiumGateShownFor: null,

      care: () =>
        set((s) => ({
          health: clamp(s.health + HEALTH_CARE_BOOST),
          happiness: clamp(s.happiness + HAPPINESS_CARE_BOOST),
          lastCaredAt: Date.now(),
        })),

      trackEarned: (amount, category) =>
        set((s) => {
          const newTotal = s.totalPointsEarned + amount;

          const newCategoryCompletions: Partial<Record<TaskCategory, number>> =
            category
              ? {
                  ...s.categoryCompletions,
                  [category]: (s.categoryCompletions[category] ?? 0) + 1,
                }
              : s.categoryCompletions;

          const baseUpdate = {
            totalPointsEarned: newTotal,
            categoryCompletions: newCategoryCompletions,
          };

          const next = nextStage(s.evolutionStage);

          // Already at max stage or ascended (not yet implemented)
          if (!next || next === "ascended") return baseUpdate;

          const threshold = EVOLUTION_THRESHOLDS[next];
          if (!threshold) return baseUpdate;

          const { activeDaysCount, isPremium } = usePlayerStore.getState();
          const meetsConditions =
            newTotal >= threshold.points && activeDaysCount >= threshold.days;
          if (!meetsConditions) return baseUpdate;

          // Premium gate: adult requires premium (ascended is reserved; gate checked via nextStage)
          if (next === "adult") {
            if (!isPremium) {
              // Show gate once per stage — don't repeat if already shown
              if (s.premiumGateShownFor === next) return baseUpdate;
              return {
                ...baseUpdate,
                pendingPremiumGate: next,
                premiumGateShownFor: next,
              };
            }
          }

          // Evolve!
          const adultVariant =
            next === "adult"
              ? determineAdultVariant(newCategoryCompletions)
              : s.adultVariant;

          return {
            ...baseUpdate,
            evolutionStage: next,
            adultVariant,
            pendingEvolution: next,
            pendingPremiumGate: null,
          };
        }),

      recheckEvolution: () => {
        const s = get();
        const { activeDaysCount, isPremium } = usePlayerStore.getState();
        const next = nextStage(s.evolutionStage);
        if (!next || next === "ascended") return;

        const threshold = EVOLUTION_THRESHOLDS[next];
        if (!threshold) return;
        if (
          s.totalPointsEarned < threshold.points ||
          activeDaysCount < threshold.days
        )
          return;

        if (next === "adult" && !isPremium) {
          if (s.premiumGateShownFor !== next) {
            set({ pendingPremiumGate: next, premiumGateShownFor: next });
          }
          return;
        }

        const adultVariant =
          next === "adult"
            ? determineAdultVariant(s.categoryCompletions)
            : s.adultVariant;

        set({
          evolutionStage: next,
          adultVariant,
          pendingEvolution: next,
          pendingPremiumGate: null,
        });
      },

      checkStreakMilestones: () => {
        const streak = usePlayerStore.getState().streak;
        const { claimedStreakMilestones } = get();
        const hit = STREAK_MILESTONES.find(
          (m) => streak >= m && !claimedStreakMilestones.includes(m),
        );
        if (!hit) return;
        set((s) => ({
          claimedStreakMilestones: [...s.claimedStreakMilestones, hit],
          pendingMilestoneBanner: hit,
        }));
        usePlayerStore.getState().earnPoints(50);
      },

      clearMilestoneBanner: () => set({ pendingMilestoneBanner: null }),

      clearPendingEvolution: () => set({ pendingEvolution: null }),

      clearPremiumGate: () => set({ pendingPremiumGate: null }),

      applyDecay: () => {
        const now = Date.now();
        const { lastSessionAt, health, happiness, lastDecayReminderAt } = get();
        const elapsedHours = (now - lastSessionAt) / 3_600_000;
        if (elapsedHours < MIN_DECAY_HOURS) return;

        const newHealth = clamp(health - HEALTH_DECAY_RATE * elapsedHours);
        const newHappiness = clamp(
          happiness - HAPPINESS_DECAY_RATE * elapsedHours,
        );

        set({
          health: newHealth,
          happiness: newHappiness,
          lastSessionAt: now,
        });

        // Trigger notification if health or happiness drops below 30
        // Only send once per hour to avoid notification spam
        const timeSinceLastReminder = now - lastDecayReminderAt;
        const oneHourMs = 60 * 60 * 1000;
        const shouldThrottle = timeSinceLastReminder < oneHourMs;

        if (
          (newHealth < 30 || newHappiness < 30) &&
          (health >= 30 || happiness >= 30) &&
          !shouldThrottle
        ) {
          const { monsterName } = usePlayerStore.getState();
          scheduleDecayReminderAsync(
            newHealth < 30,
            newHappiness < 30,
            monsterName,
          );
          set({ lastDecayReminderAt: now });
        }
      },
    }),
    {
      name: "mm-pet",
      version: 1,
      migrate: (persistedState: any): any => {
        // Migrate from old integer stage (0=hatchling, 1=growing, 2=mature, 3=evolved)
        const STAGE_MAP: Record<number, EvolutionStage> = {
          0: "egg",
          1: "baby",
          2: "teen",
          3: "adult",
        };
        const oldStage = persistedState?.evolutionStage;
        const migratedStage: EvolutionStage =
          typeof oldStage === "number"
            ? (STAGE_MAP[oldStage] ?? "egg")
            : (oldStage ?? "egg");

        return {
          adultVariant: "base",
          categoryCompletions: {},
          lastDecayReminderAt: 0,
          pendingEvolution: null,
          pendingPremiumGate: null,
          premiumGateShownFor: null,
          ...persistedState,
          evolutionStage: migratedStage,
          lastSessionAt: Date.now(),
        };
      },
      storage: createJSONStorage(() => AsyncStorage),
      // PERFORMANCE: Defer decay application to next tick instead of blocking hydration.
      // This unblocks the initial render and defers heavy computation to after the UI is ready.
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Use setImmediate to schedule decay on the next event loop iteration.
          // This allows React to complete the initial render before we do heavy calculations.
          if (typeof setImmediate !== "undefined") {
            setImmediate(() => state.applyDecay());
          } else {
            // Fallback for environments without setImmediate (e.g., some React Native setups)
            setTimeout(() => state.applyDecay(), 0);
          }
        }
      },
    },
  ),
);
