import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { PetState } from './types';
import { usePlayerStore } from './use-player-store';

const STREAK_MILESTONES = [3, 7, 14, 30];

export type PetMood = 'thriving' | 'happy' | 'neutral' | 'sad' | 'sick';

export function deriveEvolutionStage(totalPointsEarned: number): 0 | 1 | 2 | 3 {
  if (totalPointsEarned >= 1200) return 3;
  if (totalPointsEarned >= 600)  return 2;
  if (totalPointsEarned >= 200)  return 1;
  return 0;
}

const HEALTH_DECAY_RATE    = 1.5; // pts lost per hour
const HAPPINESS_DECAY_RATE = 2.0; // pts lost per hour
const HEALTH_CARE_BOOST    = 15;
const HAPPINESS_CARE_BOOST = 20;
const MIN_DECAY_HOURS      = 0.01; // ~36 s — skip trivially small gaps

function clamp(v: number): number {
  return Math.min(100, Math.max(0, v));
}

/** Mood is derived from health + happiness, not stored. */
export function deriveMood(health: number, happiness: number): PetMood {
  const avg = (health + happiness) / 2;
  if (avg >= 75) return 'thriving';
  if (avg >= 55) return 'happy';
  if (avg >= 35) return 'neutral';
  if (avg >= 15) return 'sad';
  return 'sick';
}

interface PetStore extends PetState {
  care: () => void;
  applyDecay: () => void;
  trackEarned: (amount: number) => void;
  checkStreakMilestones: () => void;
  clearMilestoneBanner: () => void;
}

export const usePetStore = create<PetStore>()(
  persist(
    (set, get) => ({
      health:            100,
      happiness:         100,
      lastCaredAt:       Date.now(),
      lastSessionAt:     Date.now(),
      evolutionStage:            0,
      totalPointsEarned:         0,
      claimedStreakMilestones:   [],
      pendingMilestoneBanner:    null,

      care: () =>
        set((s) => ({
          health:      clamp(s.health    + HEALTH_CARE_BOOST),
          happiness:   clamp(s.happiness + HAPPINESS_CARE_BOOST),
          lastCaredAt: Date.now(),
        })),

      trackEarned: (amount) =>
        set((s) => {
          const newTotal = s.totalPointsEarned + amount;
          return {
            totalPointsEarned: newTotal,
            evolutionStage: deriveEvolutionStage(newTotal),
          };
        }),

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

      applyDecay: () => {
        const now = Date.now();
        const { lastSessionAt, health, happiness } = get();
        const elapsedHours = (now - lastSessionAt) / 3_600_000;
        if (elapsedHours < MIN_DECAY_HOURS) return;
        set({
          health:        clamp(health    - HEALTH_DECAY_RATE    * elapsedHours),
          happiness:     clamp(happiness - HAPPINESS_DECAY_RATE * elapsedHours),
          lastSessionAt: now,
        });
      },
    }),
    {
      name: 'mm-pet',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        state?.applyDecay();
      },
    },
  ),
);
