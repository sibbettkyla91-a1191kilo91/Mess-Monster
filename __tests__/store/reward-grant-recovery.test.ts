/**
 * A claim reserves the reward in mm-tasks, then writes player points and pet
 * effects to other stores. Those persist independently, so a crash after the
 * reservation is durable can drop the points. The unsettled-grant log plus
 * per-store receipts make that window recoverable and idempotent.
 */
import { recoverUnsettledGrants } from "@/store/recover-unsettled-grants";
import { PRESET_TASKS } from "@/store/preset-tasks";
import { usePetStore } from "@/store/use-pet-store";
import { usePlayerStore } from "@/store/use-player-store";
import { useStoreStore } from "@/store/use-store-store";
import {
  PendingReward,
  TaskProgress,
  UnsettledRewardGrant,
  migrateTasksState,
  useTasksStore,
} from "@/store/use-tasks-store";
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

const rewardInfo: NonNullable<TaskProgress["rewardInfo"]> = {
  basePoints: 20,
  pointsMultiplier: 1,
  finalPoints: 20,
};

async function flushHydration() {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

function seedReadyTask(overrides: Partial<TaskProgress> = {}) {
  useTasksStore.setState({
    dailyRollDate: localDayString(),
    dailyRoll: [TASK],
    taskProgress: {
      [TASK.id]: {
        state: "reward_ready",
        hasPhoto: false,
        rewardInfo,
        ...overrides,
      },
    },
    pendingRewards: [],
    unsettledGrants: [],
    appliedRewardGrants: {},
    tasks: [],
  });
}

function resetStores() {
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
    totalPoints: 100,
    spentPoints: 0,
    streak: 0,
    lastActiveDay: "",
    activeDaysCount: 0,
    appliedRewardGrants: {},
  });
  usePetStore.setState({
    health: 50,
    happiness: 50,
    lastCaredAt: Date.now() - 60_000,
    lastSessionAt: Date.now(),
    totalPointsEarned: 0,
    categoryCompletions: {},
    evolutionStage: "egg",
    claimedStreakMilestones: [],
    pendingMilestoneBanner: null,
    pendingEvolution: null,
    appliedRewardGrants: {},
  });
}

beforeEach(async () => {
  resetStores();
  await flushHydration();
});

afterEach(() => {
  jest.useRealTimers();
});

describe("reservation durability", () => {
  it("persists claimed source + unsettled grant in the same tasks update", async () => {
    seedReadyTask();

    const claimed = useTasksStore.getState().claimTaskReward(TASK.id);

    expect(claimed?.rewardInfo).toEqual(rewardInfo);
    const s = useTasksStore.getState();
    expect(s.taskProgress[TASK.id].state).toBe("claimed");
    expect(s.unsettledGrants).toHaveLength(1);
    const grant = s.unsettledGrants[0];
    expect(grant.id).toBe(`${localDayString()}:${TASK.id}`);
    expect(grant.countsTowardActivity).toBe(true);
    expect(grant.rewardInfo.finalPoints).toBe(20);
    expect(grant.category).toBe("kitchen");
    // Points have not been awarded yet — that's the crash window.
    expect(usePlayerStore.getState().totalPoints).toBe(100);
  });

  it("persists pending-reward removal + unsettled grant together", () => {
    const pending: PendingReward = {
      id: "2026-05-26:wash-dishes",
      taskId: TASK.id,
      label: TASK.label,
      category: TASK.category,
      pointValue: TASK.pointValue,
      earnedDate: "2026-05-26",
      hasPhoto: false,
      rewardInfo,
    };
    useTasksStore.setState({ pendingRewards: [pending], unsettledGrants: [] });

    const claimed = useTasksStore.getState().claimPendingReward(pending.id);

    expect(claimed?.id).toBe(pending.id);
    const s = useTasksStore.getState();
    expect(s.pendingRewards).toHaveLength(0);
    expect(s.unsettledGrants).toHaveLength(1);
    expect(s.unsettledGrants[0].countsTowardActivity).toBe(false);
    expect(usePlayerStore.getState().totalPoints).toBe(100);
  });
});

describe("successful recovery", () => {
  it("applies points, tracking, history, activity, milestones, care, then clears", () => {
    seedReadyTask();
    useTasksStore.getState().claimTaskReward(TASK.id);

    recoverUnsettledGrants();

    expect(usePlayerStore.getState().totalPoints).toBe(120);
    expect(usePlayerStore.getState().streak).toBe(1);
    expect(usePlayerStore.getState().lastActiveDay).toBe(localDayString());
    expect(usePlayerStore.getState().activeDaysCount).toBe(1);
    expect(usePetStore.getState().totalPointsEarned).toBe(20);
    expect(usePetStore.getState().categoryCompletions.kitchen).toBe(1);
    expect(usePetStore.getState().health).toBe(65); // 50 + 15 care
    expect(usePetStore.getState().happiness).toBe(70); // 50 + 20 care
    expect(useTasksStore.getState().tasks).toHaveLength(1);
    expect(useTasksStore.getState().tasks[0].id).toBe(TASK.id);
    expect(useTasksStore.getState().unsettledGrants).toHaveLength(0);
  });

  it("is a no-op when there are no unsettled grants", () => {
    recoverUnsettledGrants();
    expect(usePlayerStore.getState().totalPoints).toBe(100);
    expect(usePetStore.getState().totalPointsEarned).toBe(0);
    expect(useTasksStore.getState().tasks).toHaveLength(0);
  });

  it("applies today's streak milestone when the claim reaches a milestone", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 4, 27, 12, 0, 0));
    usePlayerStore.setState({
      streak: 2,
      lastActiveDay: "2026-05-26",
      activeDaysCount: 2,
      totalPoints: 100,
      appliedRewardGrants: {},
    });
    seedReadyTask();
    useTasksStore.getState().claimTaskReward(TASK.id);

    recoverUnsettledGrants();

    expect(usePlayerStore.getState().streak).toBe(3);
    expect(usePetStore.getState().claimedStreakMilestones).toContain(3);
    expect(usePetStore.getState().pendingMilestoneBanner).toBe(3);
    // Reward 20 + milestone bonus 50
    expect(usePlayerStore.getState().totalPoints).toBe(170);
    jest.useRealTimers();
  });
});

describe("idempotent recovery", () => {
  it("does not duplicate effects when recovery runs twice", () => {
    seedReadyTask();
    useTasksStore.getState().claimTaskReward(TASK.id);

    recoverUnsettledGrants();
    recoverUnsettledGrants();

    expect(usePlayerStore.getState().totalPoints).toBe(120);
    expect(usePlayerStore.getState().activeDaysCount).toBe(1);
    expect(usePetStore.getState().totalPointsEarned).toBe(20);
    expect(usePetStore.getState().categoryCompletions.kitchen).toBe(1);
    expect(usePetStore.getState().health).toBe(65);
    expect(useTasksStore.getState().tasks).toHaveLength(1);
    expect(useTasksStore.getState().unsettledGrants).toHaveLength(0);
  });
});

describe("crash-window simulation", () => {
  it("applies only the missing effects when some receipts already exist", () => {
    seedReadyTask();
    useTasksStore.getState().claimTaskReward(TASK.id);
    const grant = useTasksStore.getState().unsettledGrants[0];

    // Crash after points persisted, before anything else.
    usePlayerStore.getState().applyRewardGrantPoints(grant.id, 20);
    expect(usePlayerStore.getState().totalPoints).toBe(120);
    expect(usePetStore.getState().totalPointsEarned).toBe(0);

    recoverUnsettledGrants();

    expect(usePlayerStore.getState().totalPoints).toBe(120); // not 140
    expect(usePetStore.getState().totalPointsEarned).toBe(20);
    expect(useTasksStore.getState().tasks).toHaveLength(1);
    expect(usePlayerStore.getState().streak).toBe(1);
    expect(usePetStore.getState().health).toBe(65);
    expect(useTasksStore.getState().unsettledGrants).toHaveLength(0);
  });

  it("clears a grant that is already fully applied", () => {
    seedReadyTask();
    useTasksStore.getState().claimTaskReward(TASK.id);
    recoverUnsettledGrants();

    const grantId = `${localDayString()}:${TASK.id}`;
    useTasksStore.setState({
      unsettledGrants: [
        {
          id: grantId,
          taskId: TASK.id,
          label: TASK.label,
          category: TASK.category,
          pointValue: TASK.pointValue,
          earnedDate: localDayString(),
          hasPhoto: false,
          rewardInfo,
          claimedAt: Date.now(),
          countsTowardActivity: true,
        },
      ],
    });

    recoverUnsettledGrants();

    expect(usePlayerStore.getState().totalPoints).toBe(120);
    expect(usePetStore.getState().totalPointsEarned).toBe(20);
    expect(useTasksStore.getState().tasks).toHaveLength(1);
    expect(useTasksStore.getState().unsettledGrants).toHaveLength(0);
  });
});

describe("today's claim vs carried reward", () => {
  it("records activity and streak for a today's claim", () => {
    seedReadyTask();
    useTasksStore.getState().claimTaskReward(TASK.id);
    recoverUnsettledGrants();

    expect(usePlayerStore.getState().streak).toBe(1);
    expect(usePlayerStore.getState().lastActiveDay).toBe(localDayString());
    expect(usePlayerStore.getState().appliedRewardGrants[
      `${localDayString()}:${TASK.id}`
    ]?.activity).toBe(true);
  });

  it("does not record activity, streak, or a streak bonus for a carried reward", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 4, 28, 12, 0, 0));
    usePlayerStore.setState({
      streak: 2,
      lastActiveDay: "2026-05-27",
      activeDaysCount: 2,
      totalPoints: 100,
      appliedRewardGrants: {},
    });
    const pending: PendingReward = {
      id: "2026-05-26:wash-dishes",
      taskId: TASK.id,
      label: TASK.label,
      category: TASK.category,
      pointValue: TASK.pointValue,
      earnedDate: "2026-05-26",
      hasPhoto: false,
      rewardInfo,
    };
    useTasksStore.setState({ pendingRewards: [pending], unsettledGrants: [] });
    useTasksStore.getState().claimPendingReward(pending.id);

    recoverUnsettledGrants();

    expect(usePlayerStore.getState().totalPoints).toBe(120);
    expect(usePetStore.getState().totalPointsEarned).toBe(20);
    expect(useTasksStore.getState().tasks).toHaveLength(1);
    expect(usePlayerStore.getState().streak).toBe(2);
    expect(usePlayerStore.getState().lastActiveDay).toBe("2026-05-27");
    expect(usePlayerStore.getState().activeDaysCount).toBe(2);
    expect(
      usePlayerStore.getState().appliedRewardGrants[pending.id]?.activity,
    ).toBeUndefined();
    expect(
      usePlayerStore.getState().appliedRewardGrants[pending.id]?.streak,
    ).toBeUndefined();
    expect(usePetStore.getState().claimedStreakMilestones).toEqual([]);
  });
});

describe("persistence migrations", () => {
  it("initializes unsettledGrants and appliedRewardGrants from older tasks state", () => {
    const out = migrateTasksState({
      tasks: [],
      taskProgress: {},
      pendingRewards: [],
    });
    expect(out.unsettledGrants).toEqual([]);
    expect(out.appliedRewardGrants).toEqual({});
  });
});

describe("multiple unsettled grants", () => {
  it("processes each grant independently", () => {
    const todayGrant: UnsettledRewardGrant = {
      id: `${localDayString()}:wash-dishes`,
      taskId: "wash-dishes",
      label: TASK.label,
      category: "kitchen",
      pointValue: 20,
      earnedDate: localDayString(),
      hasPhoto: false,
      rewardInfo,
      claimedAt: Date.now(),
      countsTowardActivity: true,
    };
    const carriedGrant: UnsettledRewardGrant = {
      id: "2026-05-26:make-bed",
      taskId: "make-bed",
      label: "Make the bed",
      category: "bedroom",
      pointValue: 15,
      earnedDate: "2026-05-26",
      hasPhoto: false,
      rewardInfo: {
        basePoints: 15,
        pointsMultiplier: 1,
        finalPoints: 15,
      },
      claimedAt: Date.now(),
      countsTowardActivity: false,
    };
    useTasksStore.setState({
      unsettledGrants: [todayGrant, carriedGrant],
    });

    recoverUnsettledGrants();

    expect(usePlayerStore.getState().totalPoints).toBe(135); // 100+20+15
    expect(usePetStore.getState().totalPointsEarned).toBe(35);
    expect(useTasksStore.getState().tasks.map((t) => t.id)).toEqual([
      "make-bed",
      "wash-dishes",
    ]);
    expect(usePlayerStore.getState().streak).toBe(1);
    expect(usePlayerStore.getState().activeDaysCount).toBe(1);
    expect(useTasksStore.getState().unsettledGrants).toHaveLength(0);
    // Care applied twice (once per grant).
    expect(usePetStore.getState().health).toBe(80); // 50+15+15
  });
});

describe("free-item exclusion", () => {
  it("does not replay a free-item grant through recovery", () => {
    const buyItem = jest.spyOn(useStoreStore.getState(), "buyItem");
    seedReadyTask({
      hasPhoto: true,
      rewardInfo: {
        ...rewardInfo,
        freeItemName: "🍪 Cookie",
      },
    });
    const ownedBefore = { ...useStoreStore.getState().owned };

    useTasksStore.getState().claimTaskReward(TASK.id);
    recoverUnsettledGrants();

    expect(buyItem).not.toHaveBeenCalled();
    expect(useStoreStore.getState().owned).toEqual(ownedBefore);
    // Points still apply; the item itself was awarded at roll time, not claim.
    expect(usePlayerStore.getState().totalPoints).toBe(120);
    buyItem.mockRestore();
  });
});

describe("streak bonus receipts", () => {
  const seedEntitledGrant = () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 4, 27, 12, 0, 0));
    usePlayerStore.setState({
      streak: 2,
      lastActiveDay: "2026-05-26",
      activeDaysCount: 2,
      totalPoints: 100,
      appliedRewardGrants: {},
    });
    seedReadyTask();
    useTasksStore.getState().claimTaskReward(TASK.id);
    return useTasksStore.getState().unsettledGrants[0];
  };

  it("awards the +50 and the milestone exactly once across two recoveries", () => {
    seedEntitledGrant();

    recoverUnsettledGrants();
    recoverUnsettledGrants();

    expect(usePlayerStore.getState().streak).toBe(3);
    expect(usePlayerStore.getState().totalPoints).toBe(170);
    expect(usePetStore.getState().claimedStreakMilestones).toEqual([3]);
    expect(
      usePlayerStore.getState().appliedRewardGrants[
        `${localDayString()}:${TASK.id}`
      ]?.streak,
    ).toBe(true);
    expect(useTasksStore.getState().unsettledGrants).toHaveLength(0);
  });

  it("does not duplicate the +50 when the player receipt exists but the pet milestone does not", () => {
    const grant = seedEntitledGrant();
    const grantId = grant.id;

    // Crash after the player-side bonus persisted, before the pet list.
    usePlayerStore.setState({
      streak: 3,
      lastActiveDay: "2026-05-27",
      activeDaysCount: 3,
      totalPoints: 170,
      appliedRewardGrants: {
        [grantId]: { points: true, activity: true, streak: true },
      },
    });
    usePetStore.setState({
      claimedStreakMilestones: [],
      pendingMilestoneBanner: null,
      appliedRewardGrants: {
        [grantId]: { tracked: true, cared: true },
      },
      totalPointsEarned: 20,
      categoryCompletions: { kitchen: 1 },
    });
    useTasksStore.setState({
      appliedRewardGrants: { [grantId]: { history: true } },
      tasks: [
        {
          id: TASK.id,
          label: TASK.label,
          category: TASK.category,
          pointValue: TASK.pointValue,
          completedAt: grant.claimedAt,
        },
      ],
    });

    recoverUnsettledGrants();
    recoverUnsettledGrants();

    expect(usePlayerStore.getState().totalPoints).toBe(170);
    expect(usePetStore.getState().claimedStreakMilestones).toEqual([3]);
    expect(usePetStore.getState().pendingMilestoneBanner).toBe(3);
    expect(
      usePetStore.getState().appliedRewardGrants[grantId]?.streakMilestone,
    ).toBe(3);
    expect(useTasksStore.getState().unsettledGrants).toHaveLength(0);
  });

  it("restores the +50 when the pet milestone receipt persisted but the player streak receipt did not", () => {
    const grant = seedEntitledGrant();
    const grantId = grant.id;

    // Crash after the pet claimed list + grant receipt persisted, before
    // the player-side +50 / streak receipt.
    usePlayerStore.setState({
      streak: 3,
      lastActiveDay: "2026-05-27",
      activeDaysCount: 3,
      totalPoints: 120,
      appliedRewardGrants: {
        [grantId]: { points: true, activity: true },
      },
    });
    usePetStore.setState({
      claimedStreakMilestones: [3],
      pendingMilestoneBanner: 3,
      appliedRewardGrants: {
        [grantId]: { tracked: true, cared: true, streakMilestone: 3 },
      },
      totalPointsEarned: 20,
      categoryCompletions: { kitchen: 1 },
    });
    useTasksStore.setState({
      appliedRewardGrants: { [grantId]: { history: true } },
      tasks: [
        {
          id: TASK.id,
          label: TASK.label,
          category: TASK.category,
          pointValue: TASK.pointValue,
          completedAt: grant.claimedAt,
        },
      ],
    });

    recoverUnsettledGrants();
    recoverUnsettledGrants();

    expect(usePlayerStore.getState().totalPoints).toBe(170);
    expect(usePlayerStore.getState().appliedRewardGrants[grantId]?.streak).toBe(
      true,
    );
    expect(usePetStore.getState().claimedStreakMilestones).toEqual([3]);
    expect(
      usePetStore.getState().appliedRewardGrants[grantId]?.streakMilestone,
    ).toBe(3);
    expect(useTasksStore.getState().unsettledGrants).toHaveLength(0);
  });

  it("awards the +50 with a streak receipt when none exists yet", () => {
    seedEntitledGrant();

    recoverUnsettledGrants();

    const grantId = `${localDayString()}:${TASK.id}`;
    expect(usePlayerStore.getState().appliedRewardGrants[grantId]?.streak).toBe(
      true,
    );
    expect(usePlayerStore.getState().totalPoints).toBe(170);
    expect(usePetStore.getState().claimedStreakMilestones).toEqual([3]);
  });
});

describe("post-midnight recovery of a today's-roll grant", () => {
  it("awards the reward but does not mint activity, streak, or a milestone bonus", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 4, 28, 0, 1, 0));
    const grant: UnsettledRewardGrant = {
      id: "2026-05-27:wash-dishes",
      taskId: TASK.id,
      label: TASK.label,
      category: TASK.category,
      pointValue: TASK.pointValue,
      earnedDate: "2026-05-27",
      hasPhoto: false,
      rewardInfo,
      claimedAt: Date.parse("2026-05-27T23:50:00"),
      countsTowardActivity: true,
    };
    usePlayerStore.setState({
      streak: 2,
      lastActiveDay: "2026-05-26",
      activeDaysCount: 2,
      totalPoints: 100,
      appliedRewardGrants: {},
    });
    useTasksStore.setState({
      unsettledGrants: [grant],
      appliedRewardGrants: {},
      tasks: [],
    });

    recoverUnsettledGrants();

    expect(usePlayerStore.getState().totalPoints).toBe(120);
    expect(usePetStore.getState().totalPointsEarned).toBe(20);
    expect(useTasksStore.getState().tasks).toHaveLength(1);
    expect(usePetStore.getState().health).toBe(65);
    expect(usePlayerStore.getState().streak).toBe(2);
    expect(usePlayerStore.getState().lastActiveDay).toBe("2026-05-26");
    expect(usePlayerStore.getState().activeDaysCount).toBe(2);
    expect(usePetStore.getState().claimedStreakMilestones).toEqual([]);
    expect(
      usePlayerStore.getState().appliedRewardGrants[grant.id]?.streak,
    ).toBeUndefined();
    expect(useTasksStore.getState().unsettledGrants).toHaveLength(0);
  });
});

describe("ordinary checkStreakMilestones", () => {
  it("still awards the bonus when called outside grant recovery", () => {
    usePlayerStore.setState({ streak: 3, totalPoints: 100 });
    usePetStore.getState().checkStreakMilestones();
    expect(usePetStore.getState().claimedStreakMilestones).toEqual([3]);
    expect(usePlayerStore.getState().totalPoints).toBe(150);
  });
});
