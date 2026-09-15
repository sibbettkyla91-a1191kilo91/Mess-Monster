/**
 * The loop: claim a chore → points, per-monster XP, a gift into that
 * monster's bag, and — when the XP crosses a level — the milestone payout.
 * Every effect lands exactly once across repeated taps, remounts, and
 * recovery replays, all through the existing grant pipeline.
 */
import { REWARD_TABLE } from "@/constants/task-timers";
import { beforeClaim, buildClaimMoment } from "@/store/claim-moment";
import { VOICE_LINES } from "@/store/monster-voice";
import {
  finishPhotoTaskWait,
  giftPoolForSelectedMonster,
  pickFreeGiftItem,
} from "@/store/photo-task-reward";
import { PRESET_TASKS } from "@/store/preset-tasks";
import {
  levelForXp,
  MILESTONES,
  milestoneGrantId,
  xpForLevel,
} from "@/store/progression";
import { recoverUnsettledGrants } from "@/store/recover-unsettled-grants";
import { recoverUnsettledMilestones } from "@/store/progression-milestones";
import { getStoreItem } from "@/store/store-items";
import { createDefaultPetSlice, usePetStore } from "@/store/use-pet-store";
import { usePlayerStore } from "@/store/use-player-store";
import { useStoreStore } from "@/store/use-store-store";
import { TaskProgress, useTasksStore } from "@/store/use-tasks-store";
import { localDayString } from "@/utils/local-day";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/utils/daily-nudge", () => ({
  rescheduleDailyNudges: jest.fn().mockResolvedValue(undefined),
}));

const TASK = PRESET_TASKS.find((t) => t.id === "wash-dishes")!;
const GIFT = getStoreItem("nilly-food-granola-honey-bar")!;
const POINTS_MILESTONE = MILESTONES.find((m) => m.points)!;

async function flushHydration() {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

function seedReadyTask(rewardInfo: NonNullable<TaskProgress["rewardInfo"]>) {
  useTasksStore.setState({
    dailyRollDate: localDayString(),
    dailyRoll: [TASK],
    taskProgress: {
      [TASK.id]: { state: "reward_ready", hasPhoto: true, rewardInfo },
    },
    pendingRewards: [],
    unsettledGrants: [],
    appliedRewardGrants: {},
    tasks: [],
  });
}

function resetStores(nillyXp = 0) {
  useTasksStore.setState({
    tasks: [],
    pendingRewards: [],
    unsettledGrants: [],
    appliedRewardGrants: {},
    taskProgress: {},
    dailyRollDate: localDayString(),
    dailyRoll: [TASK],
  });
  usePlayerStore.setState({
    selectedMonster: "nilly",
    totalPoints: 100,
    spentPoints: 0,
    streak: 0,
    lastActiveDay: "",
    activeDaysCount: 0,
    appliedRewardGrants: {},
  });
  usePetStore.setState({
    byMonster: {
      nilly: {
        ...createDefaultPetSlice(),
        health: 50,
        happiness: 50,
        totalPointsEarned: nillyXp,
      },
      luna: { ...createDefaultPetSlice(), health: 50, happiness: 50 },
    },
    claimedStreakMilestones: [],
    pendingMilestoneBanner: null,
    appliedRewardGrants: {},
    unsettledMilestones: [],
  });
  useStoreStore.setState({
    byMonster: {
      nilly: { owned: {}, placed: {}, equipped: {} },
      luna: { owned: {}, placed: {}, equipped: {} },
    },
    unsettledPurchases: [],
    appliedPurchases: {},
    appliedRewardGrants: {},
  });
}

beforeEach(async () => {
  resetStores();
  await flushHydration();
});

describe("claiming a task", () => {
  it("grants points, per-monster XP and the rolled gift into that monster's bag", () => {
    seedReadyTask({
      basePoints: 20,
      pointsMultiplier: 1.5,
      finalPoints: 30,
      freeItemId: GIFT.id,
      freeItemName: `${GIFT.emoji} ${GIFT.name}`,
    });
    expect(useTasksStore.getState().claimTaskReward(TASK.id)).not.toBeNull();
    recoverUnsettledGrants();

    expect(usePlayerStore.getState().totalPoints).toBe(130);
    const pet = usePetStore.getState();
    expect(pet.byMonster.nilly.totalPointsEarned).toBe(30);
    expect(pet.byMonster.luna.totalPointsEarned).toBe(0);
    const shop = useStoreStore.getState();
    expect(shop.byMonster.nilly.owned[GIFT.id].quantity).toBe(1);
    expect(shop.byMonster.nilly.owned[GIFT.id].item).toEqual(GIFT);
    expect(shop.byMonster.luna.owned).toEqual({});
    expect(useTasksStore.getState().unsettledGrants).toEqual([]);
  });

  it("lands exactly once across a second tap, a replay, and a foreground pass", () => {
    seedReadyTask({
      basePoints: 20,
      pointsMultiplier: 1,
      finalPoints: 20,
      freeItemId: GIFT.id,
    });
    useTasksStore.getState().claimTaskReward(TASK.id);
    recoverUnsettledGrants();
    // Second tap on a claimed task is refused at the source…
    expect(useTasksStore.getState().claimTaskReward(TASK.id)).toBeNull();
    // …and replays (remount effect, foreground, cold-start) hit receipts.
    recoverUnsettledGrants();
    recoverUnsettledGrants();
    recoverUnsettledMilestones();

    expect(usePlayerStore.getState().totalPoints).toBe(120);
    expect(usePetStore.getState().byMonster.nilly.totalPointsEarned).toBe(20);
    expect(
      useStoreStore.getState().byMonster.nilly.owned[GIFT.id].quantity,
    ).toBe(1);
  });

  it("a grant left unsettled (crash before recovery) is finished once", () => {
    seedReadyTask({ basePoints: 20, pointsMultiplier: 1, finalPoints: 20 });
    useTasksStore.getState().claimTaskReward(TASK.id);
    // Crash here: intent persisted, nothing applied.
    expect(useTasksStore.getState().unsettledGrants).toHaveLength(1);
    expect(usePlayerStore.getState().totalPoints).toBe(100);

    recoverUnsettledGrants();
    recoverUnsettledGrants();
    expect(usePlayerStore.getState().totalPoints).toBe(120);
    expect(usePetStore.getState().byMonster.nilly.totalPointsEarned).toBe(20);
  });
});

describe("level-up through the pipeline", () => {
  it("crossing a milestone level pays it once, via the grant's XP write", () => {
    const target = xpForLevel(POINTS_MILESTONE.level);
    resetStores(target - 10);
    // Any earlier milestones are already claimed in this save.
    const earlier = MILESTONES.filter(
      (m) => m.level < POINTS_MILESTONE.level,
    ).map((m) => m.level);
    usePetStore.setState({
      byMonster: {
        ...usePetStore.getState().byMonster,
        nilly: {
          ...usePetStore.getState().byMonster.nilly,
          claimedMilestones: earlier,
        },
      },
    });
    seedReadyTask({ basePoints: 20, pointsMultiplier: 1, finalPoints: 20 });

    const before = beforeClaim();
    expect(before.level).toBe(POINTS_MILESTONE.level - 1);
    useTasksStore.getState().claimTaskReward(TASK.id);
    recoverUnsettledGrants();

    const pet = usePetStore.getState();
    expect(levelForXp(pet.byMonster.nilly.totalPointsEarned)).toBe(
      POINTS_MILESTONE.level,
    );
    expect(pet.byMonster.nilly.claimedMilestones).toContain(
      POINTS_MILESTONE.level,
    );
    expect(pet.unsettledMilestones).toEqual([]);
    // Task points + milestone bonus, each once.
    expect(usePlayerStore.getState().totalPoints).toBe(
      100 + 20 + POINTS_MILESTONE.points!,
    );
    expect(
      usePlayerStore.getState().appliedRewardGrants[
        milestoneGrantId("nilly", POINTS_MILESTONE.level)
      ],
    ).toEqual({ points: true });

    recoverUnsettledGrants();
    recoverUnsettledMilestones();
    expect(usePlayerStore.getState().totalPoints).toBe(
      100 + 20 + POINTS_MILESTONE.points!,
    );

    // The moment the screen shows is derived from the same reads.
    const moment = buildClaimMoment(before, 20, null, () => 0);
    expect(moment.leveledUp).toBe(true);
    expect(moment.progress.level).toBe(POINTS_MILESTONE.level);
    expect(moment.milestone?.level).toBe(POINTS_MILESTONE.level);
    expect(VOICE_LINES.nilly.task).toContain(moment.voiceLine);
  });

  it("Luna's claim levels Luna, not Nilly", () => {
    usePlayerStore.setState({ selectedMonster: "luna" });
    seedReadyTask({ basePoints: 20, pointsMultiplier: 2, finalPoints: 40 });
    useTasksStore.getState().claimTaskReward(TASK.id);
    recoverUnsettledGrants();
    const pet = usePetStore.getState();
    expect(pet.byMonster.luna.totalPointsEarned).toBe(40);
    expect(pet.byMonster.nilly.totalPointsEarned).toBe(0);
    expect(pet.byMonster.nilly.claimedMilestones).toEqual([]);
  });
});

describe("gift roll", () => {
  it("draws only from the selected monster's unlocked, cheap food", () => {
    usePlayerStore.setState({ selectedMonster: "luna" });
    const pool = giftPoolForSelectedMonster();
    expect(pool.length).toBeGreaterThan(0);
    for (const item of pool) {
      expect(item.monster).toBe("luna");
      expect(item.unlock).toBeUndefined();
    }
    for (let i = 0; i < 25; i++) {
      const gift = pickFreeGiftItem();
      expect(gift).toBeDefined();
      expect(gift!.monster).toBe("luna");
      expect(gift!.repeatable).toBe(true);
      expect(gift!.price).toBeLessThanOrEqual(50);
    }
  });

  it("opens up higher-tier snacks once the level is reached", () => {
    const berries = getStoreItem("nilly-food-fresh-berries")!;
    expect(giftPoolForSelectedMonster()).not.toContainEqual(berries);
    resetStores(xpForLevel(berries.unlock!.level));
    expect(giftPoolForSelectedMonster()).toContainEqual(berries);
  });

  it("finishPhotoTaskWait records a monster-scoped gift id for the claim to grant", () => {
    const outcome = REWARD_TABLE.find((r) => r.outcome.tier === "free_item")!
      .outcome;
    const next = finishPhotoTaskWait(
      TASK,
      { state: "waiting", hasPhoto: true, waitStartedAt: 1 },
      outcome,
    );
    expect(next.rewardInfo?.freeItemId).toBeDefined();
    expect(getStoreItem(next.rewardInfo!.freeItemId!)!.monster).toBe("nilly");
    // Nothing granted yet — that happens at claim through the receipt.
    expect(useStoreStore.getState().byMonster.nilly.owned).toEqual({});
  });
});
