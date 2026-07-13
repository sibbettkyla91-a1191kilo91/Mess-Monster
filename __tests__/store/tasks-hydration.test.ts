/**
 * Cold-start hydration race for the Tasks screen's task-logging flow
 * (earnPoints / recordActivity / addTask), mirroring store-hydration.test.ts.
 *
 * Claiming a reward writes to the player and tasks stores; persist's shallow
 * hydration merge replaces those top-level fields wholesale, so a claim
 * landing before rehydration completes is silently erased. The Tasks screen
 * gates its handlers on persist.hasHydrated() for every store it touches.
 */

// Deferred AsyncStorage keyed by persist name: each store's hydration stays
// in flight until the test resolves that key — the cold-start window.
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

// A returning player's saves with no activity yet.
const PLAYER_SAVE = JSON.stringify({
  state: { totalPoints: 100, spentPoints: 0, streak: 0, lastActiveDay: "" },
  version: 4,
});
const TASKS_SAVE = JSON.stringify({
  state: { tasks: [], taskProgress: {}, pendingRewards: [] },
  version: 2,
});

const CLAIM_TASK = {
  id: "wipe-counters",
  label: "Wipe the counters",
  category: "kitchen",
  pointValue: 30,
};

/** Fresh store instances whose rehydration is still in flight. */
function coldStart() {
  jest.resetModules();
  /* eslint-disable @typescript-eslint/no-require-imports */
  const { usePlayerStore } = require("@/store/use-player-store");
  const { useTasksStore } = require("@/store/use-tasks-store");
  const { localDayString } = require("@/utils/local-day");
  /* eslint-enable @typescript-eslint/no-require-imports */
  return { usePlayerStore, useTasksStore, localDayString };
}

/** Drain the getItem → migrate → merge → setItem promise chain. */
async function flushHydration() {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

// Mirrors handleClaimReward's persisted-store writes.
function claim(usePlayerStore: any, useTasksStore: any) {
  usePlayerStore.getState().earnPoints(CLAIM_TASK.pointValue);
  useTasksStore.getState().addTask({ ...CLAIM_TASK, completedAt: Date.now() });
  usePlayerStore.getState().recordActivity();
}

describe("Tasks screen cold-start hydration race", () => {
  it("clobbers a claim written before rehydration completes (the bug)", async () => {
    const { usePlayerStore, useTasksStore } = coldStart();

    expect(usePlayerStore.persist.hasHydrated()).toBe(false);
    expect(useTasksStore.persist.hasHydrated()).toBe(false);

    // Fast tap: claim before AsyncStorage has resolved.
    claim(usePlayerStore, useTasksStore);
    expect(usePlayerStore.getState().totalPoints).toBe(130);
    expect(useTasksStore.getState().tasks).toHaveLength(1);
    expect(usePlayerStore.getState().streak).toBe(1);

    // Rehydration lands with the previous session's saves.
    mockResolvers["mm-player"](PLAYER_SAVE);
    mockResolvers["mm-tasks"](TASKS_SAVE);
    await flushHydration();

    // Points, logged task, and streak are all gone.
    expect(usePlayerStore.getState().totalPoints).toBe(100);
    expect(useTasksStore.getState().tasks).toHaveLength(0);
    expect(usePlayerStore.getState().streak).toBe(0);
  });

  it("the screen's gate blocks the doomed claim; a post-hydration claim sticks and reaches the Home tab reads", async () => {
    const { usePlayerStore, useTasksStore, localDayString } = coldStart();

    // Mirrors the handlers' guard: no writes until every touched store is hydrated.
    const attemptClaim = () => {
      if (
        !usePlayerStore.persist.hasHydrated() ||
        !useTasksStore.persist.hasHydrated()
      ) {
        return false;
      }
      claim(usePlayerStore, useTasksStore);
      return true;
    };

    // Pre-hydration tap: prevented, nothing written to clobber.
    expect(attemptClaim()).toBe(false);
    expect(useTasksStore.getState().tasks).toHaveLength(0);

    mockResolvers["mm-player"](PLAYER_SAVE);
    mockResolvers["mm-tasks"](TASKS_SAVE);
    await flushHydration();

    // Retry after hydration: succeeds and survives.
    expect(attemptClaim()).toBe(true);
    expect(usePlayerStore.getState().totalPoints).toBe(130);
    expect(usePlayerStore.getState().streak).toBe(1);

    // Home tab reads: points pill and "done today" count both see the claim.
    const today = localDayString();
    const doneToday = useTasksStore
      .getState()
      .tasks.filter(
        (t: any) =>
          t.completedAt && localDayString(new Date(t.completedAt)) === today,
      ).length;
    expect(doneToday).toBe(1);
    const s = usePlayerStore.getState();
    expect(s.totalPoints - s.spentPoints).toBe(130);
  });
});
