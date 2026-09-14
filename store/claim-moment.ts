import { MonsterId, resolveMonsterId } from "./monster-id";
import { currentTimeOfDay, pickLine } from "./monster-voice";
import {
  LevelProgress,
  levelForXp,
  Milestone,
  milestoneForLevel,
  xpToNextLevel,
} from "./progression";
import { deriveMood, usePetStore } from "./use-pet-store";
import { usePlayerStore } from "./use-player-store";

/**
 * Everything the screen needs to show the moment after a reward is claimed.
 * Presentation only: built from reads AFTER the grant pipeline has written,
 * never written back. Losing it (remount, interrupted animation) loses
 * nothing — the receipts already hold the reward.
 */
export type ClaimMoment = {
  monster: MonsterId;
  pointsGained: number;
  progress: LevelProgress;
  levelBefore: number;
  leveledUp: boolean;
  /** The highest milestone crossed by this claim, if any. */
  milestone?: Milestone;
  /** A line from the monster's "task" bucket. */
  voiceLine: string;
};

/** Snapshot before the claim: which monster and its level right now. */
export function beforeClaim(): { monster: MonsterId; level: number } {
  const monster = resolveMonsterId(usePlayerStore.getState().selectedMonster);
  const xp = usePetStore.getState().byMonster[monster]?.totalPointsEarned ?? 0;
  return { monster, level: levelForXp(xp) };
}

export function buildClaimMoment(
  before: { monster: MonsterId; level: number },
  pointsGained: number,
  lastLine: string | null = null,
  rng: () => number = Math.random,
): ClaimMoment {
  const slice = usePetStore.getState().byMonster[before.monster];
  const progress = xpToNextLevel(slice?.totalPointsEarned ?? 0);
  const leveledUp = progress.level > before.level;
  let milestone: Milestone | undefined;
  if (leveledUp) {
    for (let level = progress.level; level > before.level; level--) {
      milestone = milestoneForLevel(level);
      if (milestone) break;
    }
  }
  const voiceLine = pickLine(
    before.monster,
    {
      mood: deriveMood(slice?.health ?? 100, slice?.happiness ?? 100),
      timeOfDay: currentTimeOfDay(),
      lastAction: "task",
    },
    lastLine,
    rng,
  );
  return {
    monster: before.monster,
    pointsGained,
    progress,
    levelBefore: before.level,
    leveledUp,
    milestone,
    voiceLine,
  };
}
