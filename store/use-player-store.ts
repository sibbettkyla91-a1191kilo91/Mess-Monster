import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { PlayerProfile } from './types';

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

interface PlayerStore extends PlayerProfile {
  availablePoints: () => number;
  earnPoints: (amount: number) => void;
  spendPoints: (amount: number) => boolean; // returns false if insufficient points
  recordActivity: () => void; // call after a task is logged to update streak
  selectMonster: (monster: 'nilly' | 'luna') => void;
  setMonsterName: (name: string) => void;
}

export const usePlayerStore = create<PlayerStore>()(
  persist(
    (set, get) => ({
      totalPoints: 100,   // welcome gift so the store works on first launch
      spentPoints: 0,
      streak: 0,
      lastActiveDay: '',
      selectedMonster: null,
      monsterName: '',

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
          const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
          const newStreak = s.lastActiveDay === yesterday ? s.streak + 1 : 1;
          return { streak: newStreak, lastActiveDay: today };
        });
      },

      selectMonster: (monster) => set({ selectedMonster: monster }),
      setMonsterName: (name) => set({ monsterName: name }),
    }),
    {
      name: 'mm-player',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
