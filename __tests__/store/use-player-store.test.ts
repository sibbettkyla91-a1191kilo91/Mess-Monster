import { usePlayerStore } from "@/store/use-player-store";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

const INITIAL = {
  totalPoints: 100,
  spentPoints: 0,
  streak: 0,
  lastActiveDay: "",
  selectedMonster: null as "nilly" | "luna" | null,
};

beforeEach(() => {
  usePlayerStore.setState(INITIAL);
});

// ─── availablePoints ──────────────────────────────────────────────────────────

describe("availablePoints", () => {
  it("equals totalPoints when nothing has been spent", () => {
    expect(usePlayerStore.getState().availablePoints()).toBe(100);
  });

  it("decreases as points are spent", () => {
    usePlayerStore.setState({ spentPoints: 40 });
    expect(usePlayerStore.getState().availablePoints()).toBe(60);
  });

  it("returns 0 when all points are spent", () => {
    usePlayerStore.setState({ totalPoints: 50, spentPoints: 50 });
    expect(usePlayerStore.getState().availablePoints()).toBe(0);
  });
});

// ─── earnPoints ───────────────────────────────────────────────────────────────

describe("earnPoints", () => {
  it("increases totalPoints by the given amount", () => {
    usePlayerStore.getState().earnPoints(25);
    expect(usePlayerStore.getState().totalPoints).toBe(125);
  });

  it("does not change spentPoints", () => {
    usePlayerStore.getState().earnPoints(50);
    expect(usePlayerStore.getState().spentPoints).toBe(0);
  });

  it("can be called multiple times cumulatively", () => {
    usePlayerStore.getState().earnPoints(10);
    usePlayerStore.getState().earnPoints(20);
    usePlayerStore.getState().earnPoints(30);
    expect(usePlayerStore.getState().totalPoints).toBe(160);
  });
});

// ─── spendPoints ──────────────────────────────────────────────────────────────

describe("spendPoints", () => {
  it("returns true and deducts when funds are sufficient", () => {
    const ok = usePlayerStore.getState().spendPoints(40);
    expect(ok).toBe(true);
    expect(usePlayerStore.getState().spentPoints).toBe(40);
    expect(usePlayerStore.getState().availablePoints()).toBe(60);
  });

  it("returns false and does not deduct when funds are insufficient", () => {
    const ok = usePlayerStore.getState().spendPoints(150); // more than available 100
    expect(ok).toBe(false);
    expect(usePlayerStore.getState().spentPoints).toBe(0);
  });

  it("allows spending exactly the available balance", () => {
    const ok = usePlayerStore.getState().spendPoints(100);
    expect(ok).toBe(true);
    expect(usePlayerStore.getState().availablePoints()).toBe(0);
  });

  it("prevents going below zero even after partial spends", () => {
    usePlayerStore.getState().spendPoints(90);
    const ok = usePlayerStore.getState().spendPoints(20); // only 10 left
    expect(ok).toBe(false);
    expect(usePlayerStore.getState().availablePoints()).toBe(10);
  });
});

// ─── selectMonster ────────────────────────────────────────────────────────────

describe("selectMonster", () => {
  it("starts as null", () => {
    expect(usePlayerStore.getState().selectedMonster).toBeNull();
  });

  it("sets selectedMonster to nilly", () => {
    usePlayerStore.getState().selectMonster("nilly");
    expect(usePlayerStore.getState().selectedMonster).toBe("nilly");
  });

  it("sets selectedMonster to luna", () => {
    usePlayerStore.getState().selectMonster("luna");
    expect(usePlayerStore.getState().selectedMonster).toBe("luna");
  });

  it("can switch monster after initial selection", () => {
    usePlayerStore.getState().selectMonster("nilly");
    usePlayerStore.getState().selectMonster("luna");
    expect(usePlayerStore.getState().selectedMonster).toBe("luna");
  });
});

// ─── recordActivity (streak logic) ───────────────────────────────────────────

describe("recordActivity", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("sets streak to 1 on first ever activity", () => {
    jest.setSystemTime(new Date("2026-05-27T10:00:00Z"));
    usePlayerStore.setState({ streak: 0, lastActiveDay: "" });

    usePlayerStore.getState().recordActivity();

    expect(usePlayerStore.getState().streak).toBe(1);
    expect(usePlayerStore.getState().lastActiveDay).toBe("2026-05-27");
  });

  it("increments streak on consecutive days", () => {
    jest.setSystemTime(new Date("2026-05-27T10:00:00Z"));
    usePlayerStore.setState({ streak: 4, lastActiveDay: "2026-05-26" });

    usePlayerStore.getState().recordActivity();

    expect(usePlayerStore.getState().streak).toBe(5);
  });

  it("resets streak to 1 after a gap of more than one day", () => {
    jest.setSystemTime(new Date("2026-05-27T10:00:00Z"));
    usePlayerStore.setState({ streak: 10, lastActiveDay: "2026-05-24" }); // 3 days ago

    usePlayerStore.getState().recordActivity();

    expect(usePlayerStore.getState().streak).toBe(1);
  });

  it("does not change streak when called a second time on the same day", () => {
    jest.setSystemTime(new Date("2026-05-27T10:00:00Z"));
    usePlayerStore.setState({ streak: 3, lastActiveDay: "2026-05-27" });

    usePlayerStore.getState().recordActivity();

    expect(usePlayerStore.getState().streak).toBe(3); // unchanged
    expect(usePlayerStore.getState().lastActiveDay).toBe("2026-05-27");
  });

  it("updates lastActiveDay to today", () => {
    jest.setSystemTime(new Date("2026-06-01T08:30:00Z"));
    usePlayerStore.setState({ streak: 0, lastActiveDay: "" });

    usePlayerStore.getState().recordActivity();

    expect(usePlayerStore.getState().lastActiveDay).toBe("2026-06-01");
  });
});
