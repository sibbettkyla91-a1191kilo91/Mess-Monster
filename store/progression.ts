/**
 * Per-monster progression — pure math, no store reads.
 *
 * XP IS `PetSlice.totalPointsEarned`. That number already exists, is
 * per monster, and is bumped exactly once per claimed reward through the
 * grant receipts in store/recover-unsettled-grants.ts. There is no second
 * counter to drift from it: level is derived here, on read, every time.
 *
 * This coexists with the older evolution system (`evolutionStage`,
 * EVOLUTION_THRESHOLDS in use-pet-store.ts), which is untouched. Both key
 * off the same monster id and the same lifetime points; a Nilly at "teen"
 * and a Nilly at "adult" run the same level ladder.
 *
 * FUTURE STAGE HOOK: a new evolution stage (or an art reveal) should not add
 * a new counter either. Add a milestone below with a `stage` marker — e.g.
 * `{ level: 8, kind: "stage", stage: "ascended" }` — and let the settle step
 * in store/progression-milestones.ts hand that stage to the pet store once,
 * under the same claimed-milestone receipt. Level thresholds stay as they
 * are; the stage just becomes one more thing a level can unlock.
 */

import type { MonsterId } from "./monster-id";

/**
 * Cumulative lifetime points needed to REACH each level. Index 0 is level 1.
 * A typical chore pays 10–40 points (×1–2 with a photo roll), so level 2
 * lands in the first couple of days and level 4 — which opens the last shop
 * tier — after a few weeks of ordinary use.
 */
export const LEVEL_THRESHOLDS: readonly number[] = [
  0, // 1
  60, // 2
  150, // 3
  300, // 4
  500, // 5
  750, // 6
  1050, // 7
  1400, // 8
  1800, // 9
  2250, // 10
];

export const MAX_LEVEL = LEVEL_THRESHOLDS.length;

/** Level for a lifetime-points total. Never below 1, never above MAX_LEVEL. */
export function levelForXp(xp: number): number {
  const safe = Number.isFinite(xp) && xp > 0 ? xp : 0;
  let level = 1;
  for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) {
    if (safe >= LEVEL_THRESHOLDS[i]) level = i + 1;
    else break;
  }
  return level;
}

/** Lifetime points needed to reach `level` (1..MAX_LEVEL). */
export function xpForLevel(level: number): number {
  const idx = Math.min(MAX_LEVEL, Math.max(1, Math.floor(level))) - 1;
  return LEVEL_THRESHOLDS[idx];
}

export type LevelProgress = {
  level: number;
  /** Points earned since reaching the current level. */
  intoLevel: number;
  /** Points between this level's floor and the next; 0 at MAX_LEVEL. */
  span: number;
  /** Points still needed for the next level; 0 at MAX_LEVEL. */
  remaining: number;
  /** 0..1 fill for a progress bar; 1 at MAX_LEVEL. */
  fraction: number;
  atMax: boolean;
};

export function xpToNextLevel(xp: number): LevelProgress {
  const safe = Number.isFinite(xp) && xp > 0 ? xp : 0;
  const level = levelForXp(safe);
  const floor = xpForLevel(level);
  if (level >= MAX_LEVEL) {
    return {
      level,
      intoLevel: safe - floor,
      span: 0,
      remaining: 0,
      fraction: 1,
      atMax: true,
    };
  }
  const ceiling = xpForLevel(level + 1);
  const span = ceiling - floor;
  const intoLevel = safe - floor;
  return {
    level,
    intoLevel,
    span,
    remaining: Math.max(0, ceiling - safe),
    fraction: span > 0 ? Math.min(1, Math.max(0, intoLevel / span)) : 1,
    atMax: false,
  };
}

/**
 * What a level hands over the first time a monster reaches it.
 *  - unlock: a shop tier opens (the items carry `unlock.level`; nothing is
 *    written anywhere — the shop reads level on render).
 *  - points: a one-time bonus to the player's balance.
 *  - item: one unit of a monster-specific catalog item into that monster's bag.
 * Any milestone that writes points or an item crosses stores and settles via
 * store/progression-milestones.ts with intent + receipts.
 */
export type Milestone = {
  level: number;
  /** Short, plain label for the moment. */
  title: string;
  /** One line per monster, in voice. */
  note: Record<MonsterId, string>;
  points?: number;
  itemId?: Record<MonsterId, string>;
  /** True when this level opens a shop tier (see TIER_2 / TIER_3 in store-items). */
  unlocksShopTier?: boolean;
};

export const MILESTONES: readonly Milestone[] = [
  {
    level: 2,
    title: "New things on the shelves",
    note: {
      nilly: "The shop found a few more things. Nilly already has opinions.",
      luna: "The shop restocked. Luna pretends not to have looked.",
    },
    unlocksShopTier: true,
  },
  {
    level: 3,
    title: "A little extra",
    note: {
      nilly: "Forty points, tucked under the rug for you.",
      luna: "Forty points. Consider it a retainer.",
    },
    points: 40,
  },
  {
    level: 4,
    title: "The last shelf opens",
    note: {
      nilly: "Everything in the shop is yours to browse now.",
      luna: "The back room is open. Mind the candles.",
    },
    unlocksShopTier: true,
  },
  {
    level: 5,
    title: "Something from the pantry",
    note: {
      nilly: "Fresh berries. Nilly picked them. Some made it into the basket.",
      luna: "Mulled cider, still warm. Luna insists it's not a fuss.",
    },
    itemId: {
      nilly: "nilly-food-fresh-berries",
      luna: "luna-food-spiced-mulled-cider",
    },
  },
  {
    level: 7,
    title: "Well along",
    note: {
      nilly: "Eighty points. Nilly did a spin about it.",
      luna: "Eighty points. Luna raised one eyebrow. That's a lot, for her.",
    },
    points: 80,
  },
  {
    level: 10,
    title: "The top of the ladder",
    note: {
      nilly: "A hundred and fifty points, and a very proud small monster.",
      luna: "A hundred and fifty points. Luna says the ladder was short.",
    },
    points: 150,
  },
];

export function milestoneForLevel(level: number): Milestone | undefined {
  return MILESTONES.find((m) => m.level === level);
}

/** Milestones whose level has been reached and are not yet in `claimed`. */
export function unclaimedMilestones(
  xp: number,
  claimed: readonly number[],
): Milestone[] {
  const level = levelForXp(xp);
  return MILESTONES.filter(
    (m) => m.level <= level && !claimed.includes(m.level),
  );
}

/** Stable id for a milestone payout; doubles as the receipt key everywhere. */
export function milestoneGrantId(monster: MonsterId, level: number): string {
  return `${monster}:milestone:${level}`;
}
