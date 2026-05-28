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
  health: number;        // 0–100
  happiness: number;     // 0–100
  lastCaredAt: number;   // unix ms — last care action
  lastSessionAt: number; // unix ms — when applyDecay last ran; used to calculate offline drift
}

export interface PlayerProfile {
  totalPoints: number;
  spentPoints: number;
  streak: number; // consecutive days with at least one task
  lastActiveDay: string; // YYYY-MM-DD — used to calculate streak
  selectedMonster: 'nilly' | 'luna' | null;
}
