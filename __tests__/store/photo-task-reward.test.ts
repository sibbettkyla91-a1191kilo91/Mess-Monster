import { REWARD_TABLE } from "@/constants/task-timers";
import {
  describeFreeGift,
  finishPhotoTaskWait,
  pickFreeGiftItem,
} from "@/store/photo-task-reward";
import { PRESET_TASKS } from "@/store/preset-tasks";
import { STORE_ITEMS } from "@/store/store-items";
import { TaskProgress } from "@/store/use-tasks-store";

const TASK = PRESET_TASKS.find((t) => t.id === "wash-dishes")!;
const waiting: TaskProgress = {
  state: "waiting",
  hasPhoto: true,
  waitStartedAt: 1,
};

describe("pickFreeGiftItem", () => {
  it("only returns a cheap repeatable snack", () => {
    const item = pickFreeGiftItem();
    expect(item).toBeDefined();
    expect(item!.repeatable).toBe(true);
    expect(item!.price).toBeLessThanOrEqual(50);
  });
});

describe("finishPhotoTaskWait", () => {
  it("records the gift without writing inventory", () => {
    const cookie = STORE_ITEMS.find((i) => i.id === "food-cookie")!;
    const outcome = REWARD_TABLE.find((r) => r.outcome.tier === "free_item")!
      .outcome;
    const next = finishPhotoTaskWait(TASK, waiting, outcome, cookie);

    expect(next.state).toBe("reward_ready");
    expect(next.rewardInfo?.freeItemId).toBe("food-cookie");
    expect(next.rewardInfo?.freeItemName).toBe(describeFreeGift(cookie));
    expect(next.rewardInfo?.finalPoints).toBe(TASK.pointValue);
  });

  it("omits gift fields when the roll has no free item", () => {
    const outcome = REWARD_TABLE.find((r) => r.outcome.tier === "base")!.outcome;
    const next = finishPhotoTaskWait(TASK, waiting, outcome);

    expect(next.rewardInfo?.freeItemId).toBeUndefined();
    expect(next.rewardInfo?.freeItemName).toBeUndefined();
  });
});
