import { getDailyRoll, PRESET_TASKS } from "@/store/preset-tasks";
import { useTasksStore } from "@/store/use-tasks-store";
import { CleaningTask } from "@/store/types";

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

beforeEach(() => {
  useTasksStore.setState({
    tasks: [],
    dailyRoll: getDailyRoll(new Date().toISOString().slice(0, 10)),
    dailyRollDate: new Date().toISOString().slice(0, 10),
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
    const today = new Date().toISOString().slice(0, 10);
    expect(useTasksStore.getState().dailyRollDate).toBe(today);
  });

  it("refreshDailyRoll is a no-op when the date has not changed", () => {
    const before = useTasksStore.getState().dailyRoll.map((t) => t.id);
    useTasksStore.getState().refreshDailyRoll();
    const after = useTasksStore.getState().dailyRoll.map((t) => t.id);
    expect(after).toEqual(before);
  });

  it("refreshDailyRoll recomputes when dailyRollDate is stale", () => {
    const today = new Date().toISOString().slice(0, 10);
    useTasksStore.setState({ dailyRollDate: "2020-01-01", dailyRoll: [] });
    useTasksStore.getState().refreshDailyRoll();
    expect(useTasksStore.getState().dailyRollDate).toBe(today);
    expect(useTasksStore.getState().dailyRoll).toHaveLength(6);
  });
});
