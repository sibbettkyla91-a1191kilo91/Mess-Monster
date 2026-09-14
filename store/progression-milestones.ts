import { MONSTER_IDS, MonsterId, resolveMonsterId } from "./monster-id";
import {
  Milestone,
  milestoneForLevel,
  milestoneGrantId,
  unclaimedMilestones,
} from "./progression";
import {
  assignLegacyPetToSelectedMonster,
  UnsettledMilestone,
  usePetStore,
} from "./use-pet-store";
import { usePlayerStore } from "./use-player-store";
import {
  assignLegacyInventoryToSelectedMonster,
  useStoreStore,
} from "./use-store-store";

/**
 * Milestone payouts — the intent-and-receipt pattern, same as task rewards.
 *
 * Level is derived from the pet slice's totalPointsEarned, so nothing has to
 * "notice" a level-up at the right moment: this settle step runs after every
 * reward grant and on every recovery pass, and simply pays out whatever has
 * been reached but not yet claimed.
 *
 *   1. pet.reserveMilestone   — marks the level claimed on that monster's
 *                                slice AND writes the intent, in one set().
 *   2. player.applyRewardGrantPoints(id)   — receipt on the player store.
 *   3. store.applyRewardGrantFreeItem(id)  — receipt on the store store.
 *   4. pet.clearUnsettledMilestone(id)     — drop the intent.
 *
 * A crash after 1 leaves the intent; recovery replays 2–4 and every receipt
 * makes the repeat a no-op. A crash before 1 leaves the level unclaimed and
 * the next settle pays it. Repeated calls on a settled state do nothing.
 *
 * Unlock-only milestones (a shop tier opening) write nothing beyond the
 * claimed mark; the shop reads level on render.
 */

function storesHydrated(): boolean {
  return (
    usePetStore.persist.hasHydrated() &&
    usePlayerStore.persist.hasHydrated() &&
    useStoreStore.persist.hasHydrated()
  );
}

function payOut(intent: UnsettledMilestone, milestone: Milestone): void {
  if (milestone.points) {
    usePlayerStore
      .getState()
      .applyRewardGrantPoints(intent.id, milestone.points);
  }
  const itemId = milestone.itemId?.[intent.monster];
  if (itemId) {
    useStoreStore
      .getState()
      .applyRewardGrantFreeItem(intent.id, itemId, intent.monster);
  }
  usePetStore.getState().clearUnsettledMilestone(intent.id);
}

/**
 * Pay every reached-but-unclaimed milestone for one monster. Returns the
 * levels newly claimed in this call (for the UI's level-up moment); empty
 * when nothing new happened.
 */
export function settleMilestonesFor(monster: MonsterId): number[] {
  if (!storesHydrated()) return [];
  const slice = usePetStore.getState().byMonster[monster];
  if (!slice) return [];
  const due = unclaimedMilestones(
    slice.totalPointsEarned,
    slice.claimedMilestones,
  );
  const newlyClaimed: number[] = [];
  for (const milestone of due) {
    const intent: UnsettledMilestone = {
      id: milestoneGrantId(monster, milestone.level),
      monster,
      level: milestone.level,
    };
    if (!usePetStore.getState().reserveMilestone(intent)) continue;
    newlyClaimed.push(milestone.level);
    payOut(intent, milestone);
  }
  return newlyClaimed;
}

/** Settle for the currently selected monster. */
export function settleMilestonesForSelected(): number[] {
  return settleMilestonesFor(
    resolveMonsterId(usePlayerStore.getState().selectedMonster),
  );
}

/**
 * Finish any payout whose intent survived a crash, then settle anything
 * newly reached for both monsters. Safe to call repeatedly.
 */
export function recoverUnsettledMilestones(): void {
  if (!storesHydrated()) return;
  // A shared pre-v4 save is staged on Nilly until the player store says who
  // was selected; settle only after it has landed on the right monster.
  assignLegacyPetToSelectedMonster();
  assignLegacyInventoryToSelectedMonster();
  const pending = [...(usePetStore.getState().unsettledMilestones ?? [])];
  for (const intent of pending) {
    const milestone = milestoneForLevel(intent.level);
    if (!milestone) {
      // A level that no longer has a milestone owes nothing; drop the intent
      // so it does not re-enter recovery forever.
      usePetStore.getState().clearUnsettledMilestone(intent.id);
      continue;
    }
    payOut(intent, milestone);
  }
  for (const monster of MONSTER_IDS) settleMilestonesFor(monster);
}

export function subscribeUnsettledMilestoneRecovery(): () => void {
  const unsubs: (() => void)[] = [];
  let finished = false;

  const onReady = () => {
    if (finished) return;
    if (!storesHydrated()) return;
    finished = true;
    while (unsubs.length > 0) unsubs.pop()?.();
    recoverUnsettledMilestones();
  };

  if (!usePetStore.persist.hasHydrated()) {
    unsubs.push(usePetStore.persist.onFinishHydration(onReady));
  }
  if (!usePlayerStore.persist.hasHydrated()) {
    unsubs.push(usePlayerStore.persist.onFinishHydration(onReady));
  }
  if (!useStoreStore.persist.hasHydrated()) {
    unsubs.push(useStoreStore.persist.onFinishHydration(onReady));
  }

  onReady();

  return () => {
    finished = true;
    while (unsubs.length > 0) unsubs.pop()?.();
  };
}
