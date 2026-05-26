import { create } from 'zustand';

export interface Monster {
  id: string;
  name: string;
  level: number;
  experience: number;
  hunger: number;
  happiness: number;
  energy: number;
  homeDecor: string[];
}

interface MonsterStore {
  nilly: Monster | null;
  luna: Monster | null;
  selectedMonster: 'nilly' | 'luna' | null;
  
  // Actions
  initializeMonsters: () => void;
  selectMonster: (name: 'nilly' | 'luna') => void;
  feedMonster: (monsterId: 'nilly' | 'luna', amount: number) => void;
  playWithMonster: (monsterId: 'nilly' | 'luna') => void;
  restMonster: (monsterId: 'nilly' | 'luna') => void;
  addHomeDecor: (monsterId: 'nilly' | 'luna', decorId: string) => void;
}

const initialMonster = (name: string): Monster => ({
  id: name.toLowerCase(),
  name,
  level: 1,
  experience: 0,
  hunger: 50,
  happiness: 75,
  energy: 100,
  homeDecor: [],
});

export const useMonsterStore = create<MonsterStore>((set, get) => ({
  nilly: null,
  luna: null,
  selectedMonster: null,

  initializeMonsters: () => {
    set({
      nilly: initialMonster('Nilly'),
      luna: initialMonster('Luna'),
      selectedMonster: 'nilly',
    });
  },

  selectMonster: (name) => {
    set({ selectedMonster: name });
  },

  feedMonster: (monsterId, amount) => {
    set((state) => {
      const monster = state[monsterId];
      if (!monster) return state;

      const newHunger = Math.max(0, monster.hunger - amount);
      return {
        [monsterId]: {
          ...monster,
          hunger: newHunger,
        },
      };
    });
  },

  playWithMonster: (monsterId) => {
    set((state) => {
      const monster = state[monsterId];
      if (!monster) return state;

      return {
        [monsterId]: {
          ...monster,
          happiness: Math.min(100, monster.happiness + 10),
          energy: Math.max(0, monster.energy - 15),
          experience: monster.experience + 5,
        },
      };
    });
  },

  restMonster: (monsterId) => {
    set((state) => {
      const monster = state[monsterId];
      if (!monster) return state;

      return {
        [monsterId]: {
          ...monster,
          energy: Math.min(100, monster.energy + 30),
          hunger: Math.min(100, monster.hunger + 5),
        },
      };
    });
  },

  addHomeDecor: (monsterId, decorId) => {
    set((state) => {
      const monster = state[monsterId];
      if (!monster) return state;

      return {
        [monsterId]: {
          ...monster,
          homeDecor: [...monster.homeDecor, decorId],
        },
      };
    });
  },
}));
