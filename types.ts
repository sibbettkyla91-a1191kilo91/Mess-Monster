export type TaskCategory =
  | 'kitchen'
  | 'bathroom'
  | 'bedroom'
  | 'living_room'
  | 'laundry'
  | 'trash'
  | 'other';

export interface CleaningTask {
  id: string;
  label: string;
  category: TaskCategory;
  pointValue: number;
  completedAt: number; // unix ms
}

export interface PetState {
  lastCaredAt: number; // unix ms — mood is derived from this, never stored
}

export interface PlayerProfile {
  totalPoints: number;
  spentPoints: number;
  streak: number; // consecutive days with at least one task
  lastActiveDay: string; // YYYY-MM-DD — used to calculate streak
  selectedMonster: 'nilly' | 'luna' | null;
  monsterName: string; // user-chosen or randomized name for their monster
}
