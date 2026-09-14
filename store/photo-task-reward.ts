import {
  FREE_ITEM_MAX_PRICE,
  RewardOutcome,
} from "@/constants/task-timers";
import { resolveMonsterId } from "./monster-id";
import { PresetTask } from "./preset-tasks";
import { levelForXp } from "./progression";
import { itemsForMonster, StoreItem } from "./store-items";
import { usePetStore } from "./use-pet-store";
import { usePlayerStore } from "./use-player-store";
import type { TaskProgress } from "./use-tasks-store";

/**
 * The gift pool for the selected monster: cheap consumables from ITS shop
 * that its progression has already unlocked. A Luna player never receives
 * Nilly's granola; a level-1 player never receives a level-4 snack.
 */
export function giftPoolForSelectedMonster(): StoreItem[] {
  const monster = resolveMonsterId(usePlayerStore.getState().selectedMonster);
  const level = levelForXp(
    usePetStore.getState().byMonster[monster]?.totalPointsEarned ?? 0,
  );
  return itemsForMonster(monster).filter(
    (i) => !i.unlock || i.unlock.level <= level,
  );
}

export function pickFreeGiftItem(
  items: StoreItem[] = giftPoolForSelectedMonster(),
  rng: () => number = Math.random,
): StoreItem | undefined {
  const affordable = items.filter(
    (i) => i.price <= FREE_ITEM_MAX_PRICE && i.repeatable,
  );
  if (affordable.length === 0) return undefined;
  return affordable[Math.floor(rng() * affordable.length)];
}

export function describeFreeGift(item: StoreItem): string {
  return `${item.emoji} ${item.name}`;
}

/**
 * Timer-complete transition for a photo task. Records which gift was
 * rolled. Does not write inventory — that happens at claim, via the
 * unsettled-grant receipt so a crash in this gap cannot double-grant.
 */
export function finishPhotoTaskWait(
  task: PresetTask,
  progress: TaskProgress,
  outcome: RewardOutcome,
  gift: StoreItem | undefined = outcome.includesFreeItem
    ? pickFreeGiftItem()
    : undefined,
): TaskProgress {
  return {
    ...progress,
    state: "reward_ready",
    rewardInfo: {
      basePoints: task.pointValue,
      pointsMultiplier: outcome.pointsMultiplier,
      finalPoints: Math.round(task.pointValue * outcome.pointsMultiplier),
      freeItemName: gift ? describeFreeGift(gift) : undefined,
      freeItemId: gift?.id,
      outcome,
    },
  };
}
