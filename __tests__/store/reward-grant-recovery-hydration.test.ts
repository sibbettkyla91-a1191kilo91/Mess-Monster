/**
 * Recovery must wait until tasks, player, and pet have all rehydrated,
 * regardless of which store finishes first. These tests seed a reserved
 * grant in the persisted tasks save and resolve the three stores in
 * different orders.
 */
const mockResolvers: Record<string, (value: string | null) => void> = {};

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(
    (key: string) =>
      new Promise((resolve) => {
        mockResolvers[key] = resolve;
      }),
  ),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/utils/daily-nudge", () => ({
  rescheduleDailyNudges: jest.fn().mockResolvedValue(undefined),
  initNotifications: jest.fn().mockResolvedValue(undefined),
}));

const TODAY = "2026-05-27";

const GRANT = {
  id: `${TODAY}:wash-dishes`,
  taskId: "wash-dishes",
  label: "Wash the dishes",
  category: "kitchen",
  pointValue: 20,
  earnedDate: TODAY,
  hasPhoto: false,
  rewardInfo: {
    basePoints: 20,
    pointsMultiplier: 1,
    finalPoints: 20,
  },
  claimedAt: Date.parse("2026-05-27T12:00:00"),
  countsTowardActivity: true,
};

const TASKS_SAVE = JSON.stringify({
  state: {
    tasks: [],
    dailyRoll: [],
    dailyRollDate: TODAY,
    taskProgress: {
      "wash-dishes": {
        state: "claimed",
        hasPhoto: false,
        rewardInfo: GRANT.rewardInfo,
      },
    },
    pendingRewards: [],
    unsettledGrants: [GRANT],
    appliedRewardGrants: {},
  },
  version: 3,
});

const PLAYER_SAVE = JSON.stringify({
  state: {
    totalPoints: 100,
    spentPoints: 0,
    streak: 0,
    lastActiveDay: "",
    activeDaysCount: 0,
    appliedRewardGrants: {},
  },
  version: 5,
});

const PET_SAVE = JSON.stringify({
  state: {
    health: 50,
    happiness: 50,
    lastCaredAt: Date.now(),
    lastSessionAt: Date.now(),
    evolutionStage: "egg",
    totalPointsEarned: 0,
    adultVariant: "base",
    categoryCompletions: {},
    claimedStreakMilestones: [],
    pendingMilestoneBanner: null,
    pendingEvolution: null,
    pendingPremiumGate: null,
    premiumGateShownFor: null,
    appliedRewardGrants: {},
  },
  version: 3,
});

const OLD_TASKS_SAVE = JSON.stringify({
  state: { tasks: [], taskProgress: {}, pendingRewards: [] },
  version: 2,
});

const OLD_PLAYER_SAVE = JSON.stringify({
  state: { totalPoints: 100, spentPoints: 0, streak: 0, lastActiveDay: "" },
  version: 4,
});

const OLD_PET_SAVE = JSON.stringify({
  state: {
    health: 100,
    happiness: 100,
    lastCaredAt: Date.now(),
    lastSessionAt: Date.now(),
    evolutionStage: "egg",
    totalPointsEarned: 0,
  },
  version: 2,
});

function coldStart() {
  jest.resetModules();
  /* eslint-disable @typescript-eslint/no-require-imports */
  const { useTasksStore } = require("@/store/use-tasks-store");
  const { usePlayerStore } = require("@/store/use-player-store");
  const { usePetStore } = require("@/store/use-pet-store");
  const {
    recoverUnsettledGrants,
    subscribeUnsettledGrantRecovery,
  } = require("@/store/recover-unsettled-grants");
  /* eslint-enable @typescript-eslint/no-require-imports */
  return {
    useTasksStore,
    usePlayerStore,
    usePetStore,
    recoverUnsettledGrants,
    subscribeUnsettledGrantRecovery,
  };
}

async function flushHydration() {
  for (let i = 0; i < 10; i++) await Promise.resolve();
  await new Promise((resolve) => setImmediate(resolve));
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

describe("recovery hydration order", () => {
  it("waits when player hydrates last", async () => {
    const {
      useTasksStore,
      usePlayerStore,
      usePetStore,
      subscribeUnsettledGrantRecovery,
    } = coldStart();
    const stop = subscribeUnsettledGrantRecovery();

    mockResolvers["mm-tasks"](TASKS_SAVE);
    mockResolvers["mm-pet"](PET_SAVE);
    await flushHydration();

    expect(usePlayerStore.persist.hasHydrated()).toBe(false);
    expect(usePlayerStore.getState().totalPoints).toBe(100);
    expect(useTasksStore.getState().unsettledGrants).toHaveLength(1);

    mockResolvers["mm-player"](PLAYER_SAVE);
    await flushHydration();

    expect(usePlayerStore.getState().totalPoints).toBe(120);
    expect(usePetStore.getState().totalPointsEarned).toBe(20);
    expect(useTasksStore.getState().unsettledGrants).toHaveLength(0);
    stop();
  });

  it("waits when pet hydrates last", async () => {
    const {
      useTasksStore,
      usePlayerStore,
      usePetStore,
      subscribeUnsettledGrantRecovery,
    } = coldStart();
    const stop = subscribeUnsettledGrantRecovery();

    mockResolvers["mm-tasks"](TASKS_SAVE);
    mockResolvers["mm-player"](PLAYER_SAVE);
    await flushHydration();

    expect(usePetStore.persist.hasHydrated()).toBe(false);
    expect(usePlayerStore.getState().totalPoints).toBe(100);

    mockResolvers["mm-pet"](PET_SAVE);
    await flushHydration();

    expect(usePlayerStore.getState().totalPoints).toBe(120);
    expect(usePetStore.getState().totalPointsEarned).toBe(20);
    expect(useTasksStore.getState().unsettledGrants).toHaveLength(0);
    stop();
  });

  it("waits when tasks hydrates last", async () => {
    const {
      useTasksStore,
      usePlayerStore,
      subscribeUnsettledGrantRecovery,
    } = coldStart();
    const stop = subscribeUnsettledGrantRecovery();

    mockResolvers["mm-player"](PLAYER_SAVE);
    mockResolvers["mm-pet"](PET_SAVE);
    await flushHydration();

    expect(useTasksStore.persist.hasHydrated()).toBe(false);
    expect(usePlayerStore.getState().totalPoints).toBe(100);

    mockResolvers["mm-tasks"](TASKS_SAVE);
    await flushHydration();

    expect(usePlayerStore.getState().totalPoints).toBe(120);
    expect(useTasksStore.getState().unsettledGrants).toHaveLength(0);
    stop();
  });

  it("does not recover until all three stores are ready", async () => {
    const { usePlayerStore, recoverUnsettledGrants } = coldStart();

    mockResolvers["mm-tasks"](TASKS_SAVE);
    await flushHydration();
    recoverUnsettledGrants();
    expect(usePlayerStore.getState().totalPoints).toBe(100);

    mockResolvers["mm-player"](PLAYER_SAVE);
    await flushHydration();
    recoverUnsettledGrants();
    expect(usePlayerStore.getState().totalPoints).toBe(100);
  });

  it("older persisted versions initialize empty grant/receipt fields", async () => {
    const { useTasksStore, usePlayerStore, usePetStore } = coldStart();

    mockResolvers["mm-tasks"](OLD_TASKS_SAVE);
    mockResolvers["mm-player"](OLD_PLAYER_SAVE);
    mockResolvers["mm-pet"](OLD_PET_SAVE);
    await flushHydration();

    expect(useTasksStore.getState().unsettledGrants).toEqual([]);
    expect(useTasksStore.getState().appliedRewardGrants).toEqual({});
    expect(usePlayerStore.getState().appliedRewardGrants).toEqual({});
    expect(usePetStore.getState().appliedRewardGrants).toEqual({});
  });
});
