export type TaskCategory =
  | "kitchen"
  | "bathroom"
  | "bedroom"
  | "living_room"
  | "laundry"
  | "trash"
  | "other";

export type EvolutionStage = "egg" | "baby" | "teen" | "adult" | "ascended";
export type AdultVariant =
  "base" | "kitchen" | "livingroom" | "bedroom" | "bathroom";

export interface CleaningTask {
  id: string;
  label: string;
  category: TaskCategory;
  pointValue: number;
  completedAt: number; // unix ms
}

/** One monster's health, mood, and evolution. Nilly and Luna each have their own. */
export interface PetSlice {
  health: number; // 0–100
  happiness: number; // 0–100
  lastCaredAt: number; // unix ms — last care action
  lastSessionAt: number; // unix ms — when applyDecay last ran
  evolutionStage: EvolutionStage;
  totalPointsEarned: number; // lifetime cleaning points, never decremented
  adultVariant: AdultVariant; // determined at adult evolution, stored permanently
  categoryCompletions: Partial<Record<TaskCategory, number>>; // lifetime task completions by category
  pendingEvolution: EvolutionStage | null; // set when evolution triggers; cleared after UI shows it
  pendingPremiumGate: EvolutionStage | null; // set when premium gate blocks evolution
  premiumGateShownFor: EvolutionStage | null; // tracks which stage gate was already shown (prevent repeat)
  /**
   * Progression milestone levels (store/progression.ts) already handed over
   * for this monster. Level itself is derived from totalPointsEarned; this
   * only remembers which one-time payouts happened.
   */
  claimedMilestones: number[];
}

export interface PetState extends PetSlice {
  claimedStreakMilestones: number[];
  pendingMilestoneBanner: number | null;
}

export interface PlayerProfile {
  totalPoints: number;
  spentPoints: number;
  streak: number; // consecutive days with at least one task
  lastActiveDay: string; // YYYY-MM-DD — used to calculate streak
  activeDaysCount: number; // total unique days with any task completion (drives evolution)
  isPremium: boolean; // authoritative entitlement; read via store/premium.ts
  selectedMonster: "nilly" | "luna" | null;
  monsterName: string; // player-chosen pet name (set during onboarding)
  hasCompletedOnboarding: boolean; // gates the onboarding flow redirect
}
