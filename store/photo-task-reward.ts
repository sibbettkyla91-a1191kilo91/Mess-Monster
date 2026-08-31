import {
  FREE_ITEM_MAX_PRICE,
  RewardOutcome,
} from "@/constants/task-timers";
import { PresetTask } from "./preset-tasks";
import { STORE_ITEMS, StoreItem } from "./store-items";
import type { TaskProgress } from "./use-tasks-store";

export function pickFreeGiftItem(
  items: StoreItem[] = STORE_ITEMS,
): StoreItem | undefined {
  const affordable = items.filter(
    (i) => i.price <= FREE_ITEM_MAX_PRICE && i.repeatable,
  );
  if (affordable.length === 0) return undefined;
  return affordable[Math.floor(Math.random() * affordable.length)];
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
