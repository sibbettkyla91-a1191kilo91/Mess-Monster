import AsyncStorage from "@react-native-async-storage/async-storage";

import { TASK_MIN_TIMES } from "@/constants/task-timers";
import { getDailyRoll, PRESET_TASKS } from "@/store/preset-tasks";
import { CleaningTask } from "@/store/types";
import { TaskProgress, useTasksStore } from "@/store/use-tasks-store";
import { localDayString } from "@/utils/local-day";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

const makeTask = (overrides: Partial<CleaningTask> = {}): CleaningTask => ({
  id: "wash-dishes",
  label: "Wash the dishes",
  category: "kitchen",
  pointValue: 20,
  completedAt: Date.now(),
  ...overrides,
});

const rewardInfo: NonNullable<TaskProgress["rewardInfo"]> = {
  basePoints: 20,
  pointsMultiplier: 1,
  finalPoints: 20,
};

beforeEach(() => {
  useTasksStore.setState({
    tasks: [],
    dailyRoll: getDailyRoll(localDayString()),
    dailyRollDate: localDayString(),
    taskProgress: {},
    pendingRewards: [],
  });
});

// ─── addTask ──────────────────────────────────────────────────────────────────

describe("addTask", () => {
  it("adds a task to an empty list", () => {
    const task = makeTask();
    useTasksStore.getState().addTask(task);
    expect(useTasksStore.getState().tasks).toHaveLength(1);
    expect(useTasksStore.getState().tasks[0]).toEqual(task);
  });

  it("prepends newer tasks to the front of the list", () => {
    const first = makeTask({ id: "make-bed", label: "Make the bed" });
    const second = makeTask({ id: "vacuum", label: "Vacuum" });

    useTasksStore.getState().addTask(first);
    useTasksStore.getState().addTask(second);

    const { tasks } = useTasksStore.getState();
    expect(tasks[0].id).toBe("vacuum"); // most recent is first
    expect(tasks[1].id).toBe("make-bed");
  });

  it("preserves all task fields", () => {
    const task = makeTask({ pointValue: 40, category: "bathroom" });
    useTasksStore.getState().addTask(task);
    expect(useTasksStore.getState().tasks[0]).toMatchObject({
      pointValue: 40,
      category: "bathroom",
    });
  });
});

// ─── removeTask ───────────────────────────────────────────────────────────────

describe("removeTask", () => {
  it("removes a task by id", () => {
    const task = makeTask({ id: "scrub-toilet" });
    useTasksStore.getState().addTask(task);
    useTasksStore.getState().removeTask("scrub-toilet");
    expect(useTasksStore.getState().tasks).toHaveLength(0);
  });

  it("removes only the matching task when multiple exist", () => {
    useTasksStore.getState().addTask(makeTask({ id: "task-a" }));
    useTasksStore.getState().addTask(makeTask({ id: "task-b" }));
    useTasksStore.getState().addTask(makeTask({ id: "task-c" }));

    useTasksStore.getState().removeTask("task-b");

    const { tasks } = useTasksStore.getState();
    expect(tasks).toHaveLength(2);
    expect(tasks.map((t) => t.id)).not.toContain("task-b");
  });

  it("is a no-op for an id that does not exist", () => {
    useTasksStore.getState().addTask(makeTask({ id: "task-a" }));
    useTasksStore.getState().removeTask("nonexistent");
    expect(useTasksStore.getState().tasks).toHaveLength(1);
  });
});

// ─── clearHistory ─────────────────────────────────────────────────────────────

describe("clearHistory", () => {
  it("removes all tasks", () => {
    useTasksStore.getState().addTask(makeTask({ id: "a" }));
    useTasksStore.getState().addTask(makeTask({ id: "b" }));
    useTasksStore.getState().addTask(makeTask({ id: "c" }));

    useTasksStore.getState().clearHistory();

    expect(useTasksStore.getState().tasks).toHaveLength(0);
  });

  it("is safe to call on an already-empty list", () => {
    expect(() => useTasksStore.getState().clearHistory()).not.toThrow();
    expect(useTasksStore.getState().tasks).toHaveLength(0);
  });
});

// ─── single-flight reward claims ──────────────────────────────────────────────

describe("claimTaskReward", () => {
  const taskId = "wash-dishes";

  const seedProgress = (state: TaskProgress["state"]) => {
    useTasksStore.setState({
      taskProgress: {
        [taskId]: {
          state,
          hasPhoto: false,
          rewardInfo,
        },
      },
    });
  };

  it("claims a reward_ready task exactly once and transitions it to claimed", () => {
    seedProgress("reward_ready");

    const claimed = useTasksStore.getState().claimTaskReward(taskId);

    expect(claimed?.rewardInfo).toEqual(rewardInfo);
    expect(useTasksStore.getState().taskProgress[taskId].state).toBe("claimed");
  });

  it("does nothing when the task is already claimed", () => {
    seedProgress("claimed");
    let grantedPoints = 0;

    const claimed = useTasksStore.getState().claimTaskReward(taskId);
    if (claimed) grantedPoints += claimed.rewardInfo!.finalPoints;

    expect(claimed).toBeNull();
    expect(grantedPoints).toBe(0);
    expect(useTasksStore.getState().taskProgress[taskId].state).toBe("claimed");
  });

  it("allows only one winner across rapid repeated claim attempts", () => {
    seedProgress("reward_ready");

    const attempts = [
      useTasksStore.getState().claimTaskReward(taskId),
      useTasksStore.getState().claimTaskReward(taskId),
      useTasksStore.getState().claimTaskReward(taskId),
    ];
    const successful = attempts.filter(
      (attempt): attempt is TaskProgress => attempt !== null,
    );

    expect(successful).toHaveLength(1);
    expect(
      successful.reduce(
        (sum, progress) => sum + progress.rewardInfo!.finalPoints,
        0,
      ),
    ).toBe(20);
    expect(useTasksStore.getState().taskProgress[taskId].state).toBe("claimed");
  });

  it.each(["idle", "pending_photo", "waiting", "claimed"] as const)(
    "does not claim from %s",
    (state) => {
      seedProgress(state);

      expect(useTasksStore.getState().claimTaskReward(taskId)).toBeNull();
      expect(useTasksStore.getState().taskProgress[taskId].state).toBe(state);
    },
  );
});

// ─── getDailyRoll (pure function) ─────────────────────────────────────────────

describe("getDailyRoll", () => {
  it("returns exactly 6 tasks", () => {
    expect(getDailyRoll("2026-05-27")).toHaveLength(6);
  });

  it("is deterministic — same date always produces same roll", () => {
    const a = getDailyRoll("2026-05-27");
    const b = getDailyRoll("2026-05-27");
    expect(a.map((t) => t.id)).toEqual(b.map((t) => t.id));
  });

  it("produces different rolls on different dates", () => {
    const a = getDailyRoll("2026-05-27");
    const b = getDailyRoll("2026-05-28");
    expect(a.map((t) => t.id)).not.toEqual(b.map((t) => t.id));
  });

  it("covers at least 4 distinct categories", () => {
    const roll = getDailyRoll("2026-05-27");
    const categories = new Set(roll.map((t) => t.category));
    expect(categories.size).toBeGreaterThanOrEqual(4);
  });

  it("never returns duplicate tasks in the same roll", () => {
    const roll = getDailyRoll("2026-05-27");
    const ids = roll.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("only returns tasks from the provided pool", () => {
    const roll = getDailyRoll("2026-05-27", PRESET_TASKS);
    const poolIds = new Set(PRESET_TASKS.map((t) => t.id));
    roll.forEach((t) => expect(poolIds.has(t.id)).toBe(true));
  });

  it("respects a custom count", () => {
    expect(getDailyRoll("2026-05-27", PRESET_TASKS, 3)).toHaveLength(3);
  });
});

// ─── dailyRoll store state ────────────────────────────────────────────────────

describe("dailyRoll store state", () => {
  it("initialises with exactly 6 tasks", () => {
    expect(useTasksStore.getState().dailyRoll).toHaveLength(6);
  });

  it("initialises dailyRollDate to today", () => {
    const today = localDayString();
    expect(useTasksStore.getState().dailyRollDate).toBe(today);
  });

  it("refreshDailyRoll is a no-op when the date has not changed", () => {
    const before = useTasksStore.getState().dailyRoll.map((t) => t.id);
    useTasksStore.getState().refreshDailyRoll();
    const after = useTasksStore.getState().dailyRoll.map((t) => t.id);
    expect(after).toEqual(before);
  });

  it("refreshDailyRoll recomputes when dailyRollDate is stale", () => {
    const today = localDayString();
    useTasksStore.setState({ dailyRollDate: "2020-01-01", dailyRoll: [] });
    useTasksStore.getState().refreshDailyRoll();
    expect(useTasksStore.getState().dailyRollDate).toBe(today);
    expect(useTasksStore.getState().dailyRoll).toHaveLength(6);
  });
});

// ─── pending rewards: carry across day rollover ───────────────────────────────
// Zero-shame rule: a reward earned but not collected before the day rolls over
// must survive indefinitely, not vanish with the daily reset.

describe("pending rewards across day rollover", () => {
  /** Seed a stale roll date with one task sitting in reward_ready. */
  const seedRewardReady = (rollDate: string) => {
    const roll = getDailyRoll(rollDate);
    const task = roll[0];
    useTasksStore.setState({
      dailyRollDate: rollDate,
      dailyRoll: roll,
      taskProgress: {
        [task.id]: {
          state: "reward_ready",
          hasPhoto: false,
          rewardInfo: {
            basePoints: task.pointValue,
            pointsMultiplier: 1,
            finalPoints: task.pointValue,
          },
        },
      },
    });
    return task;
  };

  it("an uncollected reward survives the rollover and stays claimable", () => {
    const task = seedRewardReady("2020-01-01");

    useTasksStore.getState().refreshDailyRoll();

    const s = useTasksStore.getState();
    // Per-day state reset as usual…
    expect(s.dailyRollDate).toBe(localDayString());
    expect(s.taskProgress).toEqual({});
    // …but the earned reward carried forward intact.
    expect(s.pendingRewards).toHaveLength(1);
    expect(s.pendingRewards[0]).toMatchObject({
      taskId: task.id,
      label: task.label,
      category: task.category,
      earnedDate: "2020-01-01",
      rewardInfo: { finalPoints: task.pointValue },
    });

    // And it can still be claimed (removed from the queue).
    useTasksStore.getState().claimPendingReward(s.pendingRewards[0].id);
    expect(useTasksStore.getState().pendingRewards).toHaveLength(0);
  });

  it("only reward_ready entries queue as rewards — claimed/idle/waiting do not", () => {
    const roll = getDailyRoll("2020-01-01");
    const waitStartedAt = Date.now();
    useTasksStore.setState({
      dailyRollDate: "2020-01-01",
      dailyRoll: roll,
      taskProgress: {
        [roll[0].id]: { state: "claimed", hasPhoto: false },
        [roll[1].id]: { state: "idle", hasPhoto: false },
        [roll[2].id]: {
          state: "waiting",
          hasPhoto: false,
          waitStartedAt,
        },
      },
    });

    useTasksStore.getState().refreshDailyRoll();

    expect(useTasksStore.getState().pendingRewards).toHaveLength(0);
    // Finished-with days are dropped, but a time lock still counting down is
    // wall-clock based and survives the rollover (see the waiting suites below).
    expect(useTasksStore.getState().taskProgress).toEqual({
      [roll[2].id]: { state: "waiting", hasPhoto: false, waitStartedAt },
    });
  });

  it("rewards stack across multiple missed days instead of overwriting", () => {
    seedRewardReady("2020-01-01");
    useTasksStore.getState().refreshDailyRoll();

    // Second missed day: another reward left unclaimed, another rollover.
    seedRewardReady("2020-01-02");
    useTasksStore.getState().refreshDailyRoll();

    const { pendingRewards } = useTasksStore.getState();
    expect(pendingRewards).toHaveLength(2);
    expect(pendingRewards.map((r) => r.earnedDate)).toEqual([
      "2020-01-01",
      "2020-01-02",
    ]);
    // Queue entries stay unique even if the same task id repeats across days.
    expect(new Set(pendingRewards.map((r) => r.id)).size).toBe(2);
  });

  it("a same-day refresh does not touch the pending queue", () => {
    const task = seedRewardReady("2020-01-01");
    useTasksStore.getState().refreshDailyRoll();
    expect(useTasksStore.getState().pendingRewards).toHaveLength(1);

    // Roll date is now today; refreshing again must be a full no-op.
    useTasksStore.getState().refreshDailyRoll();
    expect(useTasksStore.getState().pendingRewards).toHaveLength(1);
    expect(useTasksStore.getState().pendingRewards[0].taskId).toBe(task.id);
  });

  it("claimPendingReward removes only the matching reward", () => {
    seedRewardReady("2020-01-01");
    useTasksStore.getState().refreshDailyRoll();
    seedRewardReady("2020-01-02");
    useTasksStore.getState().refreshDailyRoll();

    const [first, second] = useTasksStore.getState().pendingRewards;
    useTasksStore.getState().claimPendingReward(first.id);

    const remaining = useTasksStore.getState().pendingRewards;
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(second.id);
  });

  it("allows only one winner across repeated carried-reward claims", () => {
    seedRewardReady("2020-01-01");
    useTasksStore.getState().refreshDailyRoll();
    const [reward] = useTasksStore.getState().pendingRewards;

    const attempts = [
      useTasksStore.getState().claimPendingReward(reward.id),
      useTasksStore.getState().claimPendingReward(reward.id),
      useTasksStore.getState().claimPendingReward(reward.id),
    ];

    expect(attempts[0]).toEqual(reward);
    expect(attempts.slice(1)).toEqual([null, null]);
    expect(useTasksStore.getState().pendingRewards).toHaveLength(0);
  });
});

// ─── waiting time lock across a day rollover ──────────────────────────────────
// A time lock is wall-clock based: it is anchored to waitStartedAt, so the
// calendar day rolling over mid-wait must neither restart nor discard it.

describe("waiting time lock across a day rollover", () => {
  const taskId = "wash-dishes";
  const minTime = TASK_MIN_TIMES[taskId]; // 300 s

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  /** Mirrors TaskTimer's wall-clock remaining calculation. */
  const remainingSeconds = () => {
    const { waitStartedAt } = useTasksStore.getState().taskProgress[taskId];
    return Math.max(
      0,
      minTime - Math.floor((Date.now() - waitStartedAt!) / 1000),
    );
  };

  /** Mirrors handleSkipPhoto: the lock starts now, on the current roll day. */
  const startWait = () => {
    const today = localDayString();
    useTasksStore.setState({
      dailyRollDate: today,
      dailyRoll: getDailyRoll(today),
      taskProgress: {
        [taskId]: {
          state: "waiting",
          hasPhoto: false,
          waitStartedAt: Date.now(),
        },
      },
    });
    return Date.now();
  };

  /** Mirrors handleTimerComplete for a photo-less task. */
  const completeTimer = () => {
    const progress = useTasksStore.getState().taskProgress[taskId];
    useTasksStore.getState().setTaskProgress(taskId, {
      ...progress,
      state: "reward_ready",
      rewardInfo,
    });
  };

  it("stays waiting while the lock is still running on the same day", () => {
    jest.setSystemTime(new Date("2026-05-27T12:00:00Z"));
    const startedAt = startWait();

    jest.setSystemTime(new Date("2026-05-27T12:01:00Z")); // 60 s of 300 s
    useTasksStore.getState().refreshDailyRoll(); // same day — a no-op

    const progress = useTasksStore.getState().taskProgress[taskId];
    expect(progress.state).toBe("waiting");
    expect(progress.waitStartedAt).toBe(startedAt);
    expect(remainingSeconds()).toBe(minTime - 60);
  });

  it("completes once the full duration has elapsed", () => {
    jest.setSystemTime(new Date("2026-05-27T12:00:00Z"));
    startWait();

    jest.setSystemTime(new Date("2026-05-27T12:05:00Z")); // exactly 300 s
    expect(remainingSeconds()).toBe(0);

    completeTimer();
    expect(useTasksStore.getState().taskProgress[taskId].state).toBe(
      "reward_ready",
    );
  });

  it("keeps counting from the original timestamp across midnight", () => {
    jest.setSystemTime(new Date("2026-05-27T23:58:00Z"));
    const startedAt = startWait();
    const startDay = localDayString();

    jest.setSystemTime(new Date("2026-05-28T00:01:00Z")); // 180 s of 300 s
    expect(localDayString()).not.toBe(startDay); // the day really did move
    useTasksStore.getState().refreshDailyRoll();

    const s = useTasksStore.getState();
    expect(s.dailyRollDate).toBe(localDayString());
    // The wait survives, still anchored to its original start.
    expect(s.taskProgress[taskId].state).toBe("waiting");
    expect(s.taskProgress[taskId].waitStartedAt).toBe(startedAt);
    expect(remainingSeconds()).toBe(minTime - 180);
    // Its task stays in the roll, so the timer is still on screen to finish.
    expect(s.dailyRoll.map((t) => t.id)).toContain(taskId);
    // An unfinished wait is not an earned reward.
    expect(s.pendingRewards).toHaveLength(0);
  });

  it("completes after midnight without restarting at the date change", () => {
    jest.setSystemTime(new Date("2026-05-27T23:58:00Z"));
    startWait();

    jest.setSystemTime(new Date("2026-05-28T00:01:00Z"));
    useTasksStore.getState().refreshDailyRoll();
    expect(remainingSeconds()).toBeGreaterThan(0);

    jest.setSystemTime(new Date("2026-05-28T00:03:00Z")); // 300 s from the start
    expect(remainingSeconds()).toBe(0);

    completeTimer();
    expect(useTasksStore.getState().taskProgress[taskId].state).toBe(
      "reward_ready",
    );
  });
});

// ─── waiting time lock across an app reopen ───────────────────────────────────
// Real rehydration (which runs refreshDailyRoll): the persisted waitStartedAt,
// never the moment hydration happens, is the timer's anchor.

describe("waiting time lock across an app reopen", () => {
  const taskId = "wash-dishes";
  const minTime = TASK_MIN_TIMES[taskId];
  const getItemMock = AsyncStorage.getItem as jest.Mock;

  const remainingFrom = (waitStartedAt: number) =>
    Math.max(0, minTime - Math.floor((Date.now() - waitStartedAt) / 1000));

  /** Reopen the app on a later day with a wait persisted mid-flight. */
  const reopenWith = async (waitStartedAt: number) => {
    getItemMock.mockResolvedValueOnce(
      JSON.stringify({
        state: {
          tasks: [],
          dailyRoll: getDailyRoll("2020-01-01"),
          dailyRollDate: "2020-01-01",
          pendingRewards: [],
          taskProgress: {
            [taskId]: { state: "waiting", hasPhoto: false, waitStartedAt },
          },
        },
        version: 2,
      }),
    );
    await useTasksStore.persist.rehydrate();
  };

  it("resumes a still-running wait from its persisted timestamp", async () => {
    const waitStartedAt = Date.now() - 120_000; // 2 min into a 5 min lock

    await reopenWith(waitStartedAt);

    const s = useTasksStore.getState();
    expect(s.dailyRollDate).toBe(localDayString()); // the roll did refresh
    expect(s.taskProgress[taskId].state).toBe("waiting");
    // Not re-anchored to hydration time.
    expect(s.taskProgress[taskId].waitStartedAt).toBe(waitStartedAt);
    expect(remainingFrom(waitStartedAt)).toBeGreaterThan(0);
    expect(remainingFrom(waitStartedAt)).toBeLessThanOrEqual(minTime - 120);
    expect(s.dailyRoll.map((t) => t.id)).toContain(taskId);
  });

  it("recognises a wait that already elapsed while the app was closed", async () => {
    const waitStartedAt = Date.now() - (minTime + 60) * 1000;

    await reopenWith(waitStartedAt);

    const s = useTasksStore.getState();
    expect(s.taskProgress[taskId].state).toBe("waiting");
    expect(s.taskProgress[taskId].waitStartedAt).toBe(waitStartedAt);
    // Zero remaining on arrival: no second full wait is imposed.
    expect(remainingFrom(waitStartedAt)).toBe(0);
    expect(s.dailyRoll.map((t) => t.id)).toContain(taskId);
  });

  it("does not restart the wait after a long closed period", async () => {
    const waitStartedAt = Date.now() - 30 * 24 * 3_600_000; // a month ago

    await reopenWith(waitStartedAt);

    const s = useTasksStore.getState();
    expect(s.taskProgress[taskId].waitStartedAt).toBe(waitStartedAt);
    expect(remainingFrom(waitStartedAt)).toBe(0);
  });
});
