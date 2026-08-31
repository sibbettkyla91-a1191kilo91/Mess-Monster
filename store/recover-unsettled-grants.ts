import { localDayString } from "@/utils/local-day";
import { usePetStore } from "./use-pet-store";
import { usePlayerStore } from "./use-player-store";
import { useStoreStore } from "./use-store-store";
import { UnsettledRewardGrant, useTasksStore } from "./use-tasks-store";

const STREAK_MILESTONE_BONUS = 50;

function storesHydrated(): boolean {
  return (
    useTasksStore.persist.hasHydrated() &&
    usePlayerStore.persist.hasHydrated() &&
    usePetStore.persist.hasHydrated() &&
    useStoreStore.persist.hasHydrated()
  );
}

/**
 * Grant-aware streak bonus. The +50 lives on the player store with a
 * grant-specific receipt; the pet milestone list is updated after, in the
 * same pet set() as a grant-scoped streakMilestone receipt. Recovery must
 * not call checkStreakMilestones(), which awards the bonus with no receipt.
 * A stale countsTowardActivity grant whose earnedDate is not today must not
 * mint a new bonus — unless this grant already has an in-flight pet
 * streakMilestone receipt, in which case the +50 must still be completed.
 */
function applyGrantStreakMilestone(grant: UnsettledRewardGrant): void {
  const player = usePlayerStore.getState();
  const pet = usePetStore.getState();
  const alreadyPaid = !!player.appliedRewardGrants[grant.id]?.streak;
  const petHit = pet.appliedRewardGrants[grant.id]?.streakMilestone;
  const liveHit =
    grant.countsTowardActivity && grant.earnedDate === localDayString()
      ? pet.unclaimedStreakMilestone()
      : undefined;
  const hit = petHit ?? liveHit;

  if (!alreadyPaid) {
    if (hit == null) return;
    player.applyRewardGrantStreakBonus(grant.id, STREAK_MILESTONE_BONUS);
  }

  const toRecord = hit ?? pet.unclaimedStreakMilestone();
  if (toRecord != null) {
    usePetStore.getState().applyRewardGrantStreakMilestone(grant.id, toRecord);
  }
}

function applyOneGrant(grant: UnsettledRewardGrant): void {
  const player = usePlayerStore.getState();
  const pet = usePetStore.getState();
  const tasks = useTasksStore.getState();

  // 1. player points
  player.applyRewardGrantPoints(grant.id, grant.rewardInfo.finalPoints);
  // 2. pet tracking / evolution
  pet.applyRewardGrantTracked(
    grant.id,
    grant.rewardInfo.finalPoints,
    grant.category,
  );
  // 3. task history
  tasks.applyRewardGrantHistory(grant);
  // 4. activity for a claim that still belongs to today
  if (grant.countsTowardActivity) {
    player.applyRewardGrantActivity(grant.id, grant.earnedDate);
  }
  // 5. streak bonus: player +50 + receipt, then pet milestone
  applyGrantStreakMilestone(grant);
  // 6. pet care
  usePetStore.getState().applyRewardGrantCared(grant.id);
  // 7. free snack, only when this roll recorded a catalog id (claim-time grant)
  if (grant.rewardInfo.freeItemId) {
    useStoreStore
      .getState()
      .applyRewardGrantFreeItem(grant.id, grant.rewardInfo.freeItemId);
  }
  // 8. drop the intent once every effect has a durable receipt
  useTasksStore.getState().clearUnsettledGrant(grant.id);
}

/**
 * Finish applying any reserved reward grants. No-op until tasks, player,
 * pet, and store have rehydrated, and no-op per-effect where a receipt
 * already exists.
 * Safe to call from the live claim path and from cold-start recovery.
 */
export function recoverUnsettledGrants(): void {
  if (!storesHydrated()) return;
  const grants = useTasksStore.getState().unsettledGrants;
  for (const grant of grants) {
    applyOneGrant(grant);
  }
}

/**
 * Run recoverUnsettledGrants once all four persisted stores have hydrated,
 * regardless of which store finishes first. Cleans up the hydration
 * listeners after the first successful pass.
 */
export function subscribeUnsettledGrantRecovery(): () => void {
  const unsubs: Array<() => void> = [];
  let finished = false;

  const onReady = () => {
    if (finished) return;
    if (!storesHydrated()) return;
    finished = true;
    while (unsubs.length > 0) unsubs.pop()?.();
    recoverUnsettledGrants();
  };

  if (!useTasksStore.persist.hasHydrated()) {
    unsubs.push(useTasksStore.persist.onFinishHydration(onReady));
  }
  if (!usePlayerStore.persist.hasHydrated()) {
    unsubs.push(usePlayerStore.persist.onFinishHydration(onReady));
  }
  if (!usePetStore.persist.hasHydrated()) {
    unsubs.push(usePetStore.persist.onFinishHydration(onReady));
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
