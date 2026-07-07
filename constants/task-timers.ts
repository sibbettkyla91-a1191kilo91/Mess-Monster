/**
 * Anti-cheat time locks and photo reward configuration.
 *
 * Each task has a minimum realistic completion time (in seconds).
 * Photo rewards use a weighted random roll after verification.
 */

/** Minimum completion time per task (seconds) */
export const TASK_MIN_TIMES: Record<string, number> = {
  "wash-dishes": 300, // 5 min
  "wipe-counters": 180, // 3 min
  "clean-stovetop": 240, // 4 min
  "scrub-toilet": 240, // 4 min
  "wipe-sink": 180, // 3 min
  "make-bed": 120, // 2 min
  "tidy-floor": 180, // 3 min
  vacuum: 300, // 5 min
  "dust-surfaces": 180, // 3 min
  "take-out-trash": 120, // 2 min
};

/** Default time for any task not in the map */
export const DEFAULT_MIN_TIME = 180; // 3 min

/** Reward tiers with probability weights (must sum to 100) */
export type RewardTier = "base" | "bonus_points" | "free_item" | "jackpot";

export interface RewardOutcome {
  tier: RewardTier;
  label: string;
  emoji: string;
  description: string;
  /** Points multiplier (1.0 = base, 1.5 = +50%, 2.0 = double) */
  pointsMultiplier: number;
  /** Whether a free store item is included */
  includesFreeItem: boolean;
}

export const REWARD_TABLE: { weight: number; outcome: RewardOutcome }[] = [
  {
    weight: 40,
    outcome: {
      tier: "base",
      label: "Nice Work!",
      emoji: "✨",
      description: "Task verified — points earned!",
      pointsMultiplier: 1.0,
      includesFreeItem: false,
    },
  },
  {
    weight: 35,
    outcome: {
      tier: "bonus_points",
      label: "Bonus Points!",
      emoji: "🎉",
      description: "Extra effort pays off!",
      pointsMultiplier: 1.5,
      includesFreeItem: false,
    },
  },
  {
    weight: 20,
    outcome: {
      tier: "free_item",
      label: "Free Item!",
      emoji: "🎁",
      description: "You unlocked a surprise gift!",
      pointsMultiplier: 1.0,
      includesFreeItem: true,
    },
  },
  {
    weight: 5,
    outcome: {
      tier: "jackpot",
      label: "JACKPOT!",
      emoji: "🏆",
      description: "Double points AND a free item!",
      pointsMultiplier: 2.0,
      includesFreeItem: true,
    },
  },
];

/**
 * Roll a random reward based on weighted probabilities.
 */
export function rollReward(): RewardOutcome {
  const total = REWARD_TABLE.reduce((sum, r) => sum + r.weight, 0);
  let roll = Math.random() * total;
  for (const entry of REWARD_TABLE) {
    roll -= entry.weight;
    if (roll <= 0) return entry.outcome;
  }
  // Fallback (should never reach here)
  return REWARD_TABLE[0].outcome;
}

/**
 * Pick a random free item from the affordable store items.
 * Returns items priced at 50 points or less (so it feels like a gift, not a windfall).
 */
export const FREE_ITEM_MAX_PRICE = 50;
