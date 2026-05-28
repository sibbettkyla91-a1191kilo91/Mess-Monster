import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { PetState } from './types';

export type PetMood = 'thriving' | 'happy' | 'neutral' | 'sad' | 'sick';

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
}

export const usePetStore = create<PetStore>()(
  persist(
    (set, get) => ({
      health:        100,
      happiness:     100,
      lastCaredAt:   Date.now(),
      lastSessionAt: Date.now(),

      care: () =>
        set((s) => ({
          health:      clamp(s.health    + HEALTH_CARE_BOOST),
          happiness:   clamp(s.happiness + HAPPINESS_CARE_BOOST),
          lastCaredAt: Date.now(),
        })),

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
